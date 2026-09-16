import { supabase } from "@/integrations/supabase/client";

const MAX_SOURCE_BYTES = 250 * 1024 * 1024;
const FRAME_WIDTH = 960;
const VIDEO_FRAME_POSITIONS = [0.05, 0.3, 0.55, 0.8, 0.95];
const MODERATION_UNAVAILABLE =
  "Não foi possível verificar esta mídia com segurança. Tente outro arquivo ou tente novamente.";

export interface ModerationResult {
  allowed: boolean;
  category?: "csam" | "other" | "review_required";
  reason?: string;
  skipped?: boolean;
  ai?: unknown;
  logged?: boolean;
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.76);
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Falha ao preparar mídia para moderação");
  return dataUrl.slice(separator + 1);
}

function drawFrame(source: CanvasImageSource, width: number, height: number): string {
  if (!width || !height) throw new Error("Mídia sem dimensões válidas");
  const scale = Math.min(1, FRAME_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas indisponível");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvasToBase64(canvas);
}

async function imageFrame(file: File): Promise<string> {
  if (file.type === "image/gif") {
    throw new Error("GIF animado não é aceito por segurança. Envie JPG, PNG ou WebP.");
  }

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    try {
      return drawFrame(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("O navegador não conseguiu ler esta imagem"));
      image.src = url;
    });
    return drawFrame(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function waitForMediaEvent(
  media: HTMLVideoElement,
  event: "loadedmetadata" | "loadeddata" | "seeked",
  timeoutMs = 15_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao processar o vídeo"));
    }, timeoutMs);
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("O navegador não conseguiu ler este vídeo"));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      media.removeEventListener(event, onSuccess);
      media.removeEventListener("error", onError);
    };
    media.addEventListener(event, onSuccess, { once: true });
    media.addEventListener("error", onError, { once: true });
  });
}

async function videoFrames(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    const metadataLoaded = waitForMediaEvent(video, "loadedmetadata");
    video.src = url;
    video.load();
    await metadataLoaded;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForMediaEvent(video, "loadeddata");
    }

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("Vídeo sem duração válida");
    }

    const frames: string[] = [];
    for (const position of VIDEO_FRAME_POSITIONS) {
      const target = Math.min(
        Math.max(video.duration * position, 0),
        Math.max(0, video.duration - 0.05),
      );
      if (Math.abs(video.currentTime - target) > 0.01) {
        const seeked = waitForMediaEvent(video, "seeked");
        video.currentTime = target;
        await seeked;
      }
      frames.push(drawFrame(video, video.videoWidth, video.videoHeight));
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function recordBlockedUpload(
  result: ModerationResult,
  file: File,
  surface: "post" | "story" | "chat",
  userId: string,
) {
  const { error } = await supabase.from("moderation_logs").insert({
    user_id: userId,
    surface,
    category: result.category ?? "review_required",
    reason: result.reason ?? null,
    mime_type: file.type || null,
    file_size_bytes: Math.min(file.size, 2_147_483_647),
    ai_response: (result.ai ?? null) as never,
  });
  if (error) console.warn("moderation log error", error.message);
}

/**
 * Modera toda mídia antes do upload. Imagens grandes são redimensionadas e
 * vídeos têm cinco quadros distribuídos pela duração analisados. Qualquer
 * falha de leitura, formato ou serviço bloqueia o envio (fail-closed).
 */
export async function moderateBeforeUpload(
  file: File,
  surface: "post" | "story" | "chat",
  userId: string,
): Promise<ModerationResult> {
  let result: ModerationResult;

  try {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      throw new Error("Formato de mídia não permitido");
    }
    if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
      throw new Error("Arquivo vazio ou maior que 250 MB");
    }

    const frames = file.type.startsWith("video/")
      ? await videoFrames(file)
      : [await imageFrame(file)];

    const { data, error } = await supabase.functions.invoke("moderate-media-v2", {
      body: {
        imagesBase64: frames,
        mimeType: "image/jpeg",
        sourceMimeType: file.type,
        surface,
        fileSizeBytes: file.size,
      },
    });

    if (error) throw error;
    const response = data as ModerationResult | null;
    result =
      response?.allowed === true
        ? { allowed: true }
        : {
            allowed: false,
            category: response?.category ?? "review_required",
            reason: response?.reason ?? MODERATION_UNAVAILABLE,
            ai: response?.ai,
            logged: response?.logged,
          };
  } catch (error) {
    console.warn("moderation failed closed", error);
    result = {
      allowed: false,
      category: "review_required",
      reason: error instanceof Error && error.message ? error.message : MODERATION_UNAVAILABLE,
    };
  }

  if (!result.allowed && !result.logged) {
    await recordBlockedUpload(result, file, surface, userId);
  }
  return result;
}

/**
 * Gera uma prévia minúscula e desfocada de uma imagem ou vídeo, no navegador
 * da criadora, na hora do envio. Ela é o que o fã vê antes de pagar: 32 px de
 * largura em JPEG, ampliada com blur no CSS — impossível recuperar a original,
 * mas dá "cheiro" do conteúdo, o que converte muito mais que um quadrado cinza.
 */
const PREVIEW_WIDTH = 32;

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.6));
}

function drawScaled(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement | null {
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  const ratio = height / width;
  canvas.width = PREVIEW_WIDTH;
  canvas.height = Math.max(1, Math.round(PREVIEW_WIDTH * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.filter = "blur(1px)";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function fromImage(file: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("imagem inválida"));
      img.src = url;
    });
    const canvas = drawScaled(img, img.naturalWidth, img.naturalHeight);
    return canvas ? canvasToJpeg(canvas) : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fromVideo(file: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("vídeo inválido"));
    });
    // Pula o primeiro frame (costuma ser preto) e espera o seek concluir.
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = Math.min(1, Math.max(0.1, video.duration / 10 || 0.5));
    });
    const canvas = drawScaled(video, video.videoWidth, video.videoHeight);
    return canvas ? canvasToJpeg(canvas) : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Devolve null quando não for possível gerar (o post continua funcionando sem blur). */
export async function makeBlurPreview(file: File, coverFile?: File | null): Promise<Blob | null> {
  try {
    if (coverFile && coverFile.type.startsWith("image/")) return await fromImage(coverFile);
    if (file.type.startsWith("image/")) return await fromImage(file);
    if (file.type.startsWith("video/")) return await fromVideo(file);
    return null;
  } catch {
    return null;
  }
}

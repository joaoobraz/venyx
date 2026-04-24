import { supabase } from "@/integrations/supabase/client";

/**
 * Lê um File como base64 (sem prefixo data:).
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export interface ModerationResult {
  allowed: boolean;
  category?: "csam" | "other";
  reason?: string;
  skipped?: boolean;
}

/**
 * Modera uma mídia antes do upload. Bloqueia CSAM automaticamente.
 * Em caso de bloqueio, registra o evento em moderation_logs.
 *
 * Vídeos: por enquanto não escaneados (skipped=true). Imagens > 8MB também são puladas
 * para não estourar payload da edge function.
 */
export async function moderateBeforeUpload(
  file: File,
  surface: "post" | "story" | "chat",
  userId: string,
): Promise<ModerationResult> {
  // Pular vídeos e imagens muito grandes
  if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
    return { allowed: true, skipped: true };
  }

  let base64: string;
  try {
    base64 = await fileToBase64(file);
  } catch {
    return { allowed: true, skipped: true };
  }

  const { data, error } = await supabase.functions.invoke("moderate-media", {
    body: { imageBase64: base64, mimeType: file.type },
  });

  if (error) {
    console.warn("moderation invoke error", error);
    return { allowed: true, skipped: true };
  }

  const res = data as ModerationResult & { ai?: unknown };
  if (!res.allowed) {
    await supabase.from("moderation_logs").insert({
      user_id: userId,
      surface,
      category: res.category ?? "other",
      reason: res.reason ?? null,
      mime_type: file.type,
      file_size_bytes: file.size,
      ai_response: (res.ai ?? null) as never,
    });
  }
  return res;
}

export type AiPurpose = "text" | "vision";

// Keep provider credentials and model choices entirely in staging/hosting secrets.

export function getAiConfig(purpose: AiPurpose) {
  const url = (Deno.env.get("AI_CHAT_COMPLETIONS_URL") ?? "").trim();
  const apiKey = (Deno.env.get("AI_API_KEY") ?? "").trim();
  const model = (
    Deno.env.get(purpose === "vision" ? "AI_VISION_MODEL" : "AI_TEXT_MODEL") ?? ""
  ).trim();

  if (!url || !apiKey || !model) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  return { url: parsed.toString(), apiKey, model };
}

export async function requestChatCompletion(
  purpose: AiPurpose,
  messages: unknown[],
  signal?: AbortSignal,
) {
  const config = getAiConfig(purpose);
  if (!config) return null;

  return fetch(config.url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, messages }),
  });
}

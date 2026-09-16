// Analisa imagens e quadros extraídos de vídeos antes de qualquer upload público (v2).
// Segurança: a função sempre falha fechada. Indisponibilidade ou resposta ambígua
// bloqueia o envio para revisão, sem liberar a mídia.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getAiConfig, requestChatCompletion } from "../_shared/ai.ts";
import { corsHeadersFor, isAllowedBrowserOrigin } from "../_shared/cors.ts";
const MAX_FRAMES = 5;
const MAX_TOTAL_BASE64_CHARS = 10 * 1024 * 1024;

interface ModReq {
  imageBase64?: string;
  imagesBase64?: string[];
  mimeType?: string;
  sourceMimeType?: string;
  surface?: "post" | "story" | "chat";
  fileSizeBytes?: number;
}

interface AiDecision {
  is_minor?: boolean;
  confidence?: "low" | "medium" | "high";
  reason?: string;
}

interface BlockedResult {
  allowed: false;
  category: "csam" | "review_required";
  reason: string;
  ai?: AiDecision;
}

function json(data: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeBase64(value: string) {
  const comma = value.indexOf(",");
  return comma >= 0 ? value.slice(comma + 1) : value;
}

function safeParseJson(value: string): AiDecision {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, corsHeaders);
  if (!isAllowedBrowserOrigin(req)) return json({ error: "Origem não permitida" }, 403, corsHeaders);

  let body: ModReq | null = null;
  let authenticatedClient: ReturnType<typeof createClient> | null = null;
  let authenticatedUserId: string | null = null;

  const block = async (result: BlockedResult, status = 200) => {
    let logged = false;
    if (authenticatedClient && authenticatedUserId && body?.surface) {
      const { error } = await authenticatedClient.from("moderation_logs").insert({
        user_id: authenticatedUserId,
        surface: body.surface,
        category: result.category,
        reason: result.reason,
        mime_type: body.sourceMimeType ?? body.mimeType ?? null,
        file_size_bytes:
          Number.isSafeInteger(body.fileSizeBytes) && (body.fileSizeBytes ?? 0) >= 0
            ? Math.min(body.fileSizeBytes ?? 0, 2_147_483_647)
            : null,
        ai_response: result.ai ?? null,
      });
      logged = !error;
      if (error) console.error("moderation audit insert failed", error.code);
    }
    return json({ ...result, logged }, status, corsHeaders);
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401, corsHeaders);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return json({ error: "Configuração indisponível" }, 503, corsHeaders);
    }

    authenticatedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authenticatedClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autenticado" }, 401, corsHeaders);
    authenticatedUserId = user.id;

    body = await req.json();
    const rawFrames = body.imagesBase64?.length
      ? body.imagesBase64
      : body.imageBase64
        ? [body.imageBase64]
        : [];
    const validSurface = body.surface === "post" || body.surface === "story" || body.surface === "chat";

    if (!validSurface || !body.mimeType?.startsWith("image/") || rawFrames.length === 0) {
      return block({
        allowed: false,
        category: "review_required",
        reason: "Mídia sem amostras válidas para análise",
      });
    }
    if (rawFrames.length > MAX_FRAMES) {
      return block({
        allowed: false,
        category: "review_required",
        reason: "Quantidade de quadros inválida",
      });
    }

    const frames = rawFrames.map(normalizeBase64);
    const totalChars = frames.reduce((sum, frame) => sum + frame.length, 0);
    if (
      totalChars <= 0 ||
      totalChars > MAX_TOTAL_BASE64_CHARS ||
      frames.some((frame) => !/^[A-Za-z0-9+/=\s]+$/.test(frame))
    ) {
      return block({
        allowed: false,
        category: "review_required",
        reason: "Amostras inválidas ou grandes demais para análise",
      });
    }

    if (!getAiConfig("vision")) {
      return block({
        allowed: false,
        category: "review_required",
        reason: "Moderação automática ainda não configurada — envio bloqueado para revisão",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    let aiRes: Response;
    try {
      const response = await requestChatCompletion(
        "vision",
        [
            {
              role: "system",
              content:
                "Você modera uma plataforma exclusiva para adultos. Analise todas as imagens fornecidas, que podem ser quadros de um vídeo. Detecte qualquer pessoa que seja ou aparente ser menor de 18 anos, mesmo em contexto não sexual. Em qualquer dúvida, marque is_minor como true. Conteúdo adulto entre maiores não deve ser rejeitado. Responda somente JSON válido: {\"is_minor\":true|false,\"confidence\":\"low\"|\"medium\"|\"high\",\"reason\":\"explicação curta\"}.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Existe indício de menor em alguma amostra?" },
                ...frames.map((frame) => ({
                  type: "image_url",
                  image_url: { url: `data:${body?.mimeType};base64,${frame}` },
                })),
              ],
            },
        ],
        controller.signal,
      );
      if (!response) throw new Error("AI configuration unavailable");
      aiRes = response;
    } finally {
      clearTimeout(timeout);
    }

    if (!aiRes.ok) {
      console.error("moderation provider unavailable", aiRes.status);
      return block({
        allowed: false,
        category: "review_required",
        reason: "Moderação automática indisponível — envio bloqueado para revisão",
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content;
    const decision = typeof raw === "string" ? safeParseJson(raw) : {};

    if (decision.is_minor === true) {
      return block({
        allowed: false,
        category: "csam",
        reason: decision.reason || "Possível menor de idade detectado",
        ai: decision,
      });
    }
    if (decision.is_minor !== false || decision.confidence === "low") {
      return block({
        allowed: false,
        category: "review_required",
        reason: "Análise inconclusiva — envio bloqueado para revisão",
        ai: decision,
      });
    }

    return json({ allowed: true }, 200, corsHeaders);
  } catch (error) {
    console.error("moderate-media failed closed", error instanceof Error ? error.name : "unknown");
    return block({
      allowed: false,
      category: "review_required",
      reason: "Não foi possível concluir a análise — envio bloqueado para revisão",
    });
  }
});

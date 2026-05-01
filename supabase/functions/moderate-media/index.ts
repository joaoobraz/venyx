// Modera mídia (imagem/vídeo) usando Lovable AI Gateway (Gemini Vision).
// Bloqueia automaticamente conteúdo CSAM (menor de idade).
// Retorna { allowed: boolean, category?: 'csam'|'other', reason?: string }
// Em caso de bloqueio, registra em moderation_logs (insert feito no client com auth).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = [
  "https://private-pleasures-portal.lovable.app",
  "https://id-preview--59549983-d8c7-43dd-bb65-ffb37fd041ca.lovable.app",
];
function buildCors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}
// Fallback estático para uso em helpers fora do handler (origin restrito ao domínio principal).
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ModReq {
  imageBase64?: string; // data URL ou base64 puro
  mimeType: string;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const body: ModReq = await req.json();
    if (!body.imageBase64 || !body.mimeType) {
      return json({ error: "imageBase64 e mimeType obrigatórios" }, 400);
    }

    // Vídeos: por enquanto liberamos com aviso (Gemini Vision aceita imagens; vídeos exigem outra API).
    if (!body.mimeType.startsWith("image/")) {
      return json({ allowed: true, skipped: true, reason: "video_not_scanned" });
    }

    const dataUrl = body.imageBase64.startsWith("data:")
      ? body.imageBase64
      : `data:${body.mimeType};base64,${body.imageBase64}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um moderador de conteúdo adulto. Sua ÚNICA tarefa é detectar se a imagem contém ou aparenta conter MENORES DE IDADE (qualquer pessoa que aparente ter menos de 18 anos), mesmo em contexto não-sexual. Responda APENAS com JSON válido no formato {\"is_minor\":true|false,\"confidence\":\"low\"|\"medium\"|\"high\",\"reason\":\"explicação curta\"}. Em qualquer dúvida, marque is_minor:true. Conteúdo adulto entre maiores de idade é permitido — não rejeite por isso.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Há indícios de menor de idade nesta imagem?" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
    if (aiRes.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      // FAIL-CLOSED: para CSAM, na dúvida bloqueamos e mandamos para revisão manual.
      return json({
        allowed: false,
        category: "review_required",
        reason: "Moderação automática indisponível — enviado para revisão manual",
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeParseJson(raw);
    const isMinor = !!parsed.is_minor;
    const reason = parsed.reason ?? "";

    if (isMinor) {
      return json({
        allowed: false,
        category: "csam",
        reason: reason || "Possível menor de idade detectado",
        ai: parsed,
      });
    }

    return json({ allowed: true });
  } catch (e) {
    console.error("moderate-media error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeParseJson(s: string): { is_minor?: boolean; confidence?: string; reason?: string } {
  try {
    return JSON.parse(s);
  } catch {
    // Tenta extrair {...}
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

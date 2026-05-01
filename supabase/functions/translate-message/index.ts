// Traduz texto curto usando Lovable AI (Gemini Flash).
// Body: { text: string, target?: string }  target default = 'pt-BR'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = new Set([
  "https://private-pleasures-portal.lovable.app",
  "https://id-preview--59549983-d8c7-43dd-bb65-ffb37fd041ca.lovable.app",
]);
function buildCors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://private-pleasures-portal.lovable.app",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Não autenticado" }, 401);
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return j({ error: "Não autenticado" }, 401);

    const { text, target = "pt-BR" } = await req.json();
    if (!text || typeof text !== "string") return j({ error: "text obrigatório" }, 400);
    if (text.length > 2000) return j({ error: "text muito longo" }, 400);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Traduza o texto do usuário para ${target}. Responda APENAS com a tradução, sem aspas, sem explicações, sem prefixo. Mantenha emojis e gírias.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (res.status === 429) return j({ error: "rate_limited" }, 429);
    if (res.status === 402) return j({ error: "ai_credits_exhausted" }, 402);
    if (!res.ok) return j({ error: "ai_error" }, 500);

    const data = await res.json();
    const translation = (data.choices?.[0]?.message?.content ?? "").trim();
    return j({ translation });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function j(d: unknown, s = 200, req?: Request) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...(req ? buildCors(req) : {}), "Content-Type": "application/json" },
  });
}

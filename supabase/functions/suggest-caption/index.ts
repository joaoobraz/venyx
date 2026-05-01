// Sugere uma legenda envolvente para um post adulto-criadora.
// Body: { hint?: string, mood?: 'flerte'|'misterioso'|'engracado'|'provocante'|'romantico', n?: number }
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

    const { hint = "", mood = "flerte", n = 3 } = await req.json();

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              `Você é copywriter para criadoras de conteúdo adulto na plataforma Venyx. Gere ${Math.min(5, Math.max(1, n))} sugestões de legenda em português, tom "${mood}", até 220 caracteres cada, com 1-2 emojis e uma chamada sutil para clicar/desbloquear/assinar. NUNCA mencione menores ou conteúdo ilegal. Responda APENAS com JSON {"captions":["...","..."]}.`,
          },
          { role: "user", content: hint || "Crie sugestões para um post novo." },
        ],
      }),
    });

    if (res.status === 429) return j({ error: "rate_limited" }, 429);
    if (res.status === 402) return j({ error: "ai_credits_exhausted" }, 402);
    if (!res.ok) return j({ error: "ai_error" }, 500);

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let captions: string[] = [];
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) captions = JSON.parse(m[0]).captions ?? [];
    } catch { /* noop */ }
    return j({ captions });
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

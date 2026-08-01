// Sugere uma legenda envolvente para um post adulto-criadora.
// Body: { hint?: string, mood?: 'flerte'|'misterioso'|'engracado'|'provocante'|'romantico', n?: number }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requestChatCompletion } from "../_shared/ai.ts";
import { corsHeadersFor, isAllowedBrowserOrigin } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405, corsHeaders);
  if (!isAllowedBrowserOrigin(req)) return j({ error: "origin_not_allowed" }, 403, corsHeaders);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Não autenticado" }, 401, corsHeaders);
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return j({ error: "Não autenticado" }, 401, corsHeaders);

    const { hint = "", mood = "flerte", n = 3 } = await req.json();
    if (typeof hint !== "string" || hint.length > 1000 || typeof mood !== "string") {
      return j({ error: "invalid_input" }, 400, corsHeaders);
    }

    const res = await requestChatCompletion("text", [
          {
            role: "system",
            content:
              `Você é copywriter para criadoras de conteúdo adulto na plataforma Venyx. Gere ${Math.min(5, Math.max(1, n))} sugestões de legenda em português, tom "${mood}", até 220 caracteres cada, com 1-2 emojis e uma chamada sutil para clicar/desbloquear/assinar. NUNCA mencione menores ou conteúdo ilegal. Responda APENAS com JSON {"captions":["...","..."]}.`,
          },
          { role: "user", content: hint || "Crie sugestões para um post novo." },
    ]);

    if (!res) return j({ error: "ai_not_configured" }, 503, corsHeaders);

    if (res.status === 429) return j({ error: "rate_limited" }, 429, corsHeaders);
    if (res.status === 402) return j({ error: "ai_credits_exhausted" }, 402, corsHeaders);
    if (!res.ok) return j({ error: "ai_error" }, 502, corsHeaders);

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let captions: string[] = [];
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) captions = JSON.parse(m[0]).captions ?? [];
    } catch { /* noop */ }
    return j({ captions }, 200, corsHeaders);
  } catch (e) {
    console.error("suggest-caption failed", e instanceof Error ? e.name : "unknown");
    return j({ error: "internal_error" }, 500, corsHeaders);
  }
});

function j(d: unknown, s: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

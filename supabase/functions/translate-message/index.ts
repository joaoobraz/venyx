// Traduz texto curto usando um provedor compatível com Chat Completions.
// Body: { text: string, target?: string }  target default = 'pt-BR'
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

    const { text, target = "pt-BR" } = await req.json();
    if (!text || typeof text !== "string") return j({ error: "text obrigatório" }, 400, corsHeaders);
    if (text.length > 2000) return j({ error: "text muito longo" }, 400, corsHeaders);

    const res = await requestChatCompletion("text", [
          {
            role: "system",
            content: `Traduza o texto do usuário para ${target}. Responda APENAS com a tradução, sem aspas, sem explicações, sem prefixo. Mantenha emojis e gírias.`,
          },
          { role: "user", content: text },
    ]);

    if (!res) return j({ error: "ai_not_configured" }, 503, corsHeaders);

    if (res.status === 429) return j({ error: "rate_limited" }, 429, corsHeaders);
    if (res.status === 402) return j({ error: "ai_credits_exhausted" }, 402, corsHeaders);
    if (!res.ok) return j({ error: "ai_error" }, 502, corsHeaders);

    const data = await res.json();
    const translation = (data.choices?.[0]?.message?.content ?? "").trim();
    return j({ translation }, 200, corsHeaders);
  } catch (e) {
    console.error("translate-message failed", e instanceof Error ? e.name : "unknown");
    return j({ error: "internal_error" }, 500, corsHeaders);
  }
});

function j(d: unknown, s: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

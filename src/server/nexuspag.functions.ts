import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE_URL = "https://nexuspag.com";

// URL pública estável do projeto (Lovable). Ajuste para custom domain quando configurar.
const PROJECT_ID = "59549983-d8c7-43dd-bb65-ffb37fd041ca";
function getWebhookUrl(): string {
  const envUrl = process.env.PUBLIC_WEBHOOK_URL;
  if (envUrl) return envUrl;
  return `https://project--${PROJECT_ID}.lovable.app/api/public/nexuspag-webhook`;
}

function getApiKey(): string {
  const key = process.env.NEXUSPAG_API_KEY;
  if (!key) throw new Error("NEXUSPAG_API_KEY não configurada");
  return key;
}

/**
 * Garante que o usuário tem permissão (seller OU admin) para usar a tela de teste de PIX.
 * Sem isso, qualquer pessoa poderia POSTar direto na server function e gerar cobranças
 * reais usando NEXUSPAG_API_KEY.
 */
async function assertSellerOrAdmin(userId: string): Promise<void> {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error("Falha ao verificar permissões");
  const allowed = (roles ?? []).some(
    (r) => r.role === "seller" || r.role === "admin",
  );
  if (!allowed) {
    throw new Error("Acesso negado: apenas vendedores ou administradores");
  }
}

const createPixSchema = z.object({
  amount: z.number().positive().finite().max(10_000_00), // R$ 10.000 max por transação
  description: z.string().min(1).max(255).optional(),
  external_id: z.string().min(1).max(128).optional(),
  expiration_seconds: z.number().int().min(60).max(86400).optional(),
});

export const createPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSellerOrAdmin(context.userId);

    const body = {
      amount: data.amount,
      description: data.description ?? "Teste NexusPag",
      external_id: data.external_id ?? `test-${Date.now()}`,
      expiration_seconds: data.expiration_seconds ?? 1800,
      webhook_url: getWebhookUrl(),
    };

    const res = await fetch(`${BASE_URL}/api/pix/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getApiKey(),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      return { ok: false as const, status: res.status, error: json };
    }
    return { ok: true as const, data: json };
  });

const getStatusSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
});

export const getPixStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => getStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSellerOrAdmin(context.userId);

    const res = await fetch(
      `${BASE_URL}/api/pix/${encodeURIComponent(data.id)}`,
      {
        method: "GET",
        headers: { "x-api-key": getApiKey() },
      },
    );
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      return { ok: false as const, status: res.status, error: json };
    }
    return { ok: true as const, data: json };
  });

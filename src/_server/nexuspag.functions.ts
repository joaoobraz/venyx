import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseMfa } from "@/_server/access-control.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE_URL = "https://nexuspag.com";
const NEXUSPAG_TIMEOUT_MS = 20_000;

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

async function readJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "Falha ao comunicar com o provedor Pix";
}

/**
 * Garante que o usuário tem permissão (seller OU admin) para usar a tela de teste de PIX.
 * Sem isso, qualquer pessoa poderia POSTar direto na server function e gerar cobranças
 * reais usando NEXUSPAG_API_KEY.
 */
async function assertPaymentTestAdmin(userId: string): Promise<void> {
  if (process.env.ENABLE_PAYMENT_TEST_ENDPOINTS !== "true") {
    throw new Error("Os endpoints de teste de pagamento estão desativados");
  }

  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error("Falha ao verificar permissões");
  const allowed = (roles ?? []).some((r) => r.role === "admin");
  if (!allowed) {
    throw new Error("Acesso negado: apenas administradores");
  }
}

const createPixSchema = z.object({
  amount: z.number().positive().finite().max(10_000_00), // R$ 10.000 max por transação
  description: z.string().min(1).max(255).optional(),
  external_id: z.string().min(1).max(128).optional(),
  expiration_seconds: z.number().int().min(60).max(86400).optional(),
});

export const createPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .inputValidator((input: unknown) => createPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      await assertPaymentTestAdmin(context.userId);

      const body = {
        amount: data.amount,
        description: data.description ?? "Teste NexusPag",
        external_id: data.external_id ?? `test-${Date.now()}`,
        expiration_seconds: data.expiration_seconds ?? 1800,
        webhook_url: getWebhookUrl(),
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NEXUSPAG_TIMEOUT_MS);
      const res = await fetch(`${BASE_URL}/api/pix/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": getApiKey(),
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      }).finally(() => clearTimeout(timeout));

      const json = await readJsonResponse(res);

      if (!res.ok) {
        console.error("[nexuspag-test] criação falhou", res.status, json);
        return { ok: false as const, status: res.status, error: json };
      }
      return { ok: true as const, data: json };
    } catch (error) {
      console.error("[nexuspag-test] erro ao criar Pix", error);
      return { ok: false as const, status: 500, error: safeError(error) };
    }
  });

const getStatusSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

export const getPixStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .inputValidator((input: unknown) => getStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      await assertPaymentTestAdmin(context.userId);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NEXUSPAG_TIMEOUT_MS);
      const res = await fetch(`${BASE_URL}/api/pix/${encodeURIComponent(data.id)}`, {
        method: "GET",
        headers: { "x-api-key": getApiKey() },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const json = await readJsonResponse(res);
      if (!res.ok) {
        console.warn("[nexuspag-test] status falhou", res.status, json);
        return { ok: false as const, status: res.status, error: json };
      }
      return { ok: true as const, data: json };
    } catch (error) {
      console.warn("[nexuspag-test] erro ao consultar status", error);
      return { ok: false as const, status: 500, error: safeError(error) };
    }
  });

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isValidCpf, onlyDigits } from "@/lib/cpf";

const IMPULSEPAY_BASE_URL = "https://api.impulse-pay.com/v1";
const REQUEST_TIMEOUT_MS = 20_000;

export type ImpulsePayCustomer = {
  name: string;
  email: string;
  phone: string;
  document: {
    number: string;
    type: "CPF" | "CNPJ";
  };
};

export type ImpulsePayTransaction = {
  id: string;
  status: string;
  amount: number;
  currency?: string;
  fee?: number;
  net_amount?: number;
  payment_method?: string;
  method?: string;
  customer?: Record<string, unknown>;
  items?: Array<{
    external_ref?: string;
    product?: { external_ref?: string };
  }>;
  pix?: {
    copy_paste?: string;
    end_to_end?: string | null;
    expires_at?: string;
  };
  payer?: { name?: string } | null;
  paid_at?: string | null;
  refund_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ImpulsePayWithdrawal = {
  id: string;
  status: "PENDING_ANALYSIS" | "PROCESSING" | "COMPLETED" | "REFUSED" | "CANCELLED";
  amount: number;
  net_amount: number;
  fee: number;
  pix_key: string;
  pix_key_type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  auto_withdraw: boolean;
  created_at: string;
};

export class ImpulsePayConfigurationError extends Error {
  code = "PAYMENT_CONFIG_ERROR" as const;
}

export class ImpulsePayRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function getRequiredEnv(name: "IMPULSEPAY_PUBLIC_KEY" | "IMPULSEPAY_SECRET_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new ImpulsePayConfigurationError(`${name} não configurada`);
  return value;
}

function authorizationHeader() {
  const credentials = `${getRequiredEnv("IMPULSEPAY_PUBLIC_KEY")}:${getRequiredEnv("IMPULSEPAY_SECRET_KEY")}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export function impulsePayIsConfigured() {
  return Boolean(
    process.env.IMPULSEPAY_PUBLIC_KEY?.trim() && process.env.IMPULSEPAY_SECRET_KEY?.trim(),
  );
}

export function getImpulsePayWebhookUrl(): string | undefined {
  const configured = process.env.IMPULSEPAY_WEBHOOK_URL?.trim();
  if (!configured) return undefined;

  const url = new URL(configured);
  const localHttp =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((!localHttp && url.protocol !== "https:") || url.pathname !== "/api/public/impulsepay-webhook") {
    throw new ImpulsePayConfigurationError("IMPULSEPAY_WEBHOOK_URL inválida");
  }

  const token = process.env.IMPULSEPAY_WEBHOOK_TOKEN?.trim();
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ImpulsePayRequestError(
      "A Impulse Pay retornou uma resposta inválida.",
      response.status,
      response.status >= 500,
    );
  }
}

function errorMessage(status: number) {
  if (status === 400 || status === 422) return "Confira os dados do pagamento e tente novamente.";
  if (status === 401) return "A integração com a Impulse Pay não está autorizada.";
  if (status === 404) return "A cobrança não foi encontrada na Impulse Pay.";
  if (status === 429) return "Muitas tentativas de pagamento. Aguarde um instante.";
  return "A Impulse Pay está temporariamente indisponível.";
}

async function impulseFetch(
  path: string,
  init: RequestInit = {},
  options: { safeToRetry?: boolean; withdrawal?: boolean } = {},
) {
  const attempts = options.safeToRetry ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const headers = new Headers(init.headers);
      headers.set("Authorization", authorizationHeader());
      headers.set("Accept", "application/json");
      if (init.body) headers.set("Content-Type", "application/json");
      if (options.withdrawal) {
        const withdrawalKey = process.env.IMPULSEPAY_WITHDRAWAL_KEY?.trim();
        if (!withdrawalKey) {
          throw new ImpulsePayConfigurationError("IMPULSEPAY_WITHDRAWAL_KEY não configurada");
        }
        headers.set("x-withdrawal-key", withdrawalKey);
      }

      const response = await fetch(`${IMPULSEPAY_BASE_URL}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      const data = await parseJson(response);
      if (response.ok) return data;

      const retryable = response.status === 429 || response.status >= 500;
      const error = new ImpulsePayRequestError(errorMessage(response.status), response.status, retryable);
      if (!retryable || attempt === attempts - 1) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof ImpulsePayConfigurationError) throw error;
      if (error instanceof ImpulsePayRequestError && !error.retryable) throw error;
      lastError = error;
      if (attempt === attempts - 1) {
        if (error instanceof ImpulsePayRequestError) throw error;
        throw new ImpulsePayRequestError(
          error instanceof Error && error.name === "AbortError"
            ? "A Impulse Pay demorou para responder. Tente novamente."
            : "Não foi possível conectar à Impulse Pay.",
          0,
          true,
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
  }

  throw lastError;
}

function unwrapData<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "data" in raw) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export async function getImpulsePayCustomer(userId: string): Promise<ImpulsePayCustomer> {
  const [{ data: identity, error: identityError }, authResult] = await Promise.all([
    supabaseAdmin
      .from("identity_verifications")
      .select("cpf, full_name, phone, status")
      .eq("user_id", userId)
      .eq("status", "verified")
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ]);

  const user = authResult.data.user;
  const email = user?.email?.trim().toLowerCase() ?? "";
  const phone = onlyDigits(identity?.phone ?? user?.phone ?? "");
  const cpf = onlyDigits(identity?.cpf ?? "");
  const fullName = identity?.full_name?.trim() ?? "";

  if (identityError || !identity || !isValidCpf(cpf)) {
    throw new Error("Confirme sua identidade e seu CPF antes de pagar.");
  }
  if (fullName.split(/\s+/).filter(Boolean).length < 2) {
    throw new Error("Atualize a verificação com seu nome completo antes de pagar.");
  }
  if (!/^\d{10,11}$/.test(phone)) {
    throw new Error("Confirme um telefone com DDD antes de pagar.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Confirme um e-mail válido antes de pagar.");
  }

  return {
    name: fullName,
    email,
    phone,
    document: { number: cpf, type: "CPF" },
  };
}

export async function createImpulsePayPix(input: {
  amountCents: number;
  title: string;
  externalRef: string;
  customer: ImpulsePayCustomer;
  utm?: string | null;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Valor inválido para cobrança Pix");
  }

  const postbackUrl = getImpulsePayWebhookUrl();
  const body = {
    amount: input.amountCents,
    payment_method: "PIX",
    ...(postbackUrl ? { postback_url: postbackUrl } : {}),
    items: [
      {
        title: input.title.trim().slice(0, 255),
        unit_price: input.amountCents,
        quantity: 1,
        tangible: false,
        external_ref: input.externalRef,
      },
    ],
    customer: input.customer,
    ...(input.utm ? { utm: input.utm } : {}),
  };

  const transaction = unwrapData<ImpulsePayTransaction>(
    await impulseFetch("/transactions", { method: "POST", body: JSON.stringify(body) }),
  );
  if (!transaction?.id || !transaction.pix?.copy_paste) {
    throw new ImpulsePayRequestError(
      "A Impulse Pay não retornou um código Pix válido.",
      502,
      true,
    );
  }
  if (transaction.amount !== input.amountCents) {
    throw new ImpulsePayRequestError("O valor retornado pela Impulse Pay diverge da compra.", 502, false);
  }

  return transaction;
}

export async function getImpulsePayTransaction(id: string) {
  return unwrapData<ImpulsePayTransaction>(
    await impulseFetch(`/transactions/${encodeURIComponent(id)}`, {}, { safeToRetry: true }),
  );
}

export async function getImpulsePayBalance() {
  return unwrapData<{ available: number; reserved: number }>(
    await impulseFetch("/company/balance", {}, { safeToRetry: true }),
  );
}

export async function createImpulsePayWithdrawal(input: {
  amountCents: number;
  pixKey: string;
  pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  document?: string | null;
}) {
  const postbackUrl = getImpulsePayWebhookUrl();
  const body = {
    amount: input.amountCents,
    pix_key: input.pixKey,
    pix_key_type: input.pixKeyType,
    ...(input.document ? { document: onlyDigits(input.document) } : {}),
    ...(postbackUrl ? { postback_url: postbackUrl } : {}),
  };
  return unwrapData<ImpulsePayWithdrawal>(
    await impulseFetch(
      "/transfers",
      { method: "POST", body: JSON.stringify(body) },
      { withdrawal: true },
    ),
  );
}

export function toImpulsePayPixKeyType(
  value: "cpf" | "cnpj" | "email" | "phone" | "random",
): "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" {
  return value === "random" ? "EVP" : value.toUpperCase() as "CPF" | "CNPJ" | "EMAIL" | "PHONE";
}

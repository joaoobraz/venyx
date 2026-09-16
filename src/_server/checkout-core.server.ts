import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAccountsActive } from "@/_server/account-pause.server";
import { assertRateLimit } from "@/_server/rate-limit.server";
import {
  createImpulsePayPix,
  getImpulsePayCustomer,
  ImpulsePayConfigurationError,
  ImpulsePayRequestError,
} from "@/_server/impulsepay.server";

/**
 * Núcleo compartilhado de cobrança Pix (server-only).
 *
 * Fica num módulo .server.ts — e não exportado de um *.functions.ts — porque
 * exports de arquivos de server functions sobrevivem no bundle do navegador
 * e arrastariam código de servidor (getRequest etc.) para o cliente.
 */

export type PaymentGatewayError = {
  ok: false;
  code:
    | "PAYMENT_CONFIG_ERROR"
    | "PAYMENT_TIMEOUT"
    | "PAYMENT_GATEWAY_ERROR"
    | "PAYMENT_INVALID_RESPONSE";
  error: string;
  retryable: boolean;
};

export type NormalizedPix = {
  id: string;
  qrCode: string;
  expiresAt: string | null;
};

export function gatewayError(
  code: PaymentGatewayError["code"],
  error: string,
  retryable = true,
): PaymentGatewayError {
  return { ok: false, code, error, retryable };
}

/**
 * Recusa por dados (400/422) com motivo da adquirente: devolve o motivo em
 * linguagem de usuário. Valores em centavos viram R$.
 */
function humanizeProviderRefusal(error: ImpulsePayRequestError): string | null {
  if (error.status !== 400 && error.status !== 422) return null;
  const raw = error.providerMessage?.trim();
  if (!raw) return null;
  const cents = raw.match(/(\d+)\s*centavos/i);
  if (/m[ií]nimo/i.test(raw) && cents) {
    const value = (Number(cents[1]) / 100).toFixed(2).replace(".", ",");
    return `Valor mínimo por pagamento: R$ ${value}.`;
  }
  if (/m[aá]ximo/i.test(raw) && cents) {
    const value = (Number(cents[1]) / 100).toFixed(2).replace(".", ",");
    return `Valor máximo por pagamento: R$ ${value}.`;
  }
  // Outros motivos: mostra o texto da adquirente, curto e sem dados técnicos.
  return raw.length <= 140 ? raw.replace(/(\d+)\s*centavos/gi, (_m, c) => `R$ ${(Number(c) / 100).toFixed(2).replace(".", ",")}`) : null;
}

export async function callImpulsePay(
  userId: string,
  amountCents: number,
  description: string,
  externalId: string,
): Promise<{ ok: true; pix: NormalizedPix } | PaymentGatewayError> {
  try {
    const customer = await getImpulsePayCustomer(userId);
    const transaction = await createImpulsePayPix({
      amountCents,
      title: description,
      externalRef: externalId,
      customer,
    });
    return {
      ok: true,
      pix: {
        id: transaction.id,
        qrCode: transaction.pix?.copy_paste ?? "",
        expiresAt: transaction.pix?.expires_at ?? null,
      },
    };
  } catch (error) {
    console.error(
      "[impulsepay] falha ao criar Pix",
      error instanceof Error ? error.name : "unknown",
    );
    if (error instanceof ImpulsePayConfigurationError) {
      return gatewayError("PAYMENT_CONFIG_ERROR", "Pagamento indisponível no momento.", false);
    }
    if (error instanceof ImpulsePayRequestError) {
      return gatewayError(
        error.status === 0 ? "PAYMENT_TIMEOUT" : "PAYMENT_GATEWAY_ERROR",
        humanizeProviderRefusal(error) ?? error.message,
        error.retryable,
      );
    }
    return gatewayError(
      "PAYMENT_GATEWAY_ERROR",
      error instanceof Error ? error.message : "Falha ao gerar Pix. Tente novamente.",
      false,
    );
  }
}

export async function assertCreatorCanMonetize(creatorId: string, payerId?: string) {
  if (payerId) {
    // Anti-abuso: evita spam de cobranças na ImpulsePay por uma única conta.
    await assertRateLimit(
      `charge:${payerId}`,
      30,
      10 * 60,
      "Você gerou muitas cobranças em pouco tempo. Aguarde alguns minutos.",
    );
  }
  await assertAccountsActive([creatorId, payerId]);
  const { data, error } = await supabaseAdmin.rpc("creator_onboarding_status", {
    _user_id: creatorId,
  });
  if (error) {
    console.error("[checkout.creator-readiness]", error.code);
    throw new Error("Não foi possível verificar a configuração da criadora.");
  }
  const status = Array.isArray(data) ? data[0] : data;
  if (!status?.kyc_approved) throw new Error("Esta criadora ainda não concluiu o KYC.");
  if (!status?.consent_complete)
    throw new Error("Esta criadora ainda não atualizou os consentimentos obrigatórios.");
  if (!status?.profile_complete) throw new Error("Esta criadora ainda não concluiu o perfil.");
  if (!status?.payout_key_configured)
    throw new Error("Esta criadora ainda não cadastrou uma chave de recebimento válida.");
}

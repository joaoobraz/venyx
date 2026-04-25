import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fulfillPaidCharge } from "@/server/payments-fulfillment.server";

const BASE_URL = "https://nexuspag.com";
const PROJECT_ID = "59549983-d8c7-43dd-bb65-ffb37fd041ca";
const NEXUSPAG_TIMEOUT_MS = 20_000;

function getWebhookUrl(): string {
  return process.env.PUBLIC_WEBHOOK_URL ?? `https://project--${PROJECT_ID}.lovable.app/api/public/nexuspag-webhook`;
}

function getApiKey(): string {
  const key = process.env.NEXUSPAG_API_KEY;
  if (!key) throw new Error("Pagamento indisponível no momento");
  return key;
}

interface NexusPagPixResponse {
  id?: string;
  transaction_id?: string;
  txid?: string;
  qr_code?: string;
  qr_code_text?: string;
  qr_code_base64?: string;
  pix_copia_cola?: string;
  pix_copy_paste?: string;
  copy_paste?: string;
  qr_code_image?: string;
  status?: string;
  amount?: number;
  paid_at?: string;
  payer_name?: string;
  expires_at?: string;
  data?: unknown;
  transaction?: unknown;
  [k: string]: unknown;
}

type PaymentGatewayError = {
  ok: false;
  code: "PAYMENT_CONFIG_ERROR" | "PAYMENT_TIMEOUT" | "PAYMENT_GATEWAY_ERROR" | "PAYMENT_INVALID_RESPONSE";
  error: string;
  retryable: boolean;
};

type NormalizedPix = {
  id: string | null;
  qrCode: string;
  qrCodeBase64: string | null;
  expiresAt: string | null;
  raw: NexusPagPixResponse;
};

function gatewayError(code: PaymentGatewayError["code"], error: string, retryable = true): PaymentGatewayError {
  return { ok: false, code, error, retryable };
}

function unwrapNexusPayload(raw: unknown): NexusPagPixResponse {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  return ((data?.transaction ?? root.transaction ?? data ?? root) ?? {}) as NexusPagPixResponse;
}

function normalizePix(raw: NexusPagPixResponse): NormalizedPix | null {
  const tx = unwrapNexusPayload(raw);
  const qrCode = tx.qr_code ?? tx.qr_code_text ?? tx.pix_copia_cola ?? tx.pix_copy_paste ?? tx.copy_paste ?? null;
  if (!qrCode) return null;

  return {
    id: tx.id ?? tx.transaction_id ?? tx.txid ?? null,
    qrCode,
    qrCodeBase64: tx.qr_code_base64 ?? tx.qr_code_image ?? null,
    expiresAt: tx.expires_at ?? null,
    raw,
  };
}

async function readJsonResponse(res: Response): Promise<NexusPagPixResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text) as NexusPagPixResponse;
  } catch {
    return { raw: text } as NexusPagPixResponse;
  }
}

async function callNexusPag(
  amountReais: number,
  description: string,
  externalId: string,
  expirationSeconds = 1800,
): Promise<{ ok: true; pix: NormalizedPix } | PaymentGatewayError> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (e) {
    console.error("[nexuspag] chave ausente", e);
    return gatewayError("PAYMENT_CONFIG_ERROR", "Pagamento indisponível no momento.", false);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEXUSPAG_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/pix/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        amount: amountReais,
        description,
        external_id: externalId,
        expiration_seconds: expirationSeconds,
        webhook_url: getWebhookUrl(),
      }),
    });
    const json = await readJsonResponse(res);
    if (!res.ok) {
      console.error("[nexuspag] erro", res.status, json);
      return gatewayError("PAYMENT_GATEWAY_ERROR", "Falha ao gerar Pix. Tente novamente.", res.status >= 500);
    }

    const pix = normalizePix(json);
    if (!pix) {
      console.error("[nexuspag] resposta sem código Pix", json);
      return gatewayError("PAYMENT_INVALID_RESPONSE", "O provedor não retornou o código Pix. Tente novamente.");
    }
    return { ok: true, pix };
  } catch (e) {
    console.error("[nexuspag] timeout/erro de rede", e);
    return gatewayError("PAYMENT_TIMEOUT", "O serviço Pix demorou para responder. Tente novamente.");
  } finally {
    clearTimeout(timeout);
  }
}

async function checkNexusPagStatus(lookupId: string): Promise<NexusPagPixResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEXUSPAG_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/pix/${encodeURIComponent(lookupId)}`, {
      method: "GET",
      headers: { "x-api-key": getApiKey() },
      signal: controller.signal,
    });
    const json = await readJsonResponse(res);
    if (!res.ok) {
      console.warn("[nexuspag] status falhou", res.status, json);
      return null;
    }
    return unwrapNexusPayload(json);
  } catch (e) {
    console.warn("[nexuspag] status indisponível", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// =====================================================
// Cobrança Pix da assinatura (com bumps opcionais)
// =====================================================
const subPixSchema = z.object({
  creatorId: z.string().uuid(),
  months: z.number().int().min(1).max(24),
  pricePerMonthCents: z.number().int().min(100).max(1_000_000),
  couponCode: z.string().trim().min(1).max(50).optional().nullable(),
  bumpOfferIds: z.array(z.string().uuid()).max(3).default([]),
});

export const createSubscriptionPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => subPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.creatorId === userId) throw new Error("Você não pode assinar a si mesmo");

    // Cupom (validar trial / desconto no servidor)
    let trialDays = 0;
    let discountPct = 0;
    let couponId: string | null = null;
    if (data.couponCode) {
      const { data: c } = await supabaseAdmin
        .from("subscription_coupons")
        .select("id, trial_days, discount_pct, max_uses, uses_count, is_active")
        .eq("code", data.couponCode)
        .eq("creator_id", data.creatorId)
        .eq("is_active", true)
        .maybeSingle();
      if (c && c.uses_count < c.max_uses) {
        couponId = c.id;
        trialDays = c.trial_days ?? 0;
        discountPct = c.discount_pct ?? 0;
      }
    }

    const subSubtotal = data.pricePerMonthCents * data.months;
    const subDiscounted = discountPct ? Math.round(subSubtotal * (1 - discountPct / 100)) : subSubtotal;
    const isTrial = trialDays > 0;

    // Bumps: validar ofertas pertencem à criadora
    let bumpsTotal = 0;
    const validatedBumps: { id: string; price: number }[] = [];
    if (data.bumpOfferIds.length > 0) {
      const { data: bumps } = await supabaseAdmin
        .from("upsell_offers")
        .select("id, price_cents")
        .in("id", data.bumpOfferIds)
        .eq("creator_id", data.creatorId)
        .eq("kind", "order_bump")
        .eq("is_active", true);
      for (const b of bumps ?? []) {
        bumpsTotal += b.price_cents;
        validatedBumps.push({ id: b.id, price: b.price_cents });
      }
    }

    // Caso trial: assinatura é grátis, cobramos só os bumps (se houver)
    const totalCents = (isTrial ? 0 : subDiscounted) + bumpsTotal;

    if (totalCents === 0) {
      // Trial puro sem bumps → ativa direto sem Pix
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + trialDays);
      const { error: se } = await supabaseAdmin.from("subscriptions").insert({
        subscriber_id: userId,
        creator_id: data.creatorId,
        price_cents: data.pricePerMonthCents,
        status: "active",
        current_period_end: periodEnd.toISOString(),
      });
      if (se && !se.message.includes("duplicate")) throw new Error("Falha ao ativar trial");
      if (couponId) {
        await supabaseAdmin.from("coupon_redemptions").insert({ coupon_id: couponId, user_id: userId });
      }
      return { freeTrialActivated: true, isTrial: true, trialDays };
    }

    const externalId = `sub_${userId.slice(0, 8)}_${Date.now()}`;
    const description = isTrial
      ? `Assinatura trial + extras`
      : `Assinatura ${data.months}m${bumpsTotal > 0 ? " + extras" : ""}`;

    const gateway = await callNexusPag(totalCents / 100, description, externalId);
    if (!gateway.ok) return gateway;
    const px = gateway.pix;

    // Grava charge interna
    const { data: charge, error: ce } = await supabaseAdmin
      .from("pix_charges")
      .insert({
        external_id: externalId,
        gateway_transaction_id: px.id,
        payer_id: userId,
        payee_id: data.creatorId,
        purpose: "subscription",
        amount_cents: totalCents,
        status: "pending",
        qr_code: px.qrCode,
        qr_code_base64: px.qrCodeBase64,
        expires_at: px.expiresAt,
        metadata: {
          months: data.months,
          coupon: couponId,
          bumps: validatedBumps,
          sub_amount_cents: isTrial ? 0 : subDiscounted,
          is_trial: isTrial,
          trial_days: trialDays,
        },
      })
      .select("id, qr_code, qr_code_base64, expires_at, external_id")
      .single();

    if (ce || !charge) {
      console.error("[createSubscriptionPixCharge] erro", ce);
      throw new Error("Falha ao registrar cobrança");
    }

    return {
      chargeId: charge.id,
      externalId: charge.external_id,
      qrCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      expiresAt: charge.expires_at,
      amountCents: totalCents,
    };
  });

// =====================================================
// Cobrança Pix do upsell pós-pagamento
// =====================================================
const upsellPixSchema = z.object({
  offerId: z.string().uuid(),
});

export const createUpsellPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsellPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: offer } = await supabaseAdmin
      .from("upsell_offers")
      .select("id, creator_id, kind, title, price_cents, is_active")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!offer || !offer.is_active) throw new Error("Oferta indisponível");
    if (offer.creator_id === userId) throw new Error("Você não pode comprar sua própria oferta");

    const externalId = `ups_${userId.slice(0, 8)}_${Date.now()}`;
    const gateway = await callNexusPag(offer.price_cents / 100, offer.title, externalId);
    if (!gateway.ok) return gateway;
    const px = gateway.pix;

    const { data: charge, error: ce } = await supabaseAdmin
      .from("pix_charges")
      .insert({
        external_id: externalId,
        gateway_transaction_id: px.id,
        payer_id: userId,
        payee_id: offer.creator_id,
        purpose: "upsell",
        amount_cents: offer.price_cents,
        status: "pending",
        qr_code: px.qrCode,
        qr_code_base64: px.qrCodeBase64,
        expires_at: px.expiresAt,
        reference_id: offer.id,
        metadata: { offer_id: offer.id, origin: "upsell" },
      })
      .select("id, qr_code, qr_code_base64, expires_at, external_id")
      .single();

    if (ce || !charge) throw new Error("Falha ao registrar cobrança");

    return {
      chargeId: charge.id,
      externalId: charge.external_id,
      qrCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      expiresAt: charge.expires_at,
      amountCents: offer.price_cents,
    };
  });

// =====================================================
// Polling de status (usado pelo modal pra detectar paid)
// =====================================================
const statusSchema = z.object({ chargeId: z.string().uuid() });

export const getChargeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: charge } = await supabaseAdmin
      .from("pix_charges")
      .select("id, status, paid_at, payer_id")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!charge || charge.payer_id !== context.userId) {
      throw new Error("Cobrança não encontrada");
    }
    return { status: charge.status, paidAt: charge.paid_at };
  });

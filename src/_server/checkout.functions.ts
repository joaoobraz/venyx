import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdultVerification } from "@/_server/access-control.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fulfillPaidCharge } from "@/_server/payments-fulfillment.server";
import { assertAccountsActive } from "@/_server/account-pause.server";

const BASE_URL = "https://nexuspag.com";
const NEXUSPAG_TIMEOUT_MS = 20_000;

function getWebhookUrl(): string {
  const configured = process.env.PUBLIC_WEBHOOK_URL;
  if (!configured) throw new Error("Pagamento indisponível no momento");
  const url = new URL(configured);
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.pathname !== "/api/public/nexuspag-webhook"
  ) {
    throw new Error("Pagamento indisponível no momento");
  }
  return url.toString();
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
  code:
    | "PAYMENT_CONFIG_ERROR"
    | "PAYMENT_TIMEOUT"
    | "PAYMENT_GATEWAY_ERROR"
    | "PAYMENT_INVALID_RESPONSE";
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

function gatewayError(
  code: PaymentGatewayError["code"],
  error: string,
  retryable = true,
): PaymentGatewayError {
  return { ok: false, code, error, retryable };
}

function unwrapNexusPayload(raw: unknown): NexusPagPixResponse {
  const root = (raw ?? {}) as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  return (data?.transaction ?? root.transaction ?? data ?? root ?? {}) as NexusPagPixResponse;
}

function normalizePix(raw: NexusPagPixResponse): NormalizedPix | null {
  const tx = unwrapNexusPayload(raw);
  const qrCode =
    tx.qr_code ??
    tx.qr_code_text ??
    tx.pix_copia_cola ??
    tx.pix_copy_paste ??
    tx.copy_paste ??
    null;
  const id = tx.id ?? tx.transaction_id ?? tx.txid ?? null;
  if (!qrCode || !id) return null;

  return {
    id,
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
        expiration: expirationSeconds,
        webhook_url: getWebhookUrl(),
      }),
    });
    const json = await readJsonResponse(res);
    if (!res.ok) {
      console.error("[nexuspag] erro", res.status, json);
      return gatewayError(
        "PAYMENT_GATEWAY_ERROR",
        "Falha ao gerar Pix. Tente novamente.",
        res.status >= 500,
      );
    }

    const pix = normalizePix(json);
    if (!pix) {
      console.error("[nexuspag] resposta sem código Pix", json);
      return gatewayError(
        "PAYMENT_INVALID_RESPONSE",
        "O provedor não retornou o código Pix. Tente novamente.",
      );
    }
    return { ok: true, pix };
  } catch (e) {
    console.error("[nexuspag] timeout/erro de rede", e);
    return gatewayError(
      "PAYMENT_TIMEOUT",
      "O serviço Pix demorou para responder. Tente novamente.",
    );
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

async function assertCreatorCanMonetize(creatorId: string, payerId?: string) {
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

// =====================================================
// Cobrança Pix da assinatura (com bumps opcionais)
// =====================================================
const subPixSchema = z.object({
  creatorId: z.string().uuid(),
  months: z
    .number()
    .int()
    .refine((value) => [1, 3, 6, 12].includes(value)),
  // pricePerMonthCents é IGNORADO no servidor — mantido só para compat com chamadas antigas.
  // O preço canônico vem de subscription_plans.
  pricePerMonthCents: z.number().int().min(0).max(1_000_000).optional(),
  couponCode: z.string().trim().min(1).max(50).optional().nullable(),
  bumpOfferIds: z.array(z.string().uuid()).max(3).default([]),
});

export const createSubscriptionPixCharge = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .inputValidator((input: unknown) => subPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.creatorId === userId) throw new Error("Você não pode assinar a si mesmo");
    await assertCreatorCanMonetize(data.creatorId, userId);

    // SECURITY: preço canônico vem do banco, NUNCA do cliente.
    const { data: selectedPlan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, months, price_cents, discount_pct")
      .eq("creator_id", data.creatorId)
      .eq("months", data.months)
      .eq("is_active", true)
      .maybeSingle();
    if (planError || !selectedPlan) {
      throw new Error("Este plano não está mais disponível. Escolha outro período.");
    }
    const pricePerMonthCents = selectedPlan.price_cents;
    if (pricePerMonthCents < 100) {
      throw new Error("Este plano possui um preço inválido.");
    }

    // Cupom (validar trial / desconto no servidor)
    let trialDays = 0;
    let discountPct = 0;
    let discountAmountCents: number | null = null;
    let fixedPriceCents: number | null = null;
    let couponOfferType: string | null = null;
    let postTrialPriceCents: number | null = null;
    let autoRenewAfterTrial = false;
    let couponId: string | null = null;
    if (data.couponCode) {
      const { data: c } = await supabaseAdmin
        .from("subscription_coupons")
        .select(
          "id, offer_type, trial_days, discount_pct, discount_amount_cents, fixed_price_cents, duration_months, max_uses, uses_count, eligibility, expires_at, post_trial_price_cents, auto_renew_after_trial, is_active",
        )
        .eq("code", data.couponCode)
        .eq("creator_id", data.creatorId)
        .eq("is_active", true)
        .maybeSingle();
      const hasExpired = Boolean(c?.expires_at && new Date(c.expires_at).getTime() <= Date.now());
      if (c && !hasExpired && (c.max_uses === 0 || c.uses_count < c.max_uses)) {
        const { data: existingRedemption } = await supabaseAdmin
          .from("coupon_redemptions")
          .select("id")
          .eq("coupon_id", c.id)
          .eq("user_id", userId)
          .maybeSingle();
        const durationMatches =
          c.offer_type === "trial" ||
          (c.offer_type === "first_month" && data.months === 1) ||
          c.duration_months === data.months;
        const { data: previousSubscription } = await supabaseAdmin
          .from("subscriptions")
          .select("id, status")
          .eq("creator_id", data.creatorId)
          .eq("subscriber_id", userId)
          .limit(1)
          .maybeSingle();
        const wasSubscriber = Boolean(previousSubscription);
        const hasActiveSubscription = previousSubscription?.status === "active";
        const isEligible =
          !hasActiveSubscription &&
          (c.eligibility === "new_and_former" ||
            (c.eligibility === "new_subscribers" && !wasSubscriber) ||
            (c.eligibility === "former_subscribers" && wasSubscriber));
        if (!existingRedemption && durationMatches && isEligible) {
          couponId = c.id;
          trialDays = c.trial_days ?? 0;
          discountPct = c.discount_pct ?? 0;
          discountAmountCents = c.discount_amount_cents ?? null;
          fixedPriceCents = c.fixed_price_cents ?? null;
          couponOfferType = c.offer_type;
          postTrialPriceCents = c.post_trial_price_cents ?? null;
          autoRenewAfterTrial = c.auto_renew_after_trial;
        }
      }
      if (!couponId) {
        throw new Error("Cupom inválido, esgotado ou já utilizado");
      }
    }

    const subSubtotal = pricePerMonthCents * data.months;
    if (fixedPriceCents && fixedPriceCents > subSubtotal) {
      throw new Error("O preço promocional não pode superar o valor normal do plano");
    }
    if (discountAmountCents && discountAmountCents >= subSubtotal) {
      throw new Error("O desconto fixo precisa ser menor que o valor normal do plano");
    }
    const subDiscounted = fixedPriceCents
      ? fixedPriceCents
      : discountAmountCents
        ? Math.max(100, subSubtotal - discountAmountCents)
      : discountPct
        ? Math.round(subSubtotal * (1 - discountPct / 100))
        : subSubtotal;
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
      if (!couponId) throw new Error("Cupom de trial inválido");
      const { data: trialResult, error: trialError } = await supabaseAdmin.rpc(
        "activate_coupon_trial",
        {
          _creator_id: data.creatorId,
          _subscriber_id: userId,
          _coupon_id: couponId,
        },
      );
      if (trialError) throw new Error("Falha ao ativar trial");
      const result = trialResult as { error?: string; trial_days?: number };
      if (result.error) {
        const messages: Record<string, string> = {
          invalid_coupon: "Este cupom não está mais disponível.",
          coupon_already_used: "Você já utilizou este cupom.",
          already_subscribed: "Você já possui uma assinatura ativa.",
        };
        throw new Error(messages[result.error] ?? "Não foi possível ativar o trial");
      }
      return {
        freeTrialActivated: true,
        isTrial: true,
        trialDays: result.trial_days ?? trialDays,
      };
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
          plan_id: selectedPlan.id,
          plan_unit_price_cents: selectedPlan.price_cents,
          plan_discount_pct: selectedPlan.discount_pct,
          months: data.months,
          coupon: couponId,
          coupon_offer_type: couponOfferType,
          coupon_discount_pct: discountPct || null,
          coupon_discount_amount_cents: discountAmountCents,
          coupon_fixed_price_cents: fixedPriceCents,
          coupon_post_trial_price_cents: postTrialPriceCents,
          coupon_auto_renew_after_trial: autoRenewAfterTrial,
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

    if (couponId) {
      const reservationExpiry =
        charge.expires_at ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { error: reservationError } = await supabaseAdmin.rpc("reserve_coupon_use", {
        _coupon_id: couponId,
        _user_id: userId,
        _pix_charge_id: charge.id,
        _expires_at: reservationExpiry,
      });
      if (reservationError) {
        await supabaseAdmin
          .from("pix_charges")
          .update({ status: "cancelled" })
          .eq("id", charge.id)
          .eq("status", "pending");
        const message = reservationError.message ?? "";
        if (message.includes("VENYX_COUPON_ALREADY_RESERVED")) {
          throw new Error("Você já possui um Pix pendente usando este cupom");
        }
        if (message.includes("VENYX_COUPON_ALREADY_USED")) {
          throw new Error("Você já utilizou este cupom");
        }
        throw new Error("As vagas desta oferta acabaram");
      }
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
  .middleware([requireAdultVerification])
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
    await assertCreatorCanMonetize(offer.creator_id, userId);

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
// Cobrança Pix de gorjeta (mimo)
// =====================================================
const tipPixSchema = z
  .object({
    creatorId: z.string().uuid(),
    amountCents: z.number().int().min(100).max(1_000_000),
    postId: z.string().uuid().optional().nullable(),
    giftItemId: z.string().uuid().optional(),
    message: z.string().max(200).optional().nullable(),
  })
  .refine((value) => !(value.postId && value.giftItemId), {
    message: "Um produto da Lista de Mimos não pode estar associado a uma publicação",
  });

export const createTipPixCharge = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .inputValidator((input: unknown) => tipPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.creatorId === userId) throw new Error("Você não pode enviar gorjeta para si mesmo");
    await assertCreatorCanMonetize(data.creatorId, userId);

    let amountCents = data.amountCents;
    let gift: { id: string; title: string; value_cents: number } | null = null;
    if (data.giftItemId) {
      const { data: item, error: giftError } = await supabaseAdmin
        .from("creator_gift_items")
        .select("id,title,value_cents,creator_id,is_active,track_stock,stock_quantity")
        .eq("id", data.giftItemId)
        .eq("creator_id", data.creatorId)
        .eq("is_active", true)
        .maybeSingle();
      const { data: list } = await supabaseAdmin
        .from("creator_gift_settings")
        .select("is_published")
        .eq("creator_id", data.creatorId)
        .eq("is_published", true)
        .maybeSingle();
      if (giftError || !item || !list || (item.track_stock && (item.stock_quantity ?? 0) <= 0))
        throw new Error("Este produto não está mais disponível.");
      gift = item;
      amountCents = item.value_cents;
    }

    const externalId = `${gift ? "gift" : "tip"}_${userId.slice(0, 8)}_${Date.now()}`;
    const description = gift
      ? `Produto da Lista de Mimos: ${gift.title}`
      : `Mimo R$ ${(amountCents / 100).toFixed(2)}`;
    const gateway = await callNexusPag(amountCents / 100, description, externalId);
    if (!gateway.ok) return gateway;
    const px = gateway.pix;

    const { data: charge, error: ce } = await supabaseAdmin
      .from("pix_charges")
      .insert({
        external_id: externalId,
        gateway_transaction_id: px.id,
        payer_id: userId,
        payee_id: data.creatorId,
        purpose: "tip",
        amount_cents: amountCents,
        status: "pending",
        qr_code: px.qrCode,
        qr_code_base64: px.qrCodeBase64,
        expires_at: px.expiresAt,
        reference_id: gift?.id ?? data.postId ?? null,
        metadata: {
          message: data.message ?? null,
          post_id: data.postId ?? null,
          kind: gift ? "gift_product" : "tip",
          gift_item_id: gift?.id ?? null,
          gift_title: gift?.title ?? null,
        },
      })
      .select("id, qr_code, qr_code_base64, expires_at, external_id")
      .single();

    if (ce || !charge) {
      console.error("[createTipPixCharge] erro", ce);
      throw new Error("Falha ao registrar cobrança");
    }

    return {
      chargeId: charge.id,
      externalId: charge.external_id,
      qrCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      expiresAt: charge.expires_at,
      amountCents,
    };
  });

// =====================================================
// Cobrança Pix de PPV (post bloqueado)
// =====================================================
const ppvPixSchema = z.object({
  postId: z.string().uuid(),
});

export const createPpvPixCharge = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .inputValidator((input: unknown) => ppvPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, creator_id, price_cents, visibility, body")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) throw new Error("Post não encontrado");
    if (post.visibility !== "ppv") throw new Error("Este post não é PPV");
    if (post.creator_id === userId) throw new Error("Você não pode comprar seu próprio post");
    if (!post.price_cents || post.price_cents < 100) throw new Error("Preço PPV inválido");
    await assertCreatorCanMonetize(post.creator_id, userId);

    // Já desbloqueado?
    const { data: existing } = await supabaseAdmin
      .from("ppv_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", post.id)
      .maybeSingle();
    if (existing) {
      return { alreadyUnlocked: true as const };
    }

    const externalId = `ppv_${userId.slice(0, 8)}_${Date.now()}`;
    const description = `Desbloqueio PPV`;
    const gateway = await callNexusPag(post.price_cents / 100, description, externalId);
    if (!gateway.ok) return gateway;
    const px = gateway.pix;

    const { data: charge, error: ce } = await supabaseAdmin
      .from("pix_charges")
      .insert({
        external_id: externalId,
        gateway_transaction_id: px.id,
        payer_id: userId,
        payee_id: post.creator_id,
        purpose: "ppv",
        amount_cents: post.price_cents,
        status: "pending",
        qr_code: px.qrCode,
        qr_code_base64: px.qrCodeBase64,
        expires_at: px.expiresAt,
        reference_id: post.id,
        metadata: { post_id: post.id },
      })
      .select("id, qr_code, qr_code_base64, expires_at, external_id")
      .single();

    if (ce || !charge) {
      console.error("[createPpvPixCharge] erro", ce);
      throw new Error("Falha ao registrar cobrança");
    }

    return {
      chargeId: charge.id,
      externalId: charge.external_id,
      qrCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      expiresAt: charge.expires_at,
      amountCents: post.price_cents,
    };
  });

// =====================================================
// Cobrança Pix de contribuição para meta (goal)
// =====================================================
const goalPixSchema = z.object({
  postId: z.string().uuid(),
  amountCents: z.number().int().min(100).max(5_000_000).optional(),
});

export const createGoalPixCharge = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .inputValidator((input: unknown) => goalPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, creator_id, visibility")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) throw new Error("Post não encontrado");
    if (post.visibility !== "goal") throw new Error("Este post não tem meta");
    if (post.creator_id === userId) throw new Error("Você não pode contribuir no seu próprio post");
    await assertCreatorCanMonetize(post.creator_id, userId);

    const { data: goal } = await supabaseAdmin
      .from("post_goals")
      .select("target_cents, raised_cents, unlock_price_cents, is_unlocked")
      .eq("post_id", post.id)
      .maybeSingle();
    if (!goal) throw new Error("Meta não encontrada");
    if (goal.is_unlocked) throw new Error("Esta meta já foi atingida");
    if (!goal.unlock_price_cents || goal.unlock_price_cents < 100)
      throw new Error("Valor de contribuição inválido");

    const remainingCents = Math.max(0, goal.target_cents - goal.raised_cents);
    const amountCents = data.amountCents ?? goal.unlock_price_cents;
    if (amountCents < goal.unlock_price_cents) {
      throw new Error(
        `A contribuição mínima é de R$ ${(goal.unlock_price_cents / 100).toFixed(2).replace(".", ",")}`,
      );
    }
    if (amountCents > remainingCents) {
      throw new Error(
        `O valor máximo agora é R$ ${(remainingCents / 100).toFixed(2).replace(".", ",")}`,
      );
    }

    const externalId = `goal_${userId.slice(0, 8)}_${Date.now()}`;
    const description = `Contribuição para meta`;
    const gateway = await callNexusPag(amountCents / 100, description, externalId);
    if (!gateway.ok) return gateway;
    const px = gateway.pix;

    const { data: charge, error: ce } = await supabaseAdmin
      .from("pix_charges")
      .insert({
        external_id: externalId,
        gateway_transaction_id: px.id,
        payer_id: userId,
        payee_id: post.creator_id,
        purpose: "goal",
        amount_cents: amountCents,
        status: "pending",
        qr_code: px.qrCode,
        qr_code_base64: px.qrCodeBase64,
        expires_at: px.expiresAt,
        reference_id: post.id,
        metadata: {
          post_id: post.id,
          kind: "goal_contribution",
          minimum_amount_cents: goal.unlock_price_cents,
        },
      })
      .select("id, qr_code, qr_code_base64, expires_at, external_id")
      .single();

    if (ce || !charge) {
      console.error("[createGoalPixCharge] erro", ce);
      throw new Error("Falha ao registrar cobrança");
    }

    return {
      chargeId: charge.id,
      externalId: charge.external_id,
      qrCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      expiresAt: charge.expires_at,
      amountCents,
    };
  });

// =====================================================
// Cobrança Pix de PPV no chat (mensagem PPV)
// =====================================================
const chatPpvPixSchema = z.object({
  messageId: z.string().uuid(),
});

export const createChatPpvPixCharge = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .inputValidator((input: unknown) => chatPpvPixSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: msg } = await supabaseAdmin
      .from("chat_messages")
      .select("id, sender_id, ppv_price_cents, thread_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg) throw new Error("Mensagem não encontrada");
    if (msg.sender_id === userId) throw new Error("Você não pode comprar sua própria mídia");
    if (!msg.ppv_price_cents || msg.ppv_price_cents < 100) throw new Error("Mensagem não é PPV");
    await assertCreatorCanMonetize(msg.sender_id, userId);

    // Confirma que o usuário é participante da thread
    const { data: thread } = await supabaseAdmin
      .from("chat_threads")
      .select("user_a, user_b")
      .eq("id", msg.thread_id)
      .maybeSingle();
    if (!thread || (thread.user_a !== userId && thread.user_b !== userId)) {
      throw new Error("Acesso negado à conversa");
    }

    // Já desbloqueado?
    const { data: existing } = await supabaseAdmin
      .from("chat_ppv_unlocks")
      .select("message_id")
      .eq("message_id", msg.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      return { alreadyUnlocked: true as const };
    }

    const externalId = `cppv_${userId.slice(0, 8)}_${Date.now()}`;
    const description = `Desbloqueio mídia no chat`;
    const gateway = await callNexusPag(msg.ppv_price_cents / 100, description, externalId);
    if (!gateway.ok) return gateway;
    const px = gateway.pix;

    const { data: charge, error: ce } = await supabaseAdmin
      .from("pix_charges")
      .insert({
        external_id: externalId,
        gateway_transaction_id: px.id,
        payer_id: userId,
        payee_id: msg.sender_id,
        purpose: "chat_ppv",
        amount_cents: msg.ppv_price_cents,
        status: "pending",
        qr_code: px.qrCode,
        qr_code_base64: px.qrCodeBase64,
        expires_at: px.expiresAt,
        reference_id: msg.id,
        metadata: { message_id: msg.id, thread_id: msg.thread_id },
      })
      .select("id, qr_code, qr_code_base64, expires_at, external_id")
      .single();

    if (ce || !charge) {
      console.error("[createChatPpvPixCharge] erro", ce);
      throw new Error("Falha ao registrar cobrança");
    }

    return {
      chargeId: charge.id,
      externalId: charge.external_id,
      qrCode: charge.qr_code,
      qrCodeBase64: charge.qr_code_base64,
      expiresAt: charge.expires_at,
      amountCents: msg.ppv_price_cents,
    };
  });

// =====================================================
// Polling de status (usado pelo modal pra detectar paid)
// =====================================================
const statusSchema = z.object({ chargeId: z.string().uuid() });

export const getChargeStatus = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: charge } = await supabaseAdmin
      .from("pix_charges")
      .select("id, status, paid_at, payer_id, external_id, gateway_transaction_id, amount_cents")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!charge || charge.payer_id !== context.userId) {
      throw new Error("Cobrança não encontrada");
    }
    if (charge.status === "pending") {
      const gatewayCharge = await checkNexusPagStatus(
        charge.gateway_transaction_id ?? charge.external_id,
      );
      if (gatewayCharge?.status === "paid") {
        const confirmedId =
          gatewayCharge.transaction_id ?? gatewayCharge.id ?? gatewayCharge.txid ?? null;
        const confirmedExternalId =
          typeof gatewayCharge.external_id === "string" ? gatewayCharge.external_id : null;
        const confirmedAmount = Number(gatewayCharge.amount);
        const amountMatches =
          Number.isFinite(confirmedAmount) &&
          Math.round(confirmedAmount * 100) === charge.amount_cents;
        const transactionMatches = !confirmedId || confirmedId === charge.gateway_transaction_id;
        const externalIdMatches =
          !confirmedExternalId || confirmedExternalId === charge.external_id;

        if (!amountMatches || !transactionMatches || !externalIdMatches) {
          console.warn("[getChargeStatus] confirmação do gateway divergente", {
            amountMatches,
            transactionMatches,
            externalIdMatches,
          });
          return { status: "pending", paidAt: null };
        }

        const fulfillment = await fulfillPaidCharge({
          externalId: charge.external_id,
          gatewayTransactionId: charge.gateway_transaction_id,
          paidAt: gatewayCharge.paid_at ?? new Date().toISOString(),
          payerName: gatewayCharge.payer_name ?? null,
        });
        if (fulfillment.ok) {
          return {
            status: "paid",
            paidAt: gatewayCharge.paid_at ?? new Date().toISOString(),
          };
        }
        return { status: "pending", paidAt: null };
      }
      if (gatewayCharge?.status === "expired" || gatewayCharge?.status === "cancelled") {
        await supabaseAdmin
          .from("pix_charges")
          .update({ status: gatewayCharge.status })
          .eq("id", charge.id)
          .eq("status", "pending");
        await supabaseAdmin.rpc("release_coupon_reservation", {
          _pix_charge_id: charge.id,
        });
        return { status: gatewayCharge.status, paidAt: null };
      }
    }
    return { status: charge.status, paidAt: charge.paid_at };
  });

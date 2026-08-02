import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import { recordOperationalEvent } from "@/_server/observability.server";

type PixCharge = Tables<"pix_charges">;
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

function metadataOf(charge: PixCharge): { [key: string]: Json | undefined } {
  return typeof charge.metadata === "object" &&
    charge.metadata !== null &&
    !Array.isArray(charge.metadata)
    ? (charge.metadata as { [key: string]: Json | undefined })
    : {};
}

async function insertTransaction(row: TransactionInsert): Promise<void> {
  const { error } = await supabaseAdmin.from("transactions").insert(row);
  if (error && error.code !== "23505") throw error;
}

/**
 * Credita uma cobrança PIX paga: cria a `transaction` e o efeito colateral
 * correspondente (assinatura ativa, ppv_unlock, tip, etc.). Idempotente
 * por `external_id` — se já existe transação para a charge, retorna sem
 * duplicar.
 *
 * Chamado por:
 *  - Webhook público da NexusPag (caminho normal)
 *  - Polling manual de /test-pix (fallback de debug)
 */
export async function fulfillPaidCharge(opts: {
  externalId: string;
  gatewayTransactionId?: string | null;
  paidAt?: string | null;
  payerName?: string | null;
}): Promise<
  { ok: true; alreadyFulfilled: boolean; chargeId: string } | { ok: false; reason: string }
> {
  // 1) Encontra a charge interna
  const { data: charge, error: cErr } = await supabaseAdmin
    .from("pix_charges")
    .select("*")
    .eq("external_id", opts.externalId)
    .maybeSingle();

  if (cErr) {
    console.error("[fulfillPaidCharge] erro buscando charge", cErr);
    return { ok: false, reason: "Erro ao buscar cobrança" };
  }
  if (!charge) {
    return { ok: false, reason: "Cobrança não encontrada" };
  }

  // 2) Idempotência: já marcada como paga?
  if (charge.status === "paid") {
    return { ok: true, alreadyFulfilled: true, chargeId: charge.id };
  }

  // 3) Reserva a cobrança de forma atômica. Uma execução travada pode ser
  // retomada depois de cinco minutos; todos os efeitos abaixo são idempotentes.
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("pix_charges")
    .update({
      status: "processing",
      gateway_transaction_id: opts.gatewayTransactionId ?? charge.gateway_transaction_id,
      metadata: {
        ...metadataOf(charge),
        payer_name: opts.payerName ?? null,
      },
    })
    .eq("id", charge.id)
    .or(
      `status.in.(pending,expired,cancelled),and(status.eq.processing,updated_at.lt.${staleBefore})`,
    )
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("[fulfillPaidCharge] erro reservando charge", claimError);
    return { ok: false, reason: "Erro ao atualizar cobrança" };
  }
  if (!claimed) {
    const { data: current } = await supabaseAdmin
      .from("pix_charges")
      .select("status")
      .eq("id", charge.id)
      .maybeSingle();
    if (current?.status === "paid") {
      return { ok: true, alreadyFulfilled: true, chargeId: charge.id };
    }
    return { ok: false, reason: "Cobrança já está em processamento" };
  }

  // 4) Aplica o efeito e só então marca a cobrança como paga.
  try {
    switch (charge.purpose) {
      case "subscription":
        await fulfillSubscription(charge);
        break;
      case "ppv":
        await fulfillPpv(charge);
        break;
      case "tip":
        await fulfillTip(charge);
        break;
      case "goal":
        await fulfillGoal(charge);
        break;
      case "chat_ppv":
        await fulfillChatPpv(charge);
        break;
      case "upsell":
        await fulfillUpsell(charge);
        break;
      default:
        throw new Error(`Finalidade de cobrança inválida: ${charge.purpose}`);
    }

    const { data: paid, error: paidError } = await supabaseAdmin
      .from("pix_charges")
      .update({
        status: "paid",
        paid_at: opts.paidAt ?? new Date().toISOString(),
      })
      .eq("id", charge.id)
      .eq("status", "processing")
      .select("id")
      .single();
    if (paidError || !paid) throw paidError ?? new Error("Cobrança não finalizada");

    // A notificação não pode desfazer uma venda já entregue.
    const realCents = Math.round(charge.amount_cents * 0.85);
    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      user_id: charge.payee_id,
      type: "sale",
      title: "Você recebeu uma venda",
      body: `R$ ${(charge.amount_cents / 100).toFixed(2)} em ${labelFor(charge.purpose)} — líquido R$ ${(realCents / 100).toFixed(2)} (após 15%).`,
      link: "/creator/wallet",
      metadata: { charge_id: charge.id, purpose: charge.purpose },
    });
    if (notificationError) {
      console.error("[fulfillPaidCharge] notificação falhou", notificationError);
    }

    await recordOperationalEvent({
      eventKind: "product",
      eventName: "payment_completed",
      userId: charge.payer_id,
      metadata: {
        purpose: charge.purpose,
        amountRange:
          charge.amount_cents < 5_000
            ? "under_50"
            : charge.amount_cents < 20_000
              ? "50_to_199"
              : "200_plus",
      },
    });

    return { ok: true, alreadyFulfilled: false, chargeId: charge.id };
  } catch (e) {
    console.error("[fulfillPaidCharge] erro no efeito colateral", e);
    await recordOperationalEvent({
      eventKind: "error",
      eventName: "payment_fulfillment_failed",
      severity: "critical",
      userId: charge.payer_id,
      metadata: { purpose: charge.purpose, error: e instanceof Error ? e.message : "unknown" },
      fingerprint: `payment_fulfillment:${charge.purpose}`,
    });
    await supabaseAdmin
      .from("pix_charges")
      .update({ status: "pending" })
      .eq("id", charge.id)
      .eq("status", "processing");
    return { ok: false, reason: "Erro ao aplicar venda" };
  }
}

export async function reconcileRefundedCharge(opts: {
  chargeId: string;
  gatewayReference?: string | null;
  amountCents: number;
  refundedAt?: string | null;
}): Promise<{ ok: true; alreadyRefunded: boolean } | { ok: false; reason: string }> {
  const { data, error } = await supabaseAdmin.rpc("reconcile_pix_refund", {
    _charge_id: opts.chargeId,
    _gateway_reference: opts.gatewayReference ?? "",
    _amount_cents: opts.amountCents,
    _refunded_at: opts.refundedAt ?? new Date().toISOString(),
  });
  if (error) {
    console.error("[reconcileRefundedCharge] falha", error.code);
    return { ok: false, reason: "Falha ao reconciliar estorno" };
  }
  const result = data as { already_refunded?: boolean } | null;
  return { ok: true, alreadyRefunded: result?.already_refunded === true };
}

function labelFor(p: string): string {
  switch (p) {
    case "subscription":
      return "assinatura";
    case "ppv":
      return "PPV";
    case "tip":
      return "gorjeta";
    case "goal":
      return "meta";
    case "chat_ppv":
      return "PPV no chat";
    case "upsell":
      return "upsell";
    default:
      return p;
  }
}

// =====================================================
// Efeitos colaterais por tipo
// =====================================================

async function fulfillSubscription(charge: PixCharge) {
  const metadata = metadataOf(charge);
  const months = Math.max(1, Math.min(24, Number(metadata.months ?? 1)));
  const subAmount = Number(metadata.sub_amount_cents ?? charge.amount_cents);
  const isTrial = metadata.is_trial === true;
  const trialDays = Math.max(0, Number(metadata.trial_days ?? 0));
  const couponId = typeof metadata.coupon === "string" ? metadata.coupon : null;

  if (
    !Number.isInteger(months) ||
    !Number.isInteger(subAmount) ||
    subAmount < 0 ||
    !Number.isInteger(trialDays)
  ) {
    throw new Error("Metadados inválidos na assinatura");
  }

  const { error: subscriptionError } = await supabaseAdmin.rpc("fulfill_subscription_payment", {
    _charge_id: charge.id,
    _subscriber_id: charge.payer_id,
    _creator_id: charge.payee_id,
    _amount_cents: subAmount,
    _months: months,
    _is_trial: isTrial,
    _trial_days: Math.min(30, trialDays),
    _gateway_ref: charge.gateway_transaction_id ?? "",
    _coupon_id: couponId,
  });
  if (subscriptionError) throw subscriptionError;

  const { error: metadataError } = await supabaseAdmin
    .from("transactions")
    .update({
      metadata: {
        charge_id: charge.id,
        months,
        coupon: couponId,
        is_trial: isTrial,
        trial_days: Math.min(30, trialDays),
      },
    })
    .eq("idempotency_key", `${charge.id}:subscription`);
  if (metadataError) throw metadataError;

  // Entrega bumps marcados no checkout
  const bumps = Array.isArray(metadata.bumps)
    ? metadata.bumps.filter(
        (value): value is { id: string; price: number } =>
          !!value &&
          typeof value === "object" &&
          "id" in value &&
          typeof value.id === "string" &&
          "price" in value &&
          typeof value.price === "number",
      )
    : [];
  for (const bump of bumps) {
    await deliverOfferPurchase({
      offerId: bump.id,
      buyerId: charge.payer_id,
      creatorId: charge.payee_id,
      pixChargeId: charge.id,
      parentChargeId: charge.id,
      amountCents: bump.price,
      origin: "bump",
    });
  }
}

async function fulfillUpsell(charge: PixCharge) {
  if (!charge.reference_id) throw new Error("Upsell sem offer_id");
  await deliverOfferPurchase({
    offerId: charge.reference_id,
    buyerId: charge.payer_id,
    creatorId: charge.payee_id,
    pixChargeId: charge.id,
    parentChargeId: null,
    amountCents: charge.amount_cents,
    origin: "upsell",
  });
}

async function deliverOfferPurchase(opts: {
  offerId: string;
  buyerId: string;
  creatorId: string;
  pixChargeId: string;
  parentChargeId: string | null;
  amountCents: number;
  origin: "bump" | "upsell";
}) {
  // Idempotência
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("upsell_purchases")
    .select("id")
    .eq("offer_id", opts.offerId)
    .eq("buyer_id", opts.buyerId)
    .eq("pix_charge_id", opts.pixChargeId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (!existing) {
    const { error } = await supabaseAdmin.from("upsell_purchases").insert({
      offer_id: opts.offerId,
      buyer_id: opts.buyerId,
      creator_id: opts.creatorId,
      pix_charge_id: opts.pixChargeId,
      parent_charge_id: opts.parentChargeId,
      amount_cents: opts.amountCents,
      origin: opts.origin,
      status: "paid",
      paid_at: new Date().toISOString(),
    });
    if (error && error.code !== "23505") throw error;
  }

  // Se a oferta apontar pra um post da criadora, libera PPV automaticamente
  const { data: offer, error: offerError } = await supabaseAdmin
    .from("upsell_offers")
    .select("media_post_id")
    .eq("id", opts.offerId)
    .maybeSingle();
  if (offerError) throw offerError;
  if (offer?.media_post_id) {
    const { data: hasUnlock, error: unlockLookupError } = await supabaseAdmin
      .from("ppv_unlocks")
      .select("id")
      .eq("user_id", opts.buyerId)
      .eq("post_id", offer.media_post_id)
      .maybeSingle();
    if (unlockLookupError) throw unlockLookupError;
    if (!hasUnlock) {
      const { error } = await supabaseAdmin.from("ppv_unlocks").insert({
        user_id: opts.buyerId,
        post_id: offer.media_post_id,
        amount_cents: opts.amountCents,
      });
      if (error && error.code !== "23505") throw error;
    }
  }

  await insertTransaction({
    payer_id: opts.buyerId,
    payee_id: opts.creatorId,
    type: "ppv",
    status: "paid",
    amount_cents: opts.amountCents,
    reference_id: opts.offerId,
    gateway: "nexuspag",
    gateway_ref: opts.pixChargeId,
    idempotency_key: `${opts.pixChargeId}:offer:${opts.offerId}`,
    metadata: { kind: opts.origin, charge_id: opts.pixChargeId },
  });
}

async function fulfillPpv(charge: PixCharge) {
  if (!charge.reference_id) throw new Error("PPV sem post_id");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("ppv_unlocks")
    .select("id")
    .eq("user_id", charge.payer_id)
    .eq("post_id", charge.reference_id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (!existing) {
    const { error } = await supabaseAdmin.from("ppv_unlocks").insert({
      user_id: charge.payer_id,
      post_id: charge.reference_id,
      amount_cents: charge.amount_cents,
    });
    if (error && error.code !== "23505") throw error;
  }

  await insertTransaction({
    payer_id: charge.payer_id,
    payee_id: charge.payee_id,
    type: "ppv",
    status: "paid",
    amount_cents: charge.amount_cents,
    reference_id: charge.reference_id,
    gateway: "nexuspag",
    gateway_ref: charge.gateway_transaction_id,
    idempotency_key: `${charge.id}:ppv`,
    metadata: { charge_id: charge.id },
  });
}

async function fulfillTip(charge: PixCharge) {
  const metadata = metadataOf(charge);
  const isSymbolicGift = metadata.kind === "symbolic_gift";
  if (isSymbolicGift) {
    const giftItemId = typeof metadata.gift_item_id === "string" ? metadata.gift_item_id : null;
    if (!giftItemId) throw new Error("Mimo simbólico sem item associado");
    const { error } = await supabaseAdmin.rpc("fulfill_symbolic_gift", {
      _charge_id: charge.id,
      _item_id: giftItemId,
      _creator_id: charge.payee_id,
      _supporter_id: charge.payer_id,
      _amount_cents: charge.amount_cents,
      _message: typeof metadata.message === "string" ? metadata.message : null,
    });
    if (error) throw error;
  }
  await insertTransaction({
    payer_id: charge.payer_id,
    payee_id: charge.payee_id,
    type: "tip",
    status: "paid",
    amount_cents: charge.amount_cents,
    reference_id: charge.reference_id ?? null,
    gateway: "nexuspag",
    gateway_ref: charge.gateway_transaction_id,
    idempotency_key: `${charge.id}:tip`,
    metadata: {
      charge_id: charge.id,
      message: metadata.message ?? null,
      kind: isSymbolicGift ? "symbolic_gift" : "tip",
      gift_item_id: isSymbolicGift ? (metadata.gift_item_id ?? null) : null,
      gift_title: isSymbolicGift ? (metadata.gift_title ?? null) : null,
      gift_category: isSymbolicGift ? (metadata.gift_category ?? null) : null,
    },
  });
}

async function fulfillGoal(charge: PixCharge) {
  if (!charge.reference_id) throw new Error("Goal sem post_id");

  const { error: contributionError } = await supabaseAdmin.from("post_goal_contributions").insert({
    user_id: charge.payer_id,
    post_id: charge.reference_id,
    amount_cents: charge.amount_cents,
    pix_charge_id: charge.id,
  });
  if (contributionError && contributionError.code !== "23505") {
    throw contributionError;
  }

  await insertTransaction({
    payer_id: charge.payer_id,
    payee_id: charge.payee_id,
    type: "ppv",
    status: "paid",
    amount_cents: charge.amount_cents,
    reference_id: charge.reference_id,
    gateway: "nexuspag",
    gateway_ref: charge.gateway_transaction_id,
    idempotency_key: `${charge.id}:goal`,
    metadata: { charge_id: charge.id, kind: "goal_contribution" },
  });
}

async function fulfillChatPpv(charge: PixCharge) {
  if (!charge.reference_id) throw new Error("Chat PPV sem message_id");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("chat_ppv_unlocks")
    .select("message_id")
    .eq("message_id", charge.reference_id)
    .eq("user_id", charge.payer_id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (!existing) {
    const { error } = await supabaseAdmin.from("chat_ppv_unlocks").insert({
      message_id: charge.reference_id,
      user_id: charge.payer_id,
      amount_cents: charge.amount_cents,
    });
    if (error && error.code !== "23505") throw error;
  }

  await insertTransaction({
    payer_id: charge.payer_id,
    payee_id: charge.payee_id,
    type: "chat_ppv",
    status: "paid",
    amount_cents: charge.amount_cents,
    reference_id: charge.reference_id,
    gateway: "nexuspag",
    gateway_ref: charge.gateway_transaction_id,
    idempotency_key: `${charge.id}:chat-ppv`,
    metadata: { charge_id: charge.id },
  });
}

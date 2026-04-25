import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  | { ok: true; alreadyFulfilled: boolean; chargeId: string }
  | { ok: false; reason: string }
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

  // 3) Marca como paga
  const { error: uErr } = await supabaseAdmin
    .from("pix_charges")
    .update({
      status: "paid",
      paid_at: opts.paidAt ?? new Date().toISOString(),
      gateway_transaction_id: opts.gatewayTransactionId ?? charge.gateway_transaction_id,
      metadata: {
        ...(typeof charge.metadata === "object" && charge.metadata ? (charge.metadata as Record<string, unknown>) : {}),
        payer_name: opts.payerName ?? null,
      },
    })
    .eq("id", charge.id)
    .eq("status", "pending"); // proteção contra race

  if (uErr) {
    console.error("[fulfillPaidCharge] erro atualizando charge", uErr);
    return { ok: false, reason: "Erro ao atualizar cobrança" };
  }

  // 4) Aplica efeito colateral conforme purpose
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
    }
  } catch (e) {
    console.error("[fulfillPaidCharge] erro no efeito colateral", e);
    // A charge fica como 'paid' mesmo assim — admin pode revisar manualmente.
    return { ok: false, reason: "Erro ao aplicar venda" };
  }

  // 5) Notificação para a criadora
  const realCents = Math.round(charge.amount_cents * 0.85); // 15% taxa
  await supabaseAdmin.from("notifications").insert({
    user_id: charge.payee_id,
    type: "sale",
    title: "Você recebeu uma venda",
    body: `R$ ${(charge.amount_cents / 100).toFixed(2)} em ${labelFor(charge.purpose)} — líquido R$ ${(realCents / 100).toFixed(2)} (após 15%).`,
    link: "/creator/wallet",
    metadata: { charge_id: charge.id, purpose: charge.purpose },
  });

  return { ok: true, alreadyFulfilled: false, chargeId: charge.id };
}

function labelFor(p: string): string {
  switch (p) {
    case "subscription": return "assinatura";
    case "ppv": return "PPV";
    case "tip": return "gorjeta";
    case "goal": return "meta";
    case "chat_ppv": return "PPV no chat";
    default: return p;
  }
}

// =====================================================
// Efeitos colaterais por tipo
// =====================================================

async function fulfillSubscription(charge: any) {
  const months = Number(charge.metadata?.months ?? 1);
  const subAmount = Number(charge.metadata?.sub_amount_cents ?? charge.amount_cents);
  const isTrial = !!charge.metadata?.is_trial;
  const trialDays = Number(charge.metadata?.trial_days ?? 0);

  const periodEnd = new Date();
  if (isTrial && trialDays > 0) {
    periodEnd.setDate(periodEnd.getDate() + trialDays);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + months);
  }

  const { data: sub, error: se } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      subscriber_id: charge.payer_id,
      creator_id: charge.payee_id,
      price_cents: months > 0 ? Math.round(subAmount / months) : subAmount,
      status: "active",
      current_period_end: periodEnd.toISOString(),
    })
    .select("id")
    .single();

  if (se && !se.message.includes("duplicate")) throw se;

  if (subAmount > 0) {
    await supabaseAdmin.from("transactions").insert({
      payer_id: charge.payer_id,
      payee_id: charge.payee_id,
      type: "subscription",
      status: "paid",
      amount_cents: subAmount,
      reference_id: sub?.id ?? null,
      gateway: "nexuspag",
      gateway_ref: charge.gateway_transaction_id,
      metadata: { charge_id: charge.id, months, coupon: charge.metadata?.coupon ?? null },
    });
  }

  // Entrega bumps marcados no checkout
  const bumps: Array<{ id: string; price: number }> = Array.isArray(charge.metadata?.bumps)
    ? charge.metadata.bumps
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

async function fulfillUpsell(charge: any) {
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
  const { data: existing } = await supabaseAdmin
    .from("upsell_purchases")
    .select("id")
    .eq("offer_id", opts.offerId)
    .eq("buyer_id", opts.buyerId)
    .eq("pix_charge_id", opts.pixChargeId)
    .maybeSingle();
  if (existing) return;

  await supabaseAdmin.from("upsell_purchases").insert({
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

  // Se a oferta apontar pra um post da criadora, libera PPV automaticamente
  const { data: offer } = await supabaseAdmin
    .from("upsell_offers")
    .select("media_post_id")
    .eq("id", opts.offerId)
    .maybeSingle();
  if (offer?.media_post_id) {
    const { data: hasUnlock } = await supabaseAdmin
      .from("ppv_unlocks")
      .select("id")
      .eq("user_id", opts.buyerId)
      .eq("post_id", offer.media_post_id)
      .maybeSingle();
    if (!hasUnlock) {
      await supabaseAdmin.from("ppv_unlocks").insert({
        user_id: opts.buyerId,
        post_id: offer.media_post_id,
        amount_cents: opts.amountCents,
      });
    }
  }

  await supabaseAdmin.from("transactions").insert({
    payer_id: opts.buyerId,
    payee_id: opts.creatorId,
    type: "ppv",
    status: "paid",
    amount_cents: opts.amountCents,
    reference_id: opts.offerId,
    gateway: "nexuspag",
    gateway_ref: opts.pixChargeId,
    metadata: { kind: opts.origin, charge_id: opts.pixChargeId },
  });
}

async function fulfillPpv(charge: any) {
  if (!charge.reference_id) throw new Error("PPV sem post_id");

  const { data: existing } = await supabaseAdmin
    .from("ppv_unlocks")
    .select("id")
    .eq("user_id", charge.payer_id)
    .eq("post_id", charge.reference_id)
    .maybeSingle();
  if (existing) return;

  await supabaseAdmin.from("ppv_unlocks").insert({
    user_id: charge.payer_id,
    post_id: charge.reference_id,
    amount_cents: charge.amount_cents,
  });

  await supabaseAdmin.from("transactions").insert({
    payer_id: charge.payer_id,
    payee_id: charge.payee_id,
    type: "ppv",
    status: "paid",
    amount_cents: charge.amount_cents,
    reference_id: charge.reference_id,
    gateway: "nexuspag",
    gateway_ref: charge.gateway_transaction_id,
    metadata: { charge_id: charge.id },
  });
}

async function fulfillTip(charge: any) {
  await supabaseAdmin.from("transactions").insert({
    payer_id: charge.payer_id,
    payee_id: charge.payee_id,
    type: "tip",
    status: "paid",
    amount_cents: charge.amount_cents,
    reference_id: charge.reference_id ?? null,
    gateway: "nexuspag",
    gateway_ref: charge.gateway_transaction_id,
    metadata: { charge_id: charge.id, message: charge.metadata?.message ?? null },
  });
}

async function fulfillGoal(charge: any) {
  if (!charge.reference_id) throw new Error("Goal sem post_id");

  await supabaseAdmin.from("post_goal_contributions").insert({
    user_id: charge.payer_id,
    post_id: charge.reference_id,
    amount_cents: charge.amount_cents,
  });

  await supabaseAdmin.from("transactions").insert({
    payer_id: charge.payer_id,
    payee_id: charge.payee_id,
    type: "ppv",
    status: "paid",
    amount_cents: charge.amount_cents,
    reference_id: charge.reference_id,
    gateway: "nexuspag",
    gateway_ref: charge.gateway_transaction_id,
    metadata: { charge_id: charge.id, kind: "goal_contribution" },
  });
}

async function fulfillChatPpv(charge: any) {
  if (!charge.reference_id) throw new Error("Chat PPV sem message_id");

  const { data: existing } = await supabaseAdmin
    .from("chat_ppv_unlocks")
    .select("message_id")
    .eq("message_id", charge.reference_id)
    .eq("user_id", charge.payer_id)
    .maybeSingle();
  if (existing) return;

  await supabaseAdmin.from("chat_ppv_unlocks").insert({
    message_id: charge.reference_id,
    user_id: charge.payer_id,
    amount_cents: charge.amount_cents,
  });

  await supabaseAdmin.from("transactions").insert({
    payer_id: charge.payer_id,
    payee_id: charge.payee_id,
    type: "chat_ppv",
    status: "paid",
    amount_cents: charge.amount_cents,
    reference_id: charge.reference_id,
    gateway: "nexuspag",
    gateway_ref: charge.gateway_transaction_id,
    metadata: { charge_id: charge.id },
  });
}

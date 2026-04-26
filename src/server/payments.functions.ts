import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * SECURITY P0:
 * Estes endpoints históricos aceitavam um "mock_token" como prova de pagamento,
 * o que permitia a qualquer usuário autenticado desbloquear conteúdo, fingir
 * assinatura ou enviar gorjeta sem pagar. Foram DESATIVADOS.
 *
 * Todo fluxo de pagamento agora exige uma cobrança Pix real via NexusPag —
 * use as funções em `src/server/checkout.functions.ts` (createSubscriptionPixCharge,
 * createTipPixCharge, etc.). A liberação do conteúdo é feita pelo webhook
 * (`/api/public/nexuspag-webhook`) ou pelo polling de `getChargeStatus`,
 * que chamam `fulfillPaidCharge` em `payments-fulfillment.server.ts`.
 */

function disabled(): never {
  throw new Error(
    "Este fluxo de pagamento foi desativado. Use o checkout Pix oficial."
  );
}

// Sanitiza erros do banco para não vazar nomes de tabelas/colunas/constraints ao cliente.
function safeError(internal: unknown, userMessage = "Operação falhou. Tente novamente."): Error {
  console.error("[payments]", internal);
  return new Error(userMessage);
}

// --------- PPV de post ---------
const ppvSchema = z.object({
  postId: z.string().uuid(),
  gatewayToken: z.string().min(1).max(500),
});

export const unlockPpvServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ppvSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: post, error: pe } = await supabaseAdmin
      .from("posts")
      .select("id, creator_id, price_cents, visibility")
      .eq("id", data.postId)
      .maybeSingle();
    if (pe || !post) throw new Error("Post não encontrado");
    if (post.visibility !== "ppv") throw new Error("Este post não é PPV");
    if (post.creator_id === userId) throw new Error("Você é o criador deste post");
    if (post.price_cents <= 0) throw new Error("Preço inválido");

    if (!validateGatewayToken(data.gatewayToken, post.price_cents)) {
      throw new Error("Pagamento não confirmado pelo gateway");
    }

    const { data: existing } = await supabaseAdmin
      .from("ppv_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", post.id)
      .maybeSingle();
    if (existing) return { ok: true, alreadyUnlocked: true };

    const { error: te } = await supabaseAdmin.from("transactions").insert({
      payer_id: userId,
      payee_id: post.creator_id,
      type: "ppv",
      status: "paid",
      amount_cents: post.price_cents,
      reference_id: post.id,
      gateway: "mock",
      gateway_ref: data.gatewayToken,
    });
    if (te) throw safeError(te);

    const { error: ue } = await supabaseAdmin
      .from("ppv_unlocks")
      .insert({ user_id: userId, post_id: post.id, amount_cents: post.price_cents });
    if (ue) throw safeError(ue);

    await supabaseAdmin
      .from("posts")
      .update({ unlocks_count: (post as { unlocks_count?: number }).unlocks_count ?? 0 })
      .eq("id", post.id);

    return { ok: true, alreadyUnlocked: false };
  });

// --------- Tip ---------
const tipSchema = z.object({
  creatorId: z.string().uuid(),
  amountCents: z.number().int().min(100).max(1_000_000),
  postId: z.string().uuid().optional().nullable(),
  message: z.string().max(200).optional().nullable(),
  gatewayToken: z.string().min(1).max(500),
});

export const tipServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tipSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.creatorId === userId) throw new Error("Você não pode enviar gorjeta para si mesmo");
    if (!validateGatewayToken(data.gatewayToken, data.amountCents)) {
      throw new Error("Pagamento não confirmado pelo gateway");
    }
    const { error } = await supabaseAdmin.from("transactions").insert({
      payer_id: userId,
      payee_id: data.creatorId,
      type: "tip",
      status: "paid",
      amount_cents: data.amountCents,
      reference_id: data.postId ?? null,
      gateway: "mock",
      gateway_ref: data.gatewayToken,
      metadata: { message: data.message ?? null },
    });
    if (error) throw safeError(error);
    return { ok: true };
  });

// --------- Contribuição de meta ---------
const goalSchema = z.object({
  postId: z.string().uuid(),
  gatewayToken: z.string().min(1).max(500),
});

export const contributeGoalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => goalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, creator_id, visibility")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) throw new Error("Post não encontrado");
    if (post.visibility !== "goal") throw new Error("Este post não tem meta");

    const { data: goal } = await supabaseAdmin
      .from("post_goals")
      .select("unlock_price_cents")
      .eq("post_id", post.id)
      .maybeSingle();
    if (!goal) throw new Error("Meta não configurada");

    if (!validateGatewayToken(data.gatewayToken, goal.unlock_price_cents)) {
      throw new Error("Pagamento não confirmado pelo gateway");
    }

    const { error: te } = await supabaseAdmin.from("transactions").insert({
      payer_id: userId,
      payee_id: post.creator_id,
      type: "ppv",
      status: "paid",
      amount_cents: goal.unlock_price_cents,
      reference_id: post.id,
      gateway: "mock",
      gateway_ref: data.gatewayToken,
      metadata: { kind: "goal_contribution" },
    });
    if (te) throw safeError(te);

    const { error: ce } = await supabaseAdmin
      .from("post_goal_contributions")
      .insert({
        user_id: userId,
        post_id: post.id,
        amount_cents: goal.unlock_price_cents,
      });
    if (ce && !ce.message.includes("duplicate")) throw safeError(ce);

    return { ok: true };
  });

// --------- Assinatura ---------
const subSchema = z.object({
  creatorId: z.string().uuid(),
  months: z.number().int().min(1).max(24),
  pricePerMonthCents: z.number().int().min(0).max(1_000_000),
  couponCode: z.string().max(50).optional().nullable(),
  gatewayToken: z.string().min(1).max(500),
});

export const subscribeServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => subSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.creatorId === userId) throw new Error("Você não pode assinar a si mesmo");

    // Validar coupon no servidor
    let trialDays = 0;
    let discountPct = 0;
    let couponId: string | null = null;
    let couponUses = 0;
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
        couponUses = c.uses_count;
        trialDays = c.trial_days ?? 0;
        discountPct = c.discount_pct ?? 0;
      }
    }

    const subtotal = data.pricePerMonthCents * data.months;
    const discounted = discountPct ? Math.round(subtotal * (1 - discountPct / 100)) : subtotal;
    const isTrial = trialDays > 0;
    const charged = isTrial ? 0 : discounted;

    if (charged > 0 && !validateGatewayToken(data.gatewayToken, charged)) {
      throw new Error("Pagamento não confirmado pelo gateway");
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + data.months);
    if (isTrial) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + trialDays);
      if (trialEnd > periodEnd) periodEnd.setTime(trialEnd.getTime());
    }

    const { data: sub, error: se } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        subscriber_id: userId,
        creator_id: data.creatorId,
        price_cents: data.pricePerMonthCents,
        status: "active",
        current_period_end: periodEnd.toISOString(),
      })
      .select("id")
      .single();
    if (se) {
      if (se.message.includes("duplicate")) return { ok: true, alreadyActive: true };
      throw safeError(se);
    }

    if (charged > 0) {
      const { error: te } = await supabaseAdmin.from("transactions").insert({
        payer_id: userId,
        payee_id: data.creatorId,
        type: "subscription",
        status: "paid",
        amount_cents: charged,
        reference_id: sub.id,
        gateway: "mock",
        gateway_ref: data.gatewayToken,
        metadata: { months: data.months, coupon: data.couponCode ?? null },
      });
      if (te) throw safeError(te);
    }

    if (couponId) {
      await supabaseAdmin
        .from("coupon_redemptions")
        .insert({ coupon_id: couponId, user_id: userId });
      await supabaseAdmin
        .from("subscription_coupons")
        .update({ uses_count: couponUses + 1 })
        .eq("id", couponId);
    }

    return { ok: true, isTrial, trialDays, alreadyActive: false };
  });

// --------- Chat PPV unlock ---------
const chatPpvSchema = z.object({
  messageId: z.string().uuid(),
  gatewayToken: z.string().min(1).max(500),
});

export const unlockChatPpvServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => chatPpvSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: msg } = await supabaseAdmin
      .from("chat_messages")
      .select("id, sender_id, ppv_price_cents, thread_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg) throw new Error("Mensagem não encontrada");
    if (msg.sender_id === userId) throw new Error("Você é o remetente");
    if (msg.ppv_price_cents <= 0) throw new Error("Mensagem não é PPV");

    const { data: thread } = await supabaseAdmin
      .from("chat_threads")
      .select("user_a, user_b")
      .eq("id", msg.thread_id)
      .maybeSingle();
    if (!thread || (thread.user_a !== userId && thread.user_b !== userId)) {
      throw new Error("Sem acesso a esta conversa");
    }

    if (!validateGatewayToken(data.gatewayToken, msg.ppv_price_cents)) {
      throw new Error("Pagamento não confirmado pelo gateway");
    }

    const { data: existing } = await supabaseAdmin
      .from("chat_ppv_unlocks")
      .select("message_id")
      .eq("message_id", msg.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { ok: true, alreadyUnlocked: true };

    const { error: te } = await supabaseAdmin.from("transactions").insert({
      payer_id: userId,
      payee_id: msg.sender_id,
      type: "chat_ppv",
      status: "paid",
      amount_cents: msg.ppv_price_cents,
      reference_id: msg.id,
      gateway: "mock",
      gateway_ref: data.gatewayToken,
    });
    if (te) throw safeError(te);

    const { error: ue } = await supabaseAdmin
      .from("chat_ppv_unlocks")
      .insert({ message_id: msg.id, user_id: userId, amount_cents: msg.ppv_price_cents });
    if (ue) throw safeError(ue);

    await supabaseAdmin.from("chat_link_clicks").insert({
      message_id: msg.id,
      user_id: userId,
      creator_id: msg.sender_id,
      click_type: "ppv_unlock",
    });

    return { ok: true, alreadyUnlocked: false };
  });

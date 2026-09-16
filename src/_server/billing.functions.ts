import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: charges, error: chargesError } = await supabase
      .from("pix_charges")
      .select(
        "id,amount_cents,purpose,status,created_at,paid_at,expires_at,external_id,gateway_transaction_id,payee_id",
      )
      .eq("payer_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    let lifecycleAvailable = true;
    let { data: subscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select(
        "id,creator_id,status,price_cents,current_period_start,current_period_end,is_trial,months,created_at,cancel_at_period_end,cancel_requested_at,cancellation_reason",
      )
      .eq("subscriber_id", userId)
      .order("created_at", { ascending: false });

    // Keep history usable while the new migration is waiting to be applied to
    // an existing Supabase project. Cancellation controls remain disabled.
    if (subsError) {
      lifecycleAvailable = false;
      const legacyResult = await supabase
        .from("subscriptions")
        .select(
          "id,creator_id,status,price_cents,current_period_start,current_period_end,is_trial,months,created_at",
        )
        .eq("subscriber_id", userId)
        .order("created_at", { ascending: false });
      subscriptions = (legacyResult.data ?? []).map((subscription) => ({
        ...subscription,
        cancel_at_period_end: false,
        cancel_requested_at: null,
        cancellation_reason: null,
      }));
      subsError = legacyResult.error;
    }

    if (chargesError || subsError) {
      console.error("[billing] failed to list billing history", {
        charges: chargesError?.code,
        subscriptions: subsError?.code,
      });
      throw new Error("Não foi possível carregar seu histórico financeiro.");
    }

    const creatorIds = Array.from(
      new Set([
        ...(charges ?? []).map((charge) => charge.payee_id),
        ...(subscriptions ?? []).map((subscription) => subscription.creator_id),
      ]),
    );

    const { data: profiles, error: profilesError } = creatorIds.length
      ? await supabase
          .from("profiles")
          .select("user_id,username,display_name,avatar_url")
          .in("user_id", creatorIds)
      : { data: [], error: null };

    if (profilesError) {
      console.error("[billing] failed to list creator labels", profilesError.code);
    }

    const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

    return {
      lifecycleAvailable,
      charges: (charges ?? []).map((charge) => ({
        ...charge,
        creator: profileById.get(charge.payee_id) ?? null,
      })),
      subscriptions: (subscriptions ?? []).map((subscription) => ({
        ...subscription,
        creator: profileById.get(subscription.creator_id) ?? null,
      })),
    };
  });

const cancellationSchema = z.object({
  subscriptionId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
});

function cancellationError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("VENYX_SUBSCRIPTION_NOT_FOUND")) {
    return new Error("Assinatura não encontrada.");
  }
  if (message.includes("VENYX_SUBSCRIPTION_NOT_ACTIVE")) {
    return new Error("Esta assinatura não está ativa.");
  }
  console.error("[billing] cancellation failed", message);
  return new Error("Não foi possível alterar o cancelamento agora.");
}

export const scheduleSubscriptionCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => cancellationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "schedule_my_subscription_cancellation",
      {
        _subscription_id: data.subscriptionId,
        _reason: data.reason || null,
      },
    );
    if (error) throw cancellationError(error);
    return result;
  });

export const undoSubscriptionCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ subscriptionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "undo_my_subscription_cancellation",
      { _subscription_id: data.subscriptionId },
    );
    if (error) throw cancellationError(error);
    return result;
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdultVerification } from "@/_server/access-control.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const StartTrialSchema = z.object({ creatorId: z.string().uuid() });

export const startTrial = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .inputValidator((input) => StartTrialSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await supabaseAdmin.rpc("start_creator_trial", {
      _creator_id: data.creatorId,
      _subscriber_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const obj = result as { error?: string; subscription_id?: string; trial_days?: number };
    if (obj?.error) {
      const msgs: Record<string, string> = {
        not_authenticated: "Faça login.",
        cannot_subscribe_self: "Você não pode assinar a si mesma.",
        trial_not_offered: "Esta criadora não oferece trial.",
        trial_already_used: "Você já usou o trial desta criadora.",
        already_subscribed: "Você já tem assinatura ativa.",
      };
      return { ok: false as const, error: msgs[obj.error] ?? obj.error };
    }
    return { ok: true as const, trialDays: obj.trial_days ?? 0 };
  });

export const checkTrialEligibility = createServerFn({ method: "GET" })
  .middleware([requireAdultVerification])
  .inputValidator((input) => StartTrialSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("trial_days_enabled, trial_days")
      .eq("user_id", data.creatorId)
      .maybeSingle();
    if (!prof?.trial_days_enabled) return { eligible: false as const };

    const { data: used } = await supabase
      .from("subscription_trials_used")
      .select("user_id")
      .eq("user_id", userId)
      .eq("creator_id", data.creatorId)
      .maybeSingle();
    if (used) return { eligible: false as const, reason: "already_used" as const };

    return { eligible: true as const, trialDays: prof.trial_days };
  });

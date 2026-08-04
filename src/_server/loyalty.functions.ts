import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const PairSchema = z.object({ creatorId: z.string().uuid() });
const LoyaltyTierSchema = z.enum(["bronze", "silver", "gold", "diamond", "vip"]);
const RewardTypeSchema = z.enum([
  "renewal_discount",
  "ppv_coupon",
  "exclusive_content",
  "personal_message",
  "early_access",
  "fan_badge",
]);

export const getMyPointsForCreator = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PairSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("loyalty_points")
      .select("points, tier, updated_at")
      .eq("user_id", userId)
      .eq("creator_id", data.creatorId)
      .maybeSingle();
    return row ?? { points: 0, tier: "bronze", updated_at: null };
  });

export const listMyLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [pointsResult, globalResult, rewardsResult, claimsResult, ledgerResult] =
      await Promise.all([
        supabase
          .from("loyalty_points")
          .select("creator_id, points, tier, updated_at")
          .eq("user_id", userId)
          .order("points", { ascending: false }),
        supabase
          .from("loyalty_global_points")
          .select("points, tier, updated_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("loyalty_rewards")
          .select(
            "id,creator_id,title,description,reward_type,minimum_tier,stock,redeemed_count,active,expires_at,config",
          )
          .eq("active", true)
          .order("minimum_tier", { ascending: true }),
        supabase
          .from("loyalty_reward_claims")
          .select("id,reward_id,creator_id,status,claimed_at,used_at")
          .eq("user_id", userId)
          .order("claimed_at", { ascending: false }),
        supabase
          .from("loyalty_ledger")
          .select("id,creator_id,points_delta,reason,ref_id,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
    const rows = pointsResult.data;
    const list = rows ?? [];
    const creatorIds = list.map((r) => r.creator_id);
    const { data: profiles } = creatorIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", creatorIds)
      : { data: [] as any[] };
    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return {
      global: globalResult.data ?? { points: 0, tier: "bronze", updated_at: null },
      items: list.map((r) => ({
        ...r,
        profile: profMap.get(r.creator_id) ?? null,
      })),
      rewards: rewardsResult.data ?? [],
      claims: claimsResult.data ?? [],
      ledger: ledgerResult.data ?? [],
    };
  });

export const listTopFans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: rows }, { data: program }, { data: rewards }] = await Promise.all([
      supabase
        .from("loyalty_points")
        .select("user_id, points, tier")
        .eq("creator_id", userId)
        .order("points", { ascending: false })
        .limit(50),
      supabase
        .from("loyalty_programs")
        .select("enabled,interaction_points_enabled,show_global_tier")
        .eq("creator_id", userId)
        .maybeSingle(),
      supabase
        .from("loyalty_rewards")
        .select(
          "id,title,description,reward_type,minimum_tier,stock,redeemed_count,active,expires_at,config",
        )
        .eq("creator_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    const list = rows ?? [];
    const userIds = list.map((r) => r.user_id);
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds)
      : { data: [] as any[] };
    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const { data: globalRows } = userIds.length
      ? await supabase
          .from("loyalty_global_points")
          .select("user_id,points,tier")
          .in("user_id", userIds)
      : { data: [] as any[] };
    const globalMap = new Map((globalRows ?? []).map((row: any) => [row.user_id, row]));
    return {
      fans: list.map((r) => ({
        ...r,
        global: globalMap.get(r.user_id) ?? null,
        profile: profMap.get(r.user_id) ?? null,
      })),
      program: program ?? {
        enabled: true,
        interaction_points_enabled: true,
        show_global_tier: true,
      },
      rewards: rewards ?? [],
    };
  });

export const getLoyaltyLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PairSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("loyalty_ledger")
      .select("id, points_delta, reason, created_at")
      .eq("user_id", userId)
      .eq("creator_id", data.creatorId)
      .order("created_at", { ascending: false })
      .limit(100);
    return { entries: rows ?? [] };
  });

export const updateLoyaltyProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enabled: z.boolean().optional(),
        interactionPointsEnabled: z.boolean().optional(),
        showGlobalTier: z.boolean().optional(),
      })
      .refine((value) => Object.values(value).some((item) => item !== undefined))
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: program, error } = await context.supabase
      .from("loyalty_programs")
      .upsert(
        {
          creator_id: context.userId,
          ...(data.enabled === undefined ? {} : { enabled: data.enabled }),
          ...(data.interactionPointsEnabled === undefined
            ? {}
            : { interaction_points_enabled: data.interactionPointsEnabled }),
          ...(data.showGlobalTier === undefined ? {} : { show_global_tier: data.showGlobalTier }),
        },
        { onConflict: "creator_id" },
      )
      .select("enabled,interaction_points_enabled,show_global_tier")
      .single();
    if (error) throw new Error(error.message);
    return { program };
  });

export const createLoyaltyReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().trim().min(2).max(80),
        description: z.string().trim().min(2).max(240),
        rewardType: RewardTypeSchema,
        minimumTier: LoyaltyTierSchema,
        stock: z.number().int().positive().nullable(),
        expiresAt: z.string().datetime().nullable().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: reward, error } = await context.supabase
      .from("loyalty_rewards")
      .insert({
        creator_id: context.userId,
        title: data.title,
        description: data.description,
        reward_type: data.rewardType,
        minimum_tier: data.minimumTier,
        stock: data.stock,
        expires_at: data.expiresAt ?? null,
        config: (data.config ?? {}) as Json,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { reward };
  });

export const toggleLoyaltyReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ rewardId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: reward, error } = await context.supabase
      .from("loyalty_rewards")
      .update({ active: data.active })
      .eq("id", data.rewardId)
      .eq("creator_id", context.userId)
      .select("id,active")
      .single();
    if (error) throw new Error(error.message);
    return { reward };
  });

export const claimLoyaltyReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rewardId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: claim, error } = await context.supabase.rpc("claim_loyalty_reward", {
      _reward_id: data.rewardId,
    });
    if (error) throw new Error(error.message);
    return { claim };
  });

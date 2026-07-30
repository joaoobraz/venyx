import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PairSchema = z.object({ creatorId: z.string().uuid() });

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
    const { data: rows } = await supabase
      .from("loyalty_points")
      .select("creator_id, points, tier, updated_at")
      .eq("user_id", userId)
      .order("points", { ascending: false });
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
      items: list.map((r) => ({
        ...r,
        profile: profMap.get(r.creator_id) ?? null,
      })),
    };
  });

export const listTopFans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("loyalty_points")
      .select("user_id, points, tier")
      .eq("creator_id", userId)
      .order("points", { ascending: false })
      .limit(50);
    const list = rows ?? [];
    const userIds = list.map((r) => r.user_id);
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds)
      : { data: [] as any[] };
    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return {
      fans: list.map((r) => ({
        ...r,
        profile: profMap.get(r.user_id) ?? null,
      })),
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

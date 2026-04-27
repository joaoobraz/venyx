import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ToggleSchema = z.object({
  targetType: z.enum(["creator", "post"]),
  targetId: z.string().uuid(),
});

export const toggleWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ToggleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // tenta deletar; se nada deletado, insere
    const { data: existing } = await supabase
      .from("wishlists")
      .select("id")
      .eq("user_id", userId)
      .eq("target_type", data.targetType)
      .eq("target_id", data.targetId)
      .maybeSingle();

    if (existing) {
      await supabase.from("wishlists").delete().eq("id", existing.id);
      return { added: false };
    }

    const { error } = await supabase.from("wishlists").insert({
      user_id: userId,
      target_type: data.targetType,
      target_id: data.targetId,
    });
    if (error) throw new Error(error.message);
    return { added: true };
  });

export const listMyWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: items } = await supabase
      .from("wishlists")
      .select("id, target_type, target_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const list = items ?? [];
    const creatorIds = list.filter((i) => i.target_type === "creator").map((i) => i.target_id);
    const postIds = list.filter((i) => i.target_type === "post").map((i) => i.target_id);

    const [{ data: creators }, { data: posts }] = await Promise.all([
      creatorIds.length
        ? supabase
            .from("profiles")
            .select("user_id, username, display_name, avatar_url, subscription_price_cents")
            .in("user_id", creatorIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase
            .from("posts")
            .select("id, creator_id, body, visibility, price_cents, created_at")
            .in("id", postIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    return {
      creators: (creators ?? []) as Array<{
        user_id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        subscription_price_cents: number | null;
      }>,
      posts: (posts ?? []) as Array<{
        id: string;
        creator_id: string;
        body: string | null;
        visibility: string;
        price_cents: number;
        created_at: string;
      }>,
    };
  });

export const getMyWishlistIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("wishlists")
      .select("target_type, target_id")
      .eq("user_id", userId);
    return { items: (data ?? []) as Array<{ target_type: string; target_id: string }> };
  });

export const countWishlistedMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("wishlists")
      .select("*", { count: "exact", head: true })
      .eq("target_type", "creator")
      .eq("target_id", userId);
    return { count: count ?? 0 };
  });

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

    const [{ data: posts }, { data: mediaRecords }] = await Promise.all([
      postIds.length
        ? supabase
            .from("posts")
            .select("id, creator_id, body, visibility, price_cents, created_at")
            .in("id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase
            .from("post_media")
            .select("id, post_id, storage_path, mime_type, position")
            .in("post_id", postIds)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const allCreatorIds = Array.from(
      new Set([
        ...creatorIds,
        ...(posts ?? []).map((post) => post.creator_id),
      ]),
    );
    const { data: profiles } = allCreatorIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, subscription_price_cents, is_verified")
          .in("user_id", allCreatorIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

    // Build a map of media by post_id, taking the first (position 0)
    const mediaByPost: Record<string, { path: string; type: string }> = {};
    (mediaRecords ?? []).forEach((m) => {
      if (!mediaByPost[m.post_id]) {
        mediaByPost[m.post_id] = { path: m.storage_path, type: m.mime_type };
      }
    });

    return {
      creators: creatorIds
        .map((id) => profileById.get(id))
        .filter((creator): creator is NonNullable<typeof creator> => Boolean(creator)) as Array<{
        user_id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        subscription_price_cents: number | null;
        is_verified: boolean;
      }>,
      posts: postIds
        .map((id) => (posts ?? []).find((post) => post.id === id))
        .filter((post): post is NonNullable<typeof post> => Boolean(post))
        .map((post) => {
          const author = profileById.get(post.creator_id);
          return {
            ...post,
            author: author
              ? {
                  username: author.username,
                  display_name: author.display_name,
                  avatar_url: author.avatar_url,
                  is_verified: author.is_verified,
                }
              : null,
          };
        })
        .filter((post) => post.author !== null) as Array<{
        id: string;
        creator_id: string;
        body: string | null;
        visibility: string;
        price_cents: number;
        created_at: string;
        author: {
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          is_verified: boolean;
        };
      }>,
      mediaByPostId: mediaByPost,
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

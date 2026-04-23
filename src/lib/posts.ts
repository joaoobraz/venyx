import { supabase } from "@/integrations/supabase/client";
import type { PostWithRelations } from "@/components/PostCard";

export async function fetchPosts(opts: {
  creatorId?: string;
  viewerId?: string | null;
  limit?: number;
}): Promise<PostWithRelations[]> {
  const { creatorId, viewerId, limit = 30 } = opts;
  let q = supabase
    .from("posts")
    .select(
      `
      id, creator_id, body, visibility, price_cents,
      likes_count, comments_count, created_at,
      author:profiles!inner(username, display_name, avatar_url, is_verified, user_id),
      media:post_media(id, storage_path, mime_type, position)
      `
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (creatorId) q = q.eq("creator_id", creatorId);

  // Match the implicit relation by user_id
  const { data, error } = await q;
  if (error) throw error;

  type Row = {
    id: string;
    creator_id: string;
    body: string | null;
    visibility: "public" | "subscribers" | "ppv";
    price_cents: number;
    likes_count: number;
    comments_count: number;
    created_at: string;
    author: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      is_verified: boolean;
      user_id: string;
    } | { username: string; display_name: string | null; avatar_url: string | null; is_verified: boolean; user_id: string }[];
    media: { id: string; storage_path: string; mime_type: string; position: number }[];
  };

  const rows = (data ?? []) as unknown as Row[];

  // unlocks/subs do viewer
  let unlocks = new Set<string>();
  let subs = new Set<string>();
  if (viewerId) {
    const [{ data: u }, { data: s }] = await Promise.all([
      supabase.from("ppv_unlocks").select("post_id").eq("user_id", viewerId),
      supabase.from("subscriptions").select("creator_id").eq("subscriber_id", viewerId).eq("status", "active"),
    ]);
    unlocks = new Set((u ?? []).map((r: { post_id: string }) => r.post_id));
    subs = new Set((s ?? []).map((r: { creator_id: string }) => r.creator_id));
  }

  return rows
    .filter((r) => r.author && (Array.isArray(r.author) ? r.author.length > 0 : true))
    .map((r) => {
      const a = Array.isArray(r.author) ? r.author[0] : r.author;
      return {
        id: r.id,
        creator_id: r.creator_id,
        body: r.body,
        visibility: r.visibility,
        price_cents: r.price_cents,
        likes_count: r.likes_count,
        comments_count: r.comments_count,
        created_at: r.created_at,
        author: {
          username: a.username,
          display_name: a.display_name,
          avatar_url: a.avatar_url,
          is_verified: a.is_verified,
        },
        media: (r.media ?? []).sort((m1, m2) => m1.position - m2.position),
        unlocked: unlocks.has(r.id),
        subscribed: subs.has(r.creator_id),
      };
    });
}

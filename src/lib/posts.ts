import { supabase } from "@/integrations/supabase/client";
import type { PostWithRelations } from "@/components/PostCard";
import { DEMO_MODE, getDemoAsset } from "@/lib/demo-creators";

function demoCommentsCount(postId: string) {
  if (!DEMO_MODE || typeof window === "undefined") return 0;
  try {
    const comments = JSON.parse(
      localStorage.getItem(`venyx-demo-comments:${postId}`) ?? "[]",
    ) as unknown[];
    return comments.length;
  } catch {
    return 0;
  }
}

export async function fetchPosts(opts: {
  creatorId?: string;
  postId?: string;
  viewerId?: string | null;
  limit?: number;
}): Promise<PostWithRelations[]> {
  const { creatorId, postId, viewerId, limit = 30 } = opts;
  let q = supabase
    .from("posts")
    .select("id, creator_id, body, visibility, price_cents, likes_count, comments_count, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (postId) {
    q = q.eq("id", postId).limit(1);
  } else if (creatorId) {
    q = q.eq("creator_id", creatorId);
  }

  const { data: posts, error } = await q;
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const ids = posts.map((p) => p.id);
  const creatorIds = Array.from(new Set(posts.map((p) => p.creator_id)));

  const [{ data: media }, { data: authors }, { data: goals }, { data: likedRows }] = await Promise.all([
    supabase
      .from("post_media")
      .select("id, post_id, storage_path, mime_type, position")
      .in("post_id", ids),
    supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, is_verified, watermark_position, watermark_opacity")
      .in("user_id", creatorIds),
    supabase
      .from("post_goals")
      .select("post_id, target_cents, raised_cents, unlock_price_cents, is_unlocked")
      .in("post_id", ids),
    viewerId
      ? supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", viewerId)
          .in("post_id", ids)
      : Promise.resolve({ data: [] as Array<{ post_id: string }>, error: null }),
  ]);

  const mediaByPost = new Map<string, { id: string; storage_path: string; mime_type: string; position: number }[]>();
  (media ?? []).forEach((m) => {
    const list = mediaByPost.get(m.post_id) ?? [];
    list.push({ id: m.id, storage_path: m.storage_path, mime_type: m.mime_type, position: m.position });
    mediaByPost.set(m.post_id, list);
  });
  const authorByUid = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; is_verified: boolean; watermark_position: string; watermark_opacity: number }>();
  (authors ?? []).forEach((a) => authorByUid.set(a.user_id, {
    username: a.username,
    display_name: a.display_name,
    avatar_url: a.avatar_url,
    is_verified: a.is_verified,
    watermark_position: a.watermark_position ?? "bottom-right",
    watermark_opacity: Number(a.watermark_opacity ?? 0.6),
  }));
  const goalByPost = new Map<string, { target_cents: number; raised_cents: number; unlock_price_cents: number; is_unlocked: boolean }>();
  (goals ?? []).forEach((g) =>
    goalByPost.set(g.post_id, {
      target_cents: g.target_cents,
      raised_cents: g.raised_cents,
      unlock_price_cents: g.unlock_price_cents,
      is_unlocked: g.is_unlocked,
    }),
  );
  const likedPostIds = new Set((likedRows ?? []).map((row) => row.post_id));

  let unlocks = new Set<string>();
  let subs = new Set<string>();
  let contributed = new Set<string>();
  let hiddenCreators = new Set<string>();
  if (viewerId) {
    const [{ data: u }, { data: s }, { data: c }, { data: b }, { data: m }] = await Promise.all([
      supabase.from("ppv_unlocks").select("post_id").eq("user_id", viewerId),
      supabase.from("subscriptions").select("creator_id").eq("subscriber_id", viewerId).eq("status", "active"),
      supabase.from("post_goal_contributions").select("post_id").eq("user_id", viewerId),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", viewerId),
      supabase.from("user_mutes").select("muted_user_id").eq("user_id", viewerId),
    ]);
    unlocks = new Set((u ?? []).map((r: { post_id: string }) => r.post_id));
    subs = new Set((s ?? []).map((r: { creator_id: string }) => r.creator_id));
    contributed = new Set((c ?? []).map((r: { post_id: string }) => r.post_id));
    hiddenCreators = new Set([
      ...(b ?? []).map((r: { blocked_id: string }) => r.blocked_id),
      ...(m ?? []).map((r: { muted_user_id: string }) => r.muted_user_id),
    ]);
  }

  return posts
    .map((p) => {
      if (hiddenCreators.has(p.creator_id)) return null;
      const a = authorByUid.get(p.creator_id);
      if (!a) return null;
      const demo = DEMO_MODE ? getDemoAsset(a.username) : null;
      const goal = goalByPost.get(p.id);
      return {
        id: p.id,
        creator_id: p.creator_id,
        body: p.body,
        visibility: p.visibility,
        price_cents: p.price_cents,
        likes_count: p.likes_count,
        comments_count: DEMO_MODE ? demoCommentsCount(p.id) : p.comments_count,
        created_at: p.created_at,
        author: demo ? { ...a, avatar_url: demo.avatar_url } : a,
        media: (mediaByPost.get(p.id) ?? []).sort((a, b) => a.position - b.position),
        unlocked: unlocks.has(p.id),
        subscribed: subs.has(p.creator_id),
        goal: goal ?? null,
        goal_contributed: contributed.has(p.id),
        liked: likedPostIds.has(p.id),
      } as PostWithRelations;
    })
    .filter((x): x is PostWithRelations => x !== null);
}

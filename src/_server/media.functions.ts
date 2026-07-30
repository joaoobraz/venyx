import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * SECURITY P0: bucket `posts` e `chat-media` agora são privados.
 * O cliente pede uma URL assinada por aqui; o servidor verifica acesso primeiro.
 */

const postMediaSchema = z.object({
  postId: z.string().uuid(),
});

const multiPostMediaSchema = z.object({
  postIds: z.array(z.string().uuid()),
});

export const getPostMediaUrls = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => postMediaSchema.parse(input))
  .handler(async ({ data }) => {
    // viewer pode ser anônimo (post público)
    let viewerId: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const auth = getRequestHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const token = auth.slice(7);
        const { data: claims } = await supabaseAdmin.auth.getClaims(token);
        viewerId = claims?.claims?.sub ?? null;
      }
    } catch {
      viewerId = null;
    }

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, creator_id, visibility")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) throw new Error("Post não encontrado");

    const hasAccess = await checkPostAccess(post, viewerId);
    if (!hasAccess) {
      return { urls: [] as Array<{ id: string; url: string; mime_type: string }> };
    }

    const { data: media, error } = await supabaseAdmin
      .from("post_media")
      .select("id, storage_path, mime_type, position")
      .eq("post_id", data.postId)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching post_media:", error);
      return { urls: [] };
    }

    const urls = await Promise.all(
      (media ?? []).map(async (m) => {
        try {
          const { data: signed } = await supabaseAdmin.storage
            .from("posts")
            .createSignedUrl(m.storage_path, 60 * 60);
          return { id: m.id, url: signed?.signedUrl ?? "", mime_type: m.mime_type };
        } catch (err) {
          console.error(`Failed to sign URL for ${m.storage_path}:`, err);
          return { id: m.id, url: "", mime_type: m.mime_type };
        }
      })
    );
    return { urls: urls.filter((u) => u.url) };
  });

/**
 * Batch load first media URL for multiple posts (more efficient)
 */
export const getFirstMediaForPosts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => multiPostMediaSchema.parse(input))
  .handler(async ({ data }) => {
    // viewer pode ser anônimo (post público)
    let viewerId: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const auth = getRequestHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const token = auth.slice(7);
        const { data: claims } = await supabaseAdmin.auth.getClaims(token);
        viewerId = claims?.claims?.sub ?? null;
      }
    } catch {
      viewerId = null;
    }

    // Check access for all posts
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id, creator_id, visibility")
      .in("id", data.postIds);

    const accessMap: Record<string, boolean> = {};
    for (const post of posts ?? []) {
      accessMap[post.id] = await checkPostAccess(post, viewerId);
    }

    // Get media for accessible posts
    const accessiblePostIds = Object.entries(accessMap)
      .filter(([, hasAccess]) => hasAccess)
      .map(([postId]) => postId);

    if (!accessiblePostIds.length) {
      return { mediaByPostId: {} as Record<string, { url: string; mime_type: string }> };
    }

    const { data: media, error } = await supabaseAdmin
      .from("post_media")
      .select("id, post_id, storage_path, mime_type, position")
      .in("post_id", accessiblePostIds)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching post_media:", error);
      return { mediaByPostId: {} };
    }

    // Build map of first media per post
    const firstMediaByPost: Record<string, { path: string; type: string; id: string }> = {};
    (media ?? []).forEach((m) => {
      if (!firstMediaByPost[m.post_id]) {
        firstMediaByPost[m.post_id] = { path: m.storage_path, type: m.mime_type, id: m.id };
      }
    });

    // Get signed URLs for all media
    const mediaByPostId: Record<string, { url: string; mime_type: string }> = {};
    await Promise.all(
      Object.entries(firstMediaByPost).map(async ([postId, mediaInfo]) => {
        try {
          const { data: signed } = await supabaseAdmin.storage
            .from("posts")
            .createSignedUrl(mediaInfo.path, 60 * 60);
          if (signed?.signedUrl) {
            mediaByPostId[postId] = { url: signed.signedUrl, mime_type: mediaInfo.type };
          }
        } catch (err) {
          console.error(`Failed to sign URL for post ${postId}:`, err);
        }
      })
    );

    return { mediaByPostId };
  });

async function checkPostAccess(
  post: { id: string; creator_id: string; visibility: string },
  viewerId: string | null
): Promise<boolean> {
  if (post.visibility === "public") return true;
  if (!viewerId) return false;
  if (post.creator_id === viewerId) return true;

  if (post.visibility === "subscribers") {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("creator_id", post.creator_id)
      .eq("subscriber_id", viewerId)
      .eq("status", "active")
      .maybeSingle();
    return !!data;
  }
  if (post.visibility === "ppv") {
    const { data } = await supabaseAdmin
      .from("ppv_unlocks")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    return !!data;
  }
  if (post.visibility === "goal") {
    const { data: g } = await supabaseAdmin
      .from("post_goals")
      .select("is_unlocked")
      .eq("post_id", post.id)
      .maybeSingle();
    if (g?.is_unlocked) return true;
    const { data: c } = await supabaseAdmin
      .from("post_goal_contributions")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    return !!c;
  }
  return false;
}

const chatMediaSchema = z.object({
  messageId: z.string().uuid(),
});

export const getChatMediaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => chatMediaSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { userId } = context;
      const { data: msg } = await supabaseAdmin
        .from("chat_messages")
        .select("id, media_path, sender_id, ppv_price_cents, subscribers_only, thread_id")
        .eq("id", data.messageId)
        .maybeSingle();
      if (!msg || !msg.media_path) {
        return { url: "", error: "NOT_FOUND" as const };
      }

      const { data: thread } = await supabaseAdmin
        .from("chat_threads")
        .select("user_a, user_b")
        .eq("id", msg.thread_id)
        .maybeSingle();
      if (!thread || (thread.user_a !== userId && thread.user_b !== userId)) {
        return { url: "", error: "FORBIDDEN" as const };
      }

      if (msg.sender_id !== userId) {
        if (msg.ppv_price_cents > 0) {
          const { data: u } = await supabaseAdmin
            .from("chat_ppv_unlocks")
            .select("message_id")
            .eq("message_id", msg.id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!u) return { url: "", error: "PPV_LOCKED" as const };
        }
        if (msg.subscribers_only) {
          const { data: s } = await supabaseAdmin
            .from("subscriptions")
            .select("id")
            .eq("creator_id", msg.sender_id)
            .eq("subscriber_id", userId)
            .eq("status", "active")
            .maybeSingle();
          if (!s) return { url: "", error: "SUBSCRIBERS_ONLY" as const };
        }
      }

      const { data: signed } = await supabaseAdmin.storage
        .from("chat-media")
        .createSignedUrl(msg.media_path, 60 * 60);
      return { url: signed?.signedUrl ?? "", error: null };
    } catch (e) {
      console.error("getChatMediaUrl failed:", e);
      return { url: "", error: "INTERNAL" as const };
    }
  });

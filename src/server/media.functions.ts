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

    const { data: media } = await supabaseAdmin
      .from("post_media")
      .select("id, storage_path, mime_type, position")
      .eq("post_id", data.postId)
      .order("position", { ascending: true });

    const urls = await Promise.all(
      (media ?? []).map(async (m) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("posts")
          .createSignedUrl(m.storage_path, 60 * 60);
        return { id: m.id, url: signed?.signedUrl ?? "", mime_type: m.mime_type };
      })
    );
    return { urls };
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
    const { userId } = context;
    const { data: msg } = await supabaseAdmin
      .from("chat_messages")
      .select("id, media_path, sender_id, ppv_price_cents, subscribers_only, thread_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg || !msg.media_path) throw new Error("Mídia não encontrada");

    const { data: thread } = await supabaseAdmin
      .from("chat_threads")
      .select("user_a, user_b")
      .eq("id", msg.thread_id)
      .maybeSingle();
    if (!thread || (thread.user_a !== userId && thread.user_b !== userId)) {
      throw new Error("Sem acesso a esta conversa");
    }

    if (msg.sender_id !== userId) {
      // Destinatário: só vê se for grátis, se tiver desbloqueado o PPV, ou se for subs-only e for assinante.
      if (msg.ppv_price_cents > 0) {
        const { data: u } = await supabaseAdmin
          .from("chat_ppv_unlocks")
          .select("message_id")
          .eq("message_id", msg.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!u) throw new Error("Mídia bloqueada (PPV não desbloqueado)");
      }
      if (msg.subscribers_only) {
        const { data: s } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("creator_id", msg.sender_id)
          .eq("subscriber_id", userId)
          .eq("status", "active")
          .maybeSingle();
        if (!s) throw new Error("Mídia bloqueada (apenas assinantes)");
      }
    }

    const { data: signed } = await supabaseAdmin.storage
      .from("chat-media")
      .createSignedUrl(msg.media_path, 60 * 60);
    return { url: signed?.signedUrl ?? "" };
  });

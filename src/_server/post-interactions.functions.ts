import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { detectExternalContact } from "@/lib/contact-guard";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PostIdSchema = z.object({
  postId: z.string().uuid(),
});

const ListCommentsSchema = PostIdSchema.extend({
  cursor: z.string().datetime().optional(),
  limit: z.number().int().min(5).max(50).default(20),
});

const CommentSchema = PostIdSchema.extend({
  body: z.string().trim().min(1).max(1000),
  parentCommentId: z.string().uuid().nullable().optional(),
});

const DeleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

const EditCommentSchema = DeleteCommentSchema.extend({
  body: z.string().trim().min(1).max(1000),
});

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  mentioned_user_ids: string[];
  body: string;
  created_at: string;
  updated_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  reply_to: {
    id: string;
    user_id: string;
    username: string;
  } | null;
  mentions: Array<{
    user_id: string;
    username: string;
  }>;
}

function commentError(message: string) {
  if (message.includes("COMMENT_RATE_LIMIT")) {
    return "Você pode publicar até 5 comentários por minuto. Aguarde um pouco.";
  }
  if (message.includes("COMMENT_DUPLICATE")) {
    return "Este comentário já foi enviado recentemente.";
  }
  if (message.includes("COMMENT_INVALID_PARENT")) {
    return "O comentário que você tentou responder não está mais disponível.";
  }
  if (message.includes("COMMENT_CREATOR_BLOCKED")) {
    return "A criadora restringiu seus comentários nesta publicação.";
  }
  if (message.includes("COMMENT_BLOCKED_KEYWORD")) {
    return "Este comentário contém uma palavra bloqueada pela criadora.";
  }
  return message;
}

function mentionUsernames(body: string) {
  return Array.from(
    new Set(
      Array.from(body.matchAll(/@([a-zA-Z0-9_.]{3,30})/g)).map((match) =>
        match[1].toLowerCase(),
      ),
    ),
  ).slice(0, 10);
}

export const togglePostLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => PostIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: lookupError } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);

    let liked = false;
    if (existing) {
      const { error } = await supabase.from("post_likes").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("post_likes").insert({
        post_id: data.postId,
        user_id: userId,
      });
      if (error) throw new Error(error.message);
      liked = true;
    }

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("likes_count")
      .eq("id", data.postId)
      .single();
    if (postError) throw new Error(postError.message);

    return { liked, likesCount: post.likes_count };
  });

export const listPostComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ListCommentsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let query = supabase
      .from("post_comments")
      .select(
        "id, post_id, user_id, parent_comment_id, mentioned_user_ids, body, created_at, updated_at",
      )
      .eq("post_id", data.postId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.cursor) query = query.lt("created_at", data.cursor);

    const [{ data: newestRows, error }, { count: totalCount }] = await Promise.all([
      query,
      supabase
        .from("post_comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", data.postId),
    ]);
    if (error) throw new Error(commentError(error.message));

    const rows = [...(newestRows ?? [])].reverse();
    const parentIds = Array.from(
      new Set(
        rows
          .map((row) => row.parent_comment_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const { data: parentRows, error: parentError } = parentIds.length
      ? await supabase
          .from("post_comments")
          .select("id, user_id")
          .in("id", parentIds)
      : { data: [], error: null };
    if (parentError) throw new Error(parentError.message);

    const userIds = Array.from(
      new Set([
        ...rows.map((row) => row.user_id),
        ...rows.flatMap((row) => row.mentioned_user_ids ?? []),
        ...(parentRows ?? []).map((row) => row.user_id),
      ]),
    );
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);

    const profileByUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    const parentById = new Map((parentRows ?? []).map((parent) => [parent.id, parent]));
    const comments = rows.map((row) => {
      const author = profileByUser.get(row.user_id);
      const parent = row.parent_comment_id
        ? parentById.get(row.parent_comment_id)
        : null;
      const parentAuthor = parent ? profileByUser.get(parent.user_id) : null;
      return {
        ...row,
        mentioned_user_ids: row.mentioned_user_ids ?? [],
        author: {
          username: author?.username ?? "usuario",
          display_name: author?.display_name ?? null,
          avatar_url: author?.avatar_url ?? null,
        },
        reply_to:
          parent && parentAuthor
            ? {
                id: parent.id,
                user_id: parent.user_id,
                username: parentAuthor.username,
              }
            : null,
        mentions: (row.mentioned_user_ids ?? [])
          .map((userId) => {
            const profile = profileByUser.get(userId);
            return profile ? { user_id: userId, username: profile.username } : null;
          })
          .filter(
            (mention): mention is { user_id: string; username: string } => Boolean(mention),
          ),
      };
    });
    const oldestRow = newestRows?.[newestRows.length - 1];

    return {
      comments: comments as PostComment[],
      totalCount: totalCount ?? 0,
      nextCursor:
        newestRows && newestRows.length === data.limit && oldestRow
          ? oldestRow.created_at
          : null,
    };
  });

export const addPostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CommentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const body = data.body.trim();
    const detection = detectExternalContact(body);
    if (detection.blocked) {
      await supabase.from("moderation_logs").insert({
        user_id: userId,
        surface: "comment",
        category: "contact_share",
        reason: detection.matches
          .map((match) => `${match.label}: ${match.sample}`)
          .join(" | ")
          .slice(0, 500),
      });
      throw new Error(
        "Comentário bloqueado: não compartilhe contatos, redes sociais ou links externos.",
      );
    }
    if (/(\S)\1{14,}/u.test(body) || body.split(/\s+/).length > 180) {
      throw new Error("Comentário bloqueado por possível spam.");
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const [{ count: recentCount }, { data: duplicate }] = await Promise.all([
      supabase
        .from("post_comments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since),
      supabase
        .from("post_comments")
        .select("id")
        .eq("user_id", userId)
        .eq("body", body)
        .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
        .limit(1)
        .maybeSingle(),
    ]);
    if ((recentCount ?? 0) >= 5) {
      throw new Error("Você pode publicar até 5 comentários por minuto. Aguarde um pouco.");
    }
    if (duplicate) throw new Error("Este comentário já foi enviado recentemente.");

    if (data.parentCommentId) {
      const { data: parent, error: parentError } = await supabase
        .from("post_comments")
        .select("id, post_id")
        .eq("id", data.parentCommentId)
        .maybeSingle();
      if (parentError || !parent || parent.post_id !== data.postId) {
        throw new Error("O comentário que você tentou responder não está mais disponível.");
      }
    }

    const usernames = mentionUsernames(body);
    const { data: mentionedProfiles } = usernames.length
      ? await supabase
          .from("profiles")
          .select("user_id, username")
          .in("username", usernames)
      : { data: [] };
    const mentionedUserIds = Array.from(
      new Set(
        (mentionedProfiles ?? [])
          .map((profile) => profile.user_id)
          .filter((id) => id !== userId),
      ),
    );

    const { data: row, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: data.postId,
        user_id: userId,
        parent_comment_id: data.parentCommentId ?? null,
        mentioned_user_ids: mentionedUserIds,
        body,
      })
      .select(
        "id, post_id, user_id, parent_comment_id, mentioned_user_ids, body, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(commentError(error.message));

    const [{ data: author }, { count: commentsCount }, { data: parentRow }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name, avatar_url")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("post_comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", data.postId),
        data.parentCommentId
          ? supabase
              .from("post_comments")
              .select("id, user_id")
              .eq("id", data.parentCommentId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    const parentProfile = parentRow
      ? await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", parentRow.user_id)
          .maybeSingle()
      : { data: null };

    return {
      comment: {
        ...row,
        mentioned_user_ids: mentionedUserIds,
        author: {
          username: author?.username ?? "usuario",
          display_name: author?.display_name ?? null,
          avatar_url: author?.avatar_url ?? null,
        },
        reply_to:
          parentRow && parentProfile.data
            ? {
                id: parentRow.id,
                user_id: parentRow.user_id,
                username: parentProfile.data.username,
              }
            : null,
        mentions: (mentionedProfiles ?? []).map((profile) => ({
          user_id: profile.user_id,
          username: profile.username,
        })),
      } as PostComment,
      commentsCount: commentsCount ?? 0,
    };
  });

export const deletePostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => DeleteCommentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error: lookupError } = await supabase
      .from("post_comments")
      .select("id, post_id")
      .eq("id", data.commentId)
      .single();
    if (lookupError) throw new Error(lookupError.message);

    const { error } = await supabase.from("post_comments").delete().eq("id", data.commentId);
    if (error) throw new Error(error.message);

    const { count } = await supabase
      .from("post_comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", row.post_id);
    return { commentsCount: count ?? 0 };
  });

export const editPostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => EditCommentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const body = data.body.trim();
    const detection = detectExternalContact(body);
    if (detection.blocked) {
      await supabase.from("moderation_logs").insert({
        user_id: userId,
        surface: "comment",
        category: "contact_share",
        reason: detection.matches
          .map((match) => `${match.label}: ${match.sample}`)
          .join(" | ")
          .slice(0, 500),
      });
      throw new Error(
        "Comentário bloqueado: não compartilhe contatos, redes sociais ou links externos.",
      );
    }
    if (/(\S)\1{14,}/u.test(body) || body.split(/\s+/).length > 180) {
      throw new Error("Comentário bloqueado por possível spam.");
    }

    const { data: current, error: lookupError } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, created_at")
      .eq("id", data.commentId)
      .maybeSingle();
    if (lookupError || !current || current.user_id !== userId) {
      throw new Error("Comentário não encontrado ou sem permissão.");
    }
    if (Date.now() - new Date(current.created_at).getTime() > 15 * 60_000) {
      throw new Error("O prazo de 15 minutos para editar este comentário terminou.");
    }

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("creator_id")
      .eq("id", current.post_id)
      .maybeSingle();
    if (post) {
      const { data: rules } = await supabaseAdmin
        .from("creator_moderation_rules")
        .select("value")
        .eq("creator_id", post.creator_id)
        .eq("kind", "keyword")
        .eq("is_active", true);
      const normalizedBody = body.toLocaleLowerCase("pt-BR");
      if (
        (rules ?? []).some(
          (rule) =>
            rule.value &&
            normalizedBody.includes(rule.value.trim().toLocaleLowerCase("pt-BR")),
        )
      ) {
        throw new Error("Este comentário contém uma palavra bloqueada pela criadora.");
      }
    }

    const usernames = mentionUsernames(body);
    const { data: mentionedProfiles } = usernames.length
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, username")
          .in("username", usernames)
      : { data: [] };
    const mentionedUserIds = Array.from(
      new Set(
        (mentionedProfiles ?? [])
          .map((profile) => profile.user_id)
          .filter((id) => id !== userId),
      ),
    );

    const { data: updated, error } = await supabaseAdmin
      .from("post_comments")
      .update({
        body,
        mentioned_user_ids: mentionedUserIds,
      })
      .eq("id", current.id)
      .eq("user_id", userId)
      .select("id, body, mentioned_user_ids, updated_at")
      .single();
    if (error) throw new Error(commentError(error.message));

    return {
      id: updated.id,
      body: updated.body,
      mentioned_user_ids: updated.mentioned_user_ids ?? [],
      updated_at: updated.updated_at,
      mentions: (mentionedProfiles ?? []).map((profile) => ({
        user_id: profile.user_id,
        username: profile.username,
      })),
    };
  });

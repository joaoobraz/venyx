import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const KeywordSchema = z.object({
  keyword: z.string().trim().min(2).max(60),
});

const UsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,30}$/),
});

const RuleIdSchema = z.object({
  ruleId: z.string().uuid(),
});

const ManualApprovalSchema = z.object({
  enabled: z.boolean(),
});

const ModerateCommentSchema = z.object({
  commentId: z.string().uuid(),
  action: z.enum(["publish", "hide", "reject", "delete"]),
});

const ReportCommentSchema = z.object({
  commentId: z.string().uuid(),
  reason: z.string().trim().min(2).max(100).default("creator_report"),
});

async function assertCreator(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "creator",
  });
  if (error || data !== true) {
    throw new Error("Apenas criadoras podem acessar esta moderação.");
  }
}

async function getOwnedComment(commentId: string, creatorId: string) {
  const { data: comment, error } = await supabaseAdmin
    .from("post_comments")
    .select("id, post_id, user_id, moderation_status")
    .eq("id", commentId)
    .maybeSingle();
  if (error || !comment) throw new Error("Comentário não encontrado.");
  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("creator_id")
    .eq("id", comment.post_id)
    .maybeSingle();
  if (!post || post.creator_id !== creatorId) {
    throw new Error("Você não tem permissão para moderar este comentário.");
  }
  return comment;
}

export const listCreatorModeration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCreator(supabase, userId);

    const [
      { data: rules, error: rulesError },
      { data: posts },
      { data: settings },
    ] = await Promise.all([
      supabase
        .from("creator_moderation_rules")
        .select("id, kind, value, blocked_user_id, is_active, created_at")
        .eq("creator_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("posts").select("id").eq("creator_id", userId),
      supabaseAdmin
        .from("creator_comment_settings")
        .select("manual_approval")
        .eq("creator_id", userId)
        .maybeSingle(),
    ]);
    if (rulesError) throw new Error(rulesError.message);

    const postIds = (posts ?? []).map((post) => post.id);
    const { data: commentRows } = postIds.length
      ? await supabaseAdmin
          .from("post_comments")
          .select("id, post_id, user_id, body, moderation_status, created_at, updated_at")
          .in("post_id", postIds)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString())
          .order("created_at", { ascending: false })
          .limit(2000)
      : { data: [] };

    const commentIds = (commentRows ?? []).map((comment) => comment.id);
    const { data: reportRows } = commentIds.length
      ? await supabaseAdmin
          .from("content_reports")
          .select("target_id")
          .eq("target_type", "comment")
          .in("target_id", commentIds)
      : { data: [] };
    const reportCountByComment = new Map<string, number>();
    for (const report of reportRows ?? []) {
      reportCountByComment.set(
        report.target_id,
        (reportCountByComment.get(report.target_id) ?? 0) + 1,
      );
    }

    const activity = new Map<
      string,
      { commentsCount: number; reportsCount: number; lastCommentAt: string }
    >();
    for (const comment of commentRows ?? []) {
      const current = activity.get(comment.user_id);
      activity.set(comment.user_id, {
        commentsCount: (current?.commentsCount ?? 0) + 1,
        reportsCount:
          (current?.reportsCount ?? 0) +
          (reportCountByComment.get(comment.id) ?? 0),
        lastCommentAt: current?.lastCommentAt ?? comment.created_at,
      });
    }

    const blockedIds = (rules ?? [])
      .map((rule) => rule.blocked_user_id)
      .filter((id): id is string => Boolean(id));
    const profileIds = Array.from(new Set([...activity.keys(), ...blockedIds]));
    const { data: profiles } = profileIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", profileIds)
      : { data: [] };
    const profilesById = new Map(
      (profiles ?? []).map((profile) => [profile.user_id, profile]),
    );

    return {
      rules: (rules ?? []).map((rule) => ({
        ...rule,
        blockedProfile: rule.blocked_user_id
          ? (profilesById.get(rule.blocked_user_id) ?? null)
          : null,
      })),
      settings: {
        manualApproval: settings?.manual_approval ?? false,
      },
      comments: (commentRows ?? []).map((comment) => ({
        ...comment,
        reportsCount: reportCountByComment.get(comment.id) ?? 0,
        profile: profilesById.get(comment.user_id) ?? {
          user_id: comment.user_id,
          username: "usuario",
          display_name: null,
          avatar_url: null,
        },
      })),
      recurringUsers: Array.from(activity.entries())
        .map(([userId, summary]) => ({
          userId,
          ...summary,
          profile: profilesById.get(userId) ?? {
            user_id: userId,
            username: "usuario",
            display_name: null,
            avatar_url: null,
          },
        }))
        .sort(
          (first, second) =>
            second.reportsCount - first.reportsCount ||
            second.commentsCount - first.commentsCount,
        )
        .slice(0, 25),
    };
  });

export const addCreatorKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => KeywordSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCreator(supabase, userId);
    const { error } = await supabase.from("creator_moderation_rules").insert({
      creator_id: userId,
      kind: "keyword",
      value: data.keyword.trim(),
      blocked_user_id: null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Esta palavra já está na lista.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const blockCreatorCommenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => UsernameSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCreator(supabase, userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();
    if (!profile) throw new Error("Usuário não encontrado.");
    if (profile.user_id === userId) throw new Error("Você não pode bloquear seu próprio perfil.");

    const { error } = await supabase.from("creator_moderation_rules").insert({
      creator_id: userId,
      kind: "user",
      value: null,
      blocked_user_id: profile.user_id,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Este usuário já está bloqueado.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeCreatorModerationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => RuleIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCreator(supabase, userId);
    const { error } = await supabase
      .from("creator_moderation_rules")
      .delete()
      .eq("id", data.ruleId)
      .eq("creator_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCreatorManualApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ManualApprovalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCreator(supabase, userId);
    const { error } = await supabase.from("creator_comment_settings").upsert({
      creator_id: userId,
      manual_approval: data.enabled,
    });
    if (error) throw new Error(error.message);
    return { ok: true, manualApproval: data.enabled };
  });

export const moderateCreatorComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ModerateCommentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCreator(supabase, userId);
    const comment = await getOwnedComment(data.commentId, userId);

    if (data.action === "delete") {
      const { error } = await supabaseAdmin.from("post_comments").delete().eq("id", comment.id);
      if (error) throw new Error(error.message);
      return { ok: true, status: "deleted" as const };
    }

    const moderationStatus = {
      publish: "published",
      hide: "hidden",
      reject: "rejected",
    }[data.action];
    const { error } = await supabaseAdmin
      .from("post_comments")
      .update({
        moderation_status: moderationStatus,
        moderated_at: new Date().toISOString(),
        moderated_by: userId,
      })
      .eq("id", comment.id);
    if (error) throw new Error(error.message);
    return { ok: true, status: moderationStatus };
  });

export const reportCreatorComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ReportCommentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCreator(supabase, userId);
    const comment = await getOwnedComment(data.commentId, userId);
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: userId,
      target_type: "comment",
      target_id: comment.id,
      reported_user_id: comment.user_id,
      reason: data.reason,
      details: "Comentário denunciado pela criadora durante a moderação.",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

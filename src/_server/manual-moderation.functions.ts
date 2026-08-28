import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdultVerification, requireSupabaseMfa } from "@/_server/access-control.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAdminAction as auditLog } from "@/_server/admin-audit.server";

const surfaceSchema = z.enum(["post", "story", "chat"]);
const submitSchema = z.object({
  surface: surfaceSchema,
  targetId: z.string().uuid(),
});

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

async function resolveOwnedSubmission(
  surface: z.infer<typeof surfaceSchema>,
  targetId: string,
  userId: string,
) {
  if (surface === "post") {
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, creator_id, moderation_status")
      .eq("id", targetId)
      .maybeSingle();
    if (!post || post.creator_id !== userId || post.moderation_status !== "pending") {
      throw new Error("Publicação não encontrada ou fora da fila.");
    }
    const { data: media } = await supabaseAdmin
      .from("post_media")
      .select("storage_path, cover_storage_path")
      .eq("post_id", targetId)
      .order("position", { ascending: true });
    const paths = (media ?? []).flatMap((item) =>
      [item.storage_path, item.cover_storage_path].filter((path): path is string => Boolean(path)),
    );
    if (paths.some((path) => !path.startsWith(`${userId}/${targetId}/`))) {
      throw new Error("Caminho de mídia inválido.");
    }
    return { bucket: "posts", paths };
  }

  if (surface === "story") {
    const { data: story } = await supabaseAdmin
      .from("stories")
      .select("id, creator_id, media_path, moderation_status")
      .eq("id", targetId)
      .maybeSingle();
    if (!story || story.creator_id !== userId || story.moderation_status !== "pending") {
      throw new Error("Story não encontrado ou fora da fila.");
    }
    if (!story.media_path.startsWith(`${userId}/`)) throw new Error("Caminho de mídia inválido.");
    return { bucket: "stories", paths: [story.media_path] };
  }

  const { data: message } = await supabaseAdmin
    .from("chat_messages")
    .select("id, sender_id, media_path, moderation_status")
    .eq("id", targetId)
    .maybeSingle();
  if (
    !message ||
    message.sender_id !== userId ||
    !message.media_path ||
    message.moderation_status !== "pending"
  ) {
    throw new Error("Mensagem não encontrada ou fora da fila.");
  }
  if (!message.media_path.startsWith(`${userId}/`)) throw new Error("Caminho de mídia inválido.");
  return { bucket: "chat-media", paths: [message.media_path] };
}

/** Registra uma publicação já armazenada no bucket privado para revisão humana. */
export const submitManualMediaReview = createServerFn({ method: "POST" })
  .middleware([requireAdultVerification])
  .validator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const resolved = await resolveOwnedSubmission(data.surface, data.targetId, context.userId);
    const { error } = await supabaseAdmin.from("manual_media_reviews").upsert(
      {
        user_id: context.userId,
        surface: data.surface,
        target_id: data.targetId,
        bucket: resolved.bucket,
        storage_paths: resolved.paths,
        status: "pending",
        note: null,
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "surface,target_id" },
    );
    if (error) {
      console.error("[manual-moderation.submit]", error);
      throw new Error("Não foi possível enviar para revisão.");
    }
    return { ok: true as const, status: "pending" as const };
  });

const listSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
  limit: z.number().int().min(1).max(200).default(100),
});

export const listManualMediaReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let query = supabaseAdmin
      .from("manual_media_reviews")
      .select("*")
      .order("created_at", { ascending: data.status !== "pending" })
      .limit(data.limit);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error("Não foi possível carregar a fila manual.");

    const profileIds = Array.from(new Set((rows ?? []).map((row) => row.user_id)));
    const { data: profiles } = profileIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, username, display_name")
          .in("user_id", profileIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

    const enriched = await Promise.all(
      (rows ?? []).map(async (row) => {
        let body: string | null = null;
        let detail: string | null = null;
        if (row.surface === "post") {
          const { data: post } = await supabaseAdmin
            .from("posts")
            .select("body, visibility")
            .eq("id", row.target_id)
            .maybeSingle();
          body = post?.body ?? null;
          detail = post?.visibility ?? null;
        } else if (row.surface === "chat") {
          const { data: message } = await supabaseAdmin
            .from("chat_messages")
            .select("body, ppv_price_cents, subscribers_only")
            .eq("id", row.target_id)
            .maybeSingle();
          body = message?.body ?? null;
          detail = message?.ppv_price_cents
            ? `PPV R$ ${(message.ppv_price_cents / 100).toFixed(2)}`
            : message?.subscribers_only
              ? "assinantes"
              : "livre";
        }

        const { data: signed } = row.storage_paths.length
          ? await supabaseAdmin.storage.from(row.bucket).createSignedUrls(row.storage_paths, 300)
          : { data: [] };
        const profile = profileById.get(row.user_id);
        return {
          ...row,
          username: profile?.username ?? null,
          displayName: profile?.display_name ?? null,
          body,
          detail,
          mediaUrls: (signed ?? [])
            .map((item) => item.signedUrl)
            .filter((url): url is string => Boolean(url)),
        };
      }),
    );
    return { reviews: enriched };
  });

const decisionSchema = z.object({
  reviewId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().min(5).max(2000),
});

export const reviewManualMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => decisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: review, error: lookupError } = await supabaseAdmin
      .from("manual_media_reviews")
      .select("*")
      .eq("id", data.reviewId)
      .maybeSingle();
    if (lookupError || !review) throw new Error("Item de revisão não encontrado.");
    if (review.status !== "pending") throw new Error("Este item já foi decidido.");

    const now = new Date().toISOString();
    const targetUpdate = {
      moderation_status: data.decision,
      moderation_note: data.note,
      moderated_by: context.userId,
      moderated_at: now,
    };
    let targetError: { message?: string } | null;
    if (review.surface === "post") {
      ({ error: targetError } = await supabaseAdmin
        .from("posts")
        .update(targetUpdate)
        .eq("id", review.target_id));
    } else if (review.surface === "story") {
      ({ error: targetError } = await supabaseAdmin
        .from("stories")
        .update({
          ...targetUpdate,
          ...(data.decision === "approved"
            ? { expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
            : {}),
        })
        .eq("id", review.target_id));
    } else {
      ({ error: targetError } = await supabaseAdmin
        .from("chat_messages")
        .update(targetUpdate)
        .eq("id", review.target_id));
    }
    if (targetError) {
      console.error("[manual-moderation.target]", targetError);
      throw new Error("Não foi possível aplicar a decisão ao conteúdo.");
    }

    const { error: reviewError } = await supabaseAdmin
      .from("manual_media_reviews")
      .update({
        status: data.decision,
        note: data.note,
        reviewed_by: context.userId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", review.id);
    if (reviewError) throw new Error("Conteúdo decidido, mas a fila não foi atualizada.");

    await auditLog({
      adminId: context.userId,
      actionType: `manual_media_${data.decision}`,
      targetType: review.surface,
      targetId: review.target_id,
      targetUserId: review.user_id,
      metadata: { reviewId: review.id, note: data.note },
    });
    return { ok: true as const };
  });

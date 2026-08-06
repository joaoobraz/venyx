import type { PostComment } from "@/_server/post-interactions.functions";
import { getDemoCommentSeeds, type DemoLocale } from "@/lib/demo-content";
import { evaluateCommentModerationPolicy } from "@/lib/comment-moderation-policy";

export type DemoCommentStatus = "published" | "pending" | "hidden" | "rejected" | "deleted";

export interface DemoModeratedComment extends PostComment {
  moderation_status: DemoCommentStatus;
  reports_count: number;
  reported_by_creator: boolean;
}

export interface DemoCommentModerationState {
  creator_id: string;
  manual_approval: boolean;
  blocked_keywords: string[];
  blocked_user_ids: string[];
  comments: DemoModeratedComment[];
  updated_at: string;
}

export const DEMO_COMMENT_MODERATION_CHANGED_EVENT = "venyx:demo-comment-moderation-changed";
const STORAGE_VERSION = "v1";
const ALINE_POST_ID = "demo-post-aline-studio";

function storageKey(creatorId: string) {
  return `venyx:demo-comment-moderation:${STORAGE_VERSION}:${creatorId}`;
}

function nowMinus(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function makeComment(input: {
  id: string;
  username: string;
  displayName: string;
  userId: string;
  body: string;
  status: DemoCommentStatus;
  minutesAgo: number;
  reports?: number;
}): DemoModeratedComment {
  const createdAt = nowMinus(input.minutesAgo);
  return {
    id: input.id,
    post_id: ALINE_POST_ID,
    user_id: input.userId,
    parent_comment_id: null,
    mentioned_user_ids: [],
    body: input.body,
    created_at: createdAt,
    updated_at: createdAt,
    author: {
      username: input.username,
      display_name: input.displayName,
      avatar_url: null,
    },
    reply_to: null,
    mentions: [],
    moderation_status: input.status,
    reports_count: input.reports ?? 0,
    reported_by_creator: false,
  };
}

function createSeed(creatorId: string): DemoCommentModerationState {
  const published = getDemoCommentSeeds(ALINE_POST_ID, "pt-BR").map(
    (comment): DemoModeratedComment => ({
      ...comment,
      moderation_status: "published",
      reports_count: 0,
      reported_by_creator: false,
    }),
  );
  return {
    creator_id: creatorId,
    manual_approval: false,
    blocked_keywords: ["telegram", "golpe", "pix por fora"],
    blocked_user_ids: [],
    comments: [
      makeComment({
        id: "demo-moderation-pending-1",
        username: "marcos_88",
        displayName: "Marcos",
        userId: "demo-commenter-marcos",
        body: "Gostei muito desse ensaio. Quando sai a próxima parte?",
        status: "pending",
        minutesAgo: 12,
      }),
      makeComment({
        id: "demo-moderation-pending-2",
        username: "fabioclub",
        displayName: "Fábio",
        userId: "demo-commenter-fabio",
        body: "A iluminação ficou incrível, parabéns pela produção!",
        status: "pending",
        minutesAgo: 28,
      }),
      makeComment({
        id: "demo-moderation-hidden-1",
        username: "perfil_insistente",
        displayName: "Perfil insistente",
        userId: "demo-commenter-insistente",
        body: "Comentário repetido em várias publicações.",
        status: "hidden",
        minutesAgo: 95,
        reports: 2,
      }),
      ...published,
    ],
    updated_at: new Date().toISOString(),
  };
}

function normalizeState(
  creatorId: string,
  value: Partial<DemoCommentModerationState>,
): DemoCommentModerationState {
  const seed = createSeed(creatorId);
  return {
    creator_id: creatorId,
    manual_approval: value.manual_approval ?? seed.manual_approval,
    blocked_keywords: value.blocked_keywords ?? seed.blocked_keywords,
    blocked_user_ids: value.blocked_user_ids ?? seed.blocked_user_ids,
    comments: (value.comments ?? seed.comments).map((comment) => ({
      ...comment,
      moderation_status: comment.moderation_status ?? "published",
      reports_count: comment.reports_count ?? 0,
      reported_by_creator: comment.reported_by_creator ?? false,
    })),
    updated_at: value.updated_at ?? seed.updated_at,
  };
}

export function readDemoCommentModeration(creatorId: string): DemoCommentModerationState {
  const seed = createSeed(creatorId);
  if (typeof window === "undefined") return seed;
  try {
    const stored = window.localStorage.getItem(storageKey(creatorId));
    if (stored) return normalizeState(creatorId, JSON.parse(stored));
  } catch {
    // Invalid local-only moderation data is replaced with a safe seed.
  }
  window.localStorage.setItem(storageKey(creatorId), JSON.stringify(seed));
  return seed;
}

export function writeDemoCommentModeration(state: DemoCommentModerationState) {
  const next = { ...state, updated_at: new Date().toISOString() };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(state.creator_id), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(DEMO_COMMENT_MODERATION_CHANGED_EVENT, {
        detail: { creatorId: state.creator_id },
      }),
    );
  }
  return next;
}

export function updateDemoCommentModeration(
  creatorId: string,
  update: (state: DemoCommentModerationState) => DemoCommentModerationState,
) {
  return writeDemoCommentModeration(update(readDemoCommentModeration(creatorId)));
}

function commentStorageKey(postId: string, locale: DemoLocale) {
  return `venyx-demo-comments:v3:${locale}:${postId}`;
}

function syncCommentVisibility(comment: DemoModeratedComment) {
  if (typeof window === "undefined") return;
  for (const locale of ["pt-BR", "en"] as const) {
    const key = commentStorageKey(comment.post_id, locale);
    let stored: PostComment[];
    try {
      stored = JSON.parse(window.localStorage.getItem(key) ?? "null") as PostComment[];
      if (!Array.isArray(stored)) stored = getDemoCommentSeeds(comment.post_id, locale);
    } catch {
      stored = getDemoCommentSeeds(comment.post_id, locale);
    }
    const withoutComment = stored.filter((item) => item.id !== comment.id);
    const next =
      comment.moderation_status === "published"
        ? [...withoutComment, comment].sort(
            (first, second) =>
              new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
          )
        : withoutComment;
    window.localStorage.setItem(key, JSON.stringify(next.slice(-500)));
  }
}

export function setDemoCommentStatus(
  creatorId: string,
  commentId: string,
  status: DemoCommentStatus,
) {
  let changed: DemoModeratedComment | null = null;
  const next = updateDemoCommentModeration(creatorId, (state) => ({
    ...state,
    comments: state.comments.map((comment) => {
      if (comment.id !== commentId) return comment;
      changed = { ...comment, moderation_status: status, updated_at: new Date().toISOString() };
      return changed;
    }),
  }));
  if (changed) syncCommentVisibility(changed);
  return next;
}

export function reportDemoComment(creatorId: string, commentId: string) {
  return updateDemoCommentModeration(creatorId, (state) => ({
    ...state,
    comments: state.comments.map((comment) =>
      comment.id === commentId
        ? {
            ...comment,
            reports_count: comment.reports_count + (comment.reported_by_creator ? 0 : 1),
            reported_by_creator: true,
          }
        : comment,
    ),
  }));
}

export function blockDemoCommentUser(creatorId: string, userId: string) {
  const changed: DemoModeratedComment[] = [];
  const next = updateDemoCommentModeration(creatorId, (state) => ({
    ...state,
    blocked_user_ids: Array.from(new Set([...state.blocked_user_ids, userId])),
    comments: state.comments.map((comment) => {
      if (comment.user_id !== userId) return comment;
      const updated = {
        ...comment,
        moderation_status:
          comment.moderation_status === "pending"
            ? ("rejected" as const)
            : comment.moderation_status === "published"
              ? ("hidden" as const)
              : comment.moderation_status,
      };
      changed.push(updated);
      return updated;
    }),
  }));
  changed.forEach(syncCommentVisibility);
  return next;
}

export function setDemoManualApproval(creatorId: string, enabled: boolean) {
  return updateDemoCommentModeration(creatorId, (state) => ({
    ...state,
    manual_approval: enabled,
  }));
}

export function addDemoBlockedKeyword(creatorId: string, keyword: string) {
  const normalized = keyword.trim().toLocaleLowerCase("pt-BR");
  if (normalized.length < 2) return readDemoCommentModeration(creatorId);
  return updateDemoCommentModeration(creatorId, (state) => ({
    ...state,
    blocked_keywords: Array.from(new Set([...state.blocked_keywords, normalized])),
  }));
}

export function removeDemoBlockedKeyword(creatorId: string, keyword: string) {
  return updateDemoCommentModeration(creatorId, (state) => ({
    ...state,
    blocked_keywords: state.blocked_keywords.filter((item) => item !== keyword),
  }));
}

export function evaluateDemoComment(
  state: DemoCommentModerationState,
  input: { userId: string; body: string },
) {
  return evaluateCommentModerationPolicy({
    manualApproval: state.manual_approval,
    blockedKeywords: state.blocked_keywords,
    blockedUserIds: state.blocked_user_ids,
    userId: input.userId,
    body: input.body,
  });
}

export function queueDemoComment(
  creatorId: string,
  comment: PostComment,
  status: "pending" | "published",
) {
  const moderated: DemoModeratedComment = {
    ...comment,
    moderation_status: status,
    reports_count: 0,
    reported_by_creator: false,
  };
  const next = updateDemoCommentModeration(creatorId, (state) => ({
    ...state,
    comments: [moderated, ...state.comments.filter((item) => item.id !== comment.id)],
  }));
  syncCommentVisibility(moderated);
  return next;
}

export function filterVisibleDemoComments(
  creatorId: string,
  comments: PostComment[],
): PostComment[] {
  const state = readDemoCommentModeration(creatorId);
  const statusById = new Map(
    state.comments.map((comment) => [comment.id, comment.moderation_status]),
  );
  return comments.filter((comment) => (statusById.get(comment.id) ?? "published") === "published");
}

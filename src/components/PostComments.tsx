import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Pencil, Reply, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  addPostComment,
  deletePostComment,
  editPostComment,
  listPostComments,
  type PostComment,
} from "@/_server/post-interactions.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { DEMO_MODE } from "@/lib/demo-creators";
import { getDemoCommentSeeds, type DemoLocale } from "@/lib/demo-content";
import { detectExternalContact } from "@/lib/contact-guard";
import { Input } from "@/components/ui/input";
import { SafetyMenu } from "@/components/SafetyMenu";
import { NotificationMuteButton } from "@/components/NotificationMuteButton";
import { awardDemoLoyaltyPoints } from "@/lib/demo-loyalty";

const PAGE_SIZE = 20;
const demoKey = (postId: string, locale: DemoLocale) =>
  `venyx-demo-comments:v3:${locale}:${postId}`;

function normalizeDemoComment(comment: PostComment): PostComment {
  return {
    ...comment,
    parent_comment_id: comment.parent_comment_id ?? null,
    mentioned_user_ids: comment.mentioned_user_ids ?? [],
    reply_to: comment.reply_to ?? null,
    mentions: comment.mentions ?? [],
    updated_at: comment.updated_at ?? comment.created_at,
  };
}

function readDemoComments(postId: string, locale: DemoLocale): PostComment[] {
  if (typeof window === "undefined") return [];
  try {
    const key = demoKey(postId, locale);
    const existing = localStorage.getItem(key);
    if (existing) {
      return (JSON.parse(existing) as PostComment[]).map(normalizeDemoComment);
    }
    const seeded = getDemoCommentSeeds(postId, locale).map(normalizeDemoComment);
    localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

function writeDemoComments(postId: string, locale: DemoLocale, comments: PostComment[]) {
  localStorage.setItem(demoKey(postId, locale), JSON.stringify(comments.slice(-500)));
}

function demoCreatorModerationBlock(creatorId: string, userId: string, body: string) {
  try {
    const rules = JSON.parse(
      localStorage.getItem(`venyx:demo:creator-moderation:${creatorId}`) ?? "[]",
    ) as Array<{
      kind: string;
      value: string | null;
      blocked_user_id: string | null;
      is_active: boolean;
    }>;
    const normalizedBody = body.toLocaleLowerCase("pt-BR");
    if (
      rules.some(
        (rule) => rule.is_active && rule.kind === "user" && rule.blocked_user_id === userId,
      )
    ) {
      return "user";
    }
    if (
      rules.some(
        (rule) =>
          rule.is_active &&
          rule.kind === "keyword" &&
          rule.value &&
          normalizedBody.includes(rule.value.trim().toLocaleLowerCase("pt-BR")),
      )
    ) {
      return "keyword";
    }
  } catch {
    // Ignore corrupted demo-only rows.
  }
  return null;
}

function avatarUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("http") || value.startsWith("/")) return value;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${value}`;
}

function uniqueComments(comments: PostComment[]) {
  return Array.from(new Map(comments.map((comment) => [comment.id, comment])).values());
}

function CommentText({ comment }: { comment: PostComment }) {
  const mentionNames = new Set(comment.mentions.map((mention) => mention.username.toLowerCase()));
  return (
    <p data-user-content className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
      {comment.body.split(/(@[a-zA-Z0-9_.]{3,30})/g).map((part, index) => {
        const username = part.startsWith("@") ? part.slice(1).toLowerCase() : "";
        return username && mentionNames.has(username) ? (
          <Link
            key={`${part}-${index}`}
            to="/profile/$username"
            params={{ username }}
            className="font-semibold text-primary hover:underline"
          >
            {part}
          </Link>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </p>
  );
}

export function PostComments({
  postId,
  creatorId,
  open,
  onOpenChange,
  commentsCount,
  onCommentsCountChange,
}: {
  postId: string;
  creatorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commentsCount: number;
  onCommentsCountChange: (count: number) => void;
}) {
  const { user, session, profile } = useAuth();
  const { tr, locale } = useI18n();
  const isLocalDemoPost = DEMO_MODE && postId.startsWith("demo-post-");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editingBusy, setEditingBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listFn = useServerFn(listPostComments);
  const addFn = useServerFn(addPostComment);
  const deleteFn = useServerFn(deletePostComment);
  const editFn = useServerFn(editPostComment);
  const headers = useMemo(
    () => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined),
    [session?.access_token],
  );

  useEffect(() => {
    setComments([]);
    setDraft("");
    setLoaded(false);
    setNextCursor(null);
    setReplyTo(null);
    setEditingId(null);
    setEditDraft("");
  }, [postId]);

  useEffect(() => {
    if (!open || loaded || !user || !headers) return;
    setLoading(true);
    if (isLocalDemoPost) {
      const stored = readDemoComments(postId, locale);
      setComments(stored);
      setNextCursor(null);
      onCommentsCountChange(stored.length);
      setLoaded(true);
      setLoading(false);
      return;
    }
    listFn({ data: { postId, limit: PAGE_SIZE }, headers })
      .then((result) => {
        setComments(result.comments);
        setNextCursor(result.nextCursor);
        onCommentsCountChange(result.totalCount);
        setLoaded(true);
      })
      .catch(() => {
        if (DEMO_MODE) {
          const stored = readDemoComments(postId, locale);
          setComments(stored);
          setNextCursor(null);
          onCommentsCountChange(stored.length);
          setLoaded(true);
          return;
        }
        toast.error(tr("Não foi possível carregar os comentários.", "Couldn't load comments."));
      })
      .finally(() => setLoading(false));
  }, [
    headers,
    isLocalDemoPost,
    listFn,
    loaded,
    locale,
    onCommentsCountChange,
    open,
    postId,
    tr,
    user,
  ]);

  const loadPrevious = async () => {
    if (!headers || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await listFn({
        data: { postId, limit: PAGE_SIZE, cursor: nextCursor },
        headers,
      });
      setComments((current) => uniqueComments([...result.comments, ...current]));
      setNextCursor(result.nextCursor);
      onCommentsCountChange(result.totalCount);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível carregar mais.", "Couldn't load more."),
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const startReply = (comment: PostComment) => {
    setReplyTo(comment);
    const mention = `@${comment.author.username} `;
    setDraft((current) => (current.includes(mention.trim()) ? current : `${mention}${current}`));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!user || !headers) {
      toast.error(tr("Faça login para comentar.", "Sign in to comment."));
      return;
    }
    if (!body || submitting) return;

    setSubmitting(true);
    try {
      if (isLocalDemoPost) throw new Error("local-only");
      const result = await addFn({
        data: {
          postId,
          body,
          parentCommentId: replyTo?.id ?? null,
        },
        headers,
      });
      setComments((current) => uniqueComments([...current, result.comment]));
      onCommentsCountChange(result.commentsCount);
      setDraft("");
      setReplyTo(null);
      setLoaded(true);
    } catch (error) {
      if (!DEMO_MODE) {
        toast.error(
          error instanceof Error
            ? error.message
            : tr("Não foi possível publicar o comentário.", "Couldn't post the comment."),
        );
        return;
      }

      const detection = detectExternalContact(body);
      const creatorBlock = demoCreatorModerationBlock(creatorId, user.id, body);
      if (creatorBlock) {
        toast.error(
          creatorBlock === "user"
            ? tr(
                "A criadora restringiu seus comentários nesta publicação.",
                "The creator restricted your comments on this post.",
              )
            : tr(
                "Este comentário contém uma palavra bloqueada pela criadora.",
                "This comment contains a word blocked by the creator.",
              ),
        );
        return;
      }
      if (detection.blocked || /(\S)\1{14,}/u.test(body)) {
        toast.error(
          tr(
            "Comentário bloqueado por possível spam ou contato externo.",
            "Comment blocked as possible spam or external contact.",
          ),
        );
        return;
      }
      const recent = comments.filter(
        (comment) =>
          comment.user_id === user.id &&
          new Date(comment.created_at).getTime() >= Date.now() - 60_000,
      );
      if (recent.length >= 5) {
        toast.error(
          tr(
            "Você pode publicar até 5 comentários por minuto.",
            "You can post up to 5 comments per minute.",
          ),
        );
        return;
      }
      if (
        comments.some(
          (comment) =>
            comment.user_id === user.id &&
            comment.body.toLowerCase() === body.toLowerCase() &&
            new Date(comment.created_at).getTime() >= Date.now() - 5 * 60_000,
        )
      ) {
        toast.error(
          tr("Este comentário já foi enviado recentemente.", "This comment was recently posted."),
        );
        return;
      }

      const mentionedNames = Array.from(
        new Set(
          Array.from(body.matchAll(/@([a-zA-Z0-9_.]{3,30})/g)).map((match) =>
            match[1].toLowerCase(),
          ),
        ),
      );
      const fallback: PostComment = {
        id: crypto.randomUUID(),
        post_id: postId,
        user_id: user.id,
        parent_comment_id: replyTo?.id ?? null,
        mentioned_user_ids: mentionedNames,
        body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: {
          username: profile?.username ?? user.email?.split("@")[0] ?? "usuario",
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
        reply_to: replyTo
          ? {
              id: replyTo.id,
              user_id: replyTo.user_id,
              username: replyTo.author.username,
            }
          : null,
        mentions: mentionedNames.map((username) => ({ user_id: username, username })),
      };
      const next = [...comments, fallback];
      setComments(next);
      writeDemoComments(postId, locale, next);
      awardDemoLoyaltyPoints({
        userId: user.id,
        creatorId,
        points: 2,
        reason: "post_comment",
        label: "Comentário aprovado em uma publicação",
        refId: fallback.id,
      });
      onCommentsCountChange(next.length);
      setDraft("");
      setReplyTo(null);
      setLoaded(true);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (comment: PostComment) => {
    if (!headers) return;
    try {
      if (isLocalDemoPost) throw new Error("local-only");
      const result = await deleteFn({ data: { commentId: comment.id }, headers });
      setComments((current) => current.filter((item) => item.id !== comment.id));
      onCommentsCountChange(result.commentsCount);
    } catch (error) {
      if (!DEMO_MODE) {
        toast.error(
          error instanceof Error
            ? error.message
            : tr("Não foi possível excluir.", "Couldn't delete."),
        );
        return;
      }
      const next = comments
        .filter((item) => item.id !== comment.id)
        .map((item) =>
          item.parent_comment_id === comment.id
            ? { ...item, parent_comment_id: null, reply_to: null }
            : item,
        );
      setComments(next);
      writeDemoComments(postId, locale, next);
      onCommentsCountChange(next.length);
    }
  };

  const startEdit = (comment: PostComment) => {
    setEditingId(comment.id);
    setEditDraft(comment.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async (comment: PostComment) => {
    const body = editDraft.trim();
    if (!user || !headers || !body || editingBusy) return;
    setEditingBusy(true);
    try {
      if (isLocalDemoPost) throw new Error("local-only");
      const result = await editFn({
        data: { commentId: comment.id, body },
        headers,
      });
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                body: result.body,
                mentioned_user_ids: result.mentioned_user_ids,
                mentions: result.mentions,
                updated_at: result.updated_at,
              }
            : item,
        ),
      );
      cancelEdit();
    } catch (error) {
      if (!DEMO_MODE) {
        toast.error(
          error instanceof Error ? error.message : tr("Não foi possível editar.", "Couldn't edit."),
        );
        return;
      }
      const detection = detectExternalContact(body);
      const creatorBlock = demoCreatorModerationBlock(creatorId, user.id, body);
      if (creatorBlock) {
        toast.error(
          creatorBlock === "user"
            ? tr(
                "A criadora restringiu seus comentários nesta publicação.",
                "The creator restricted your comments on this post.",
              )
            : tr(
                "Este comentário contém uma palavra bloqueada pela criadora.",
                "This comment contains a word blocked by the creator.",
              ),
        );
        return;
      }
      if (detection.blocked || /(\S)\1{14,}/u.test(body)) {
        toast.error(
          tr(
            "Comentário bloqueado por possível spam ou contato externo.",
            "Comment blocked as possible spam or external contact.",
          ),
        );
        return;
      }
      const updatedAt = new Date().toISOString();
      const mentionNames = Array.from(
        new Set(
          Array.from(body.matchAll(/@([a-zA-Z0-9_.]{3,30})/g)).map((match) =>
            match[1].toLowerCase(),
          ),
        ),
      );
      const next = comments.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              body,
              updated_at: updatedAt,
              mentioned_user_ids: mentionNames,
              mentions: mentionNames.map((username) => ({
                user_id: username,
                username,
              })),
            }
          : item,
      );
      setComments(next);
      writeDemoComments(postId, locale, next);
      cancelEdit();
    } finally {
      setEditingBusy(false);
    }
  };

  const hideBlockedAuthor = (blockedUserId: string) => {
    const next = comments.filter((comment) => comment.user_id !== blockedUserId);
    onCommentsCountChange(Math.max(0, commentsCount - (comments.length - next.length)));
    setComments(next);
  };

  if (!open) {
    if (commentsCount === 0) return null;
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="px-4 pb-3 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        {tr(
          `Ver ${commentsCount === 1 ? "1 comentário" : `todos os ${commentsCount} comentários`}`,
          `View ${commentsCount === 1 ? "1 comment" : `all ${commentsCount} comments`}`,
        )}
      </button>
    );
  }

  return (
    <section
      className="border-t border-border/40 px-4 py-3"
      aria-label={tr("Comentários", "Comments")}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {tr("Comentários", "Comments")} ({commentsCount})
        </h3>
        <div className="flex items-center gap-1">
          <NotificationMuteButton targetType="post" targetId={postId} compact />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {tr("Ocultar", "Hide")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {nextCursor && (
            <button
              type="button"
              onClick={loadPrevious}
              disabled={loadingMore}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-muted/60 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {tr("Carregar comentários anteriores", "Load previous comments")}
            </button>
          )}
          {comments.length > 0 ? (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {comments.map((comment) => {
                const avatar = avatarUrl(comment.author.avatar_url);
                const canDelete = user?.id === comment.user_id || user?.id === creatorId;
                const canEdit =
                  user?.id === comment.user_id &&
                  Date.now() - new Date(comment.created_at).getTime() <= 15 * 60_000;
                const isReply = Boolean(comment.parent_comment_id);
                return (
                  <div
                    key={comment.id}
                    className={`group/comment flex gap-2.5 ${isReply ? "ml-7 border-l border-primary/20 pl-3" : ""}`}
                  >
                    <Link
                      to="/profile/$username"
                      params={{ username: comment.author.username }}
                      className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted"
                    >
                      {avatar ? (
                        <img src={avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-primary">
                          {comment.author.username[0]?.toUpperCase()}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <Link
                          to="/profile/$username"
                          params={{ username: comment.author.username }}
                          className="truncate text-xs font-semibold text-foreground hover:underline"
                        >
                          {comment.author.display_name || comment.author.username}
                        </Link>
                        <span className="truncate text-[11px] text-muted-foreground">
                          @{comment.author.username}
                        </span>
                      </div>
                      {comment.reply_to && (
                        <div className="text-[10px] text-muted-foreground">
                          {tr("Em resposta a", "Replying to")} @{comment.reply_to.username}
                        </div>
                      )}
                      {editingId === comment.id ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <Input
                            value={editDraft}
                            onChange={(event) => setEditDraft(event.target.value)}
                            maxLength={1000}
                            className="h-8 min-w-0 flex-1 text-sm"
                            autoFocus
                            disabled={editingBusy}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") cancelEdit();
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                saveEdit(comment);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => saveEdit(comment)}
                            disabled={!editDraft.trim() || editingBusy}
                            aria-label={tr("Salvar edição", "Save edit")}
                            className="rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40"
                          >
                            {editingBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            aria-label={tr("Cancelar edição", "Cancel edit")}
                            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <CommentText comment={comment} />
                      )}
                      <div className="mt-1 flex items-center gap-3">
                        <time className="text-[10px] text-muted-foreground">
                          {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(comment.created_at))}
                        </time>
                        {new Date(comment.updated_at).getTime() >
                          new Date(comment.created_at).getTime() + 1000 && (
                          <span className="text-[10px] text-muted-foreground">
                            {tr("editado", "edited")}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => startReply(comment)}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary"
                        >
                          <Reply className="h-3 w-3" />
                          {tr("Responder", "Reply")}
                        </button>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start">
                      {canEdit && editingId !== comment.id && (
                        <button
                          type="button"
                          onClick={() => startEdit(comment)}
                          title={tr("Editar comentário", "Edit comment")}
                          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => remove(comment)}
                          title={tr("Excluir comentário", "Delete comment")}
                          className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {user?.id !== comment.user_id && (
                        <SafetyMenu
                          targetType="comment"
                          targetId={comment.id}
                          targetUserId={comment.user_id}
                          targetLabel={`@${comment.author.username}`}
                          onBlocked={() => hideBlockedAuthor(comment.user_id)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">
              {tr("Seja a primeira pessoa a comentar.", "Be the first to comment.")}
            </p>
          )}
        </>
      )}

      {replyTo && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
          <Reply className="h-3.5 w-3.5" />
          <span className="min-w-0 flex-1 truncate">
            {tr("Respondendo a", "Replying to")} @{replyTo.author.username}
          </span>
          <button
            type="button"
            onClick={cancelReply}
            aria-label={tr("Cancelar resposta", "Cancel reply")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder={tr(
            "Escreva um comentário ou @mencione alguém...",
            "Write a comment or @mention someone...",
          )}
          className="h-9 min-w-0 flex-1 rounded-full"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={!draft.trim() || submitting}
          title={tr("Publicar comentário", "Post comment")}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {tr("Limite: 5 comentários por minuto.", "Limit: 5 comments per minute.")}
      </p>
    </section>
  );
}

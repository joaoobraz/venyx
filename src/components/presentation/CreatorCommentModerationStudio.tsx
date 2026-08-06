import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Ban,
  Check,
  Eye,
  EyeOff,
  Flag,
  MessageCircle,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEMO_COMMENT_MODERATION_CHANGED_EVENT,
  addDemoBlockedKeyword,
  blockDemoCommentUser,
  readDemoCommentModeration,
  removeDemoBlockedKeyword,
  reportDemoComment,
  setDemoCommentStatus,
  setDemoManualApproval,
  type DemoCommentModerationState,
  type DemoCommentStatus,
  type DemoModeratedComment,
} from "@/lib/demo-comment-moderation";
import { useI18n } from "@/lib/i18n";

const DEMO_CREATOR_ID = "demo-aline";

function statusLabel(status: DemoCommentStatus, locale: "pt-BR" | "en") {
  const labels = {
    published: ["Publicado", "Published"],
    pending: ["Pendente", "Pending"],
    hidden: ["Oculto", "Hidden"],
    rejected: ["Rejeitado", "Rejected"],
    deleted: ["Excluído", "Deleted"],
  } as const;
  return labels[status][locale === "en" ? 1 : 0];
}

function formatDate(value: string, locale: "pt-BR" | "en") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CreatorCommentModerationStudio() {
  const { tr, locale } = useI18n();
  const [state, setState] = useState<DemoCommentModerationState>(() =>
    readDemoCommentModeration(DEMO_CREATOR_ID),
  );
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    const reload = (event: Event) => {
      const detail = (event as CustomEvent<{ creatorId?: string }>).detail;
      if (!detail?.creatorId || detail.creatorId === DEMO_CREATOR_ID) {
        setState(readDemoCommentModeration(DEMO_CREATOR_ID));
      }
    };
    window.addEventListener(DEMO_COMMENT_MODERATION_CHANGED_EVENT, reload);
    return () => window.removeEventListener(DEMO_COMMENT_MODERATION_CHANGED_EVENT, reload);
  }, []);

  const comments = useMemo(
    () => state.comments.filter((comment) => comment.moderation_status !== "deleted"),
    [state.comments],
  );
  const published = comments.filter((comment) => comment.moderation_status === "published");
  const pending = comments.filter((comment) => comment.moderation_status === "pending");
  const restricted = comments.filter(
    (comment) =>
      comment.moderation_status === "hidden" || comment.moderation_status === "rejected",
  );
  const reports = comments.reduce((total, comment) => total + comment.reports_count, 0);

  const changeStatus = (comment: DemoModeratedComment, status: DemoCommentStatus) => {
    setState(setDemoCommentStatus(DEMO_CREATOR_ID, comment.id, status));
    const messages: Record<DemoCommentStatus, string> = {
      published: tr("Comentário publicado no perfil.", "Comment published on the profile."),
      pending: tr("Comentário enviado para revisão.", "Comment sent for review."),
      hidden: tr("Comentário ocultado do perfil.", "Comment hidden from the profile."),
      rejected: tr("Comentário rejeitado.", "Comment rejected."),
      deleted: tr("Comentário excluído.", "Comment deleted."),
    };
    toast.success(messages[status]);
  };

  const report = (comment: DemoModeratedComment) => {
    setState(reportDemoComment(DEMO_CREATOR_ID, comment.id));
    toast.success(
      tr(
        "Denúncia registrada para análise da Venyx.",
        "Report submitted for Venyx review.",
      ),
    );
  };

  const block = (comment: DemoModeratedComment) => {
    setState(blockDemoCommentUser(DEMO_CREATOR_ID, comment.user_id));
    toast.success(
      tr(
        `@${comment.author.username} foi bloqueado e não poderá comentar novamente.`,
        `@${comment.author.username} was blocked and can no longer comment.`,
      ),
    );
  };

  const toggleManualApproval = (enabled: boolean) => {
    setState(setDemoManualApproval(DEMO_CREATOR_ID, enabled));
    toast.success(
      enabled
        ? tr("Aprovação manual ativada.", "Manual approval enabled.")
        : tr("Aprovação manual desativada.", "Manual approval disabled."),
    );
  };

  const addKeyword = (event: FormEvent) => {
    event.preventDefault();
    const normalized = keyword.trim().toLocaleLowerCase("pt-BR");
    if (normalized.length < 2) return;
    if (state.blocked_keywords.includes(normalized)) {
      toast.error(tr("Esta palavra já está no filtro.", "This word is already filtered."));
      return;
    }
    setState(addDemoBlockedKeyword(DEMO_CREATOR_ID, normalized));
    setKeyword("");
    toast.success(tr("Palavra adicionada ao filtro.", "Word added to the filter."));
  };

  const blockedUserNames = state.blocked_user_ids.map((userId) => {
    const comment = state.comments.find((item) => item.user_id === userId);
    return { userId, username: comment?.author.username ?? tr("usuário", "user") };
  });

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label={tr("Publicados", "Published")} value={published.length} icon={MessageCircle} />
        <Summary label={tr("Aguardando aprovação", "Awaiting approval")} value={pending.length} icon={ShieldCheck} />
        <Summary label={tr("Ocultos ou rejeitados", "Hidden or rejected")} value={restricted.length} icon={EyeOff} />
        <Summary label={tr("Denúncias", "Reports")} value={reports} icon={Flag} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-foreground">
                {tr("Aprovação manual de comentários", "Manual comment approval")}
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                {tr(
                  "Quando desativada, comentários permitidos pelos filtros aparecem imediatamente.",
                  "When disabled, comments allowed by the filters appear immediately.",
                )}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              {state.manual_approval ? tr("Ativada", "Enabled") : tr("Desativada", "Disabled")}
            </span>
            <Switch checked={state.manual_approval} onCheckedChange={toggleManualApproval} />
          </label>
        </div>
        {state.manual_approval && (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
            <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <strong className="text-sm text-foreground">
                {tr("Atenção ao impacto no desempenho", "Consider the performance impact")}
              </strong>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {tr(
                  "Ao ativar a aprovação manual, novos comentários não aparecerão imediatamente no seu perfil. Isso pode reduzir as interações e afetar o desempenho e o faturamento das suas publicações.",
                  "With manual approval enabled, new comments will not appear immediately on your profile. This can reduce interactions and affect post performance and revenue.",
                )}
              </p>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">
              {tr("Filtro de palavras", "Word filter")}
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr(
              "Comentários com uma dessas palavras são bloqueados antes da publicação.",
              "Comments containing one of these words are blocked before publication.",
            )}
          </p>
          <form className="mt-3 flex gap-2" onSubmit={addKeyword}>
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              maxLength={60}
              placeholder={tr("Digite uma palavra ou expressão", "Enter a word or phrase")}
            />
            <Button disabled={keyword.trim().length < 2}>{tr("Adicionar", "Add")}</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.blocked_keywords.map((item) => (
              <Badge key={item} variant="secondary" className="gap-1.5 py-1">
                {item}
                <button
                  type="button"
                  onClick={() => setState(removeDemoBlockedKeyword(DEMO_CREATOR_ID, item))}
                  aria-label={tr(`Remover ${item}`, `Remove ${item}`)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">
              {tr("Usuários bloqueados", "Blocked users")}
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr(
              "Usuários bloqueados não conseguem enviar novos comentários.",
              "Blocked users cannot submit new comments.",
            )}
          </p>
          <div className="mt-3 space-y-2">
            {blockedUserNames.length ? (
              blockedUserNames.map((item) => (
                <div
                  key={item.userId}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  @{item.username}
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                {tr("Nenhum usuário bloqueado.", "No blocked users.")}
              </p>
            )}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="published">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-card p-1">
          <TabsTrigger value="published">
            {tr("Publicados", "Published")} ({published.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            {tr("Pendentes", "Pending")} ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="restricted">
            {tr("Ocultos e rejeitados", "Hidden and rejected")} ({restricted.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="published">
          <CommentList
            comments={published}
            locale={locale}
            tr={tr}
            onStatus={changeStatus}
            onReport={report}
            onBlock={block}
          />
        </TabsContent>
        <TabsContent value="pending">
          <CommentList
            comments={pending}
            locale={locale}
            tr={tr}
            onStatus={changeStatus}
            onReport={report}
            onBlock={block}
          />
        </TabsContent>
        <TabsContent value="restricted">
          <CommentList
            comments={restricted}
            locale={locale}
            tr={tr}
            onStatus={changeStatus}
            onReport={report}
            onBlock={block}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof MessageCircle;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs text-muted-foreground">{label}</span>
          <strong className="mt-1 block text-2xl text-foreground">{value}</strong>
        </div>
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Card>
  );
}

function CommentList({
  comments,
  locale,
  tr,
  onStatus,
  onReport,
  onBlock,
}: {
  comments: DemoModeratedComment[];
  locale: "pt-BR" | "en";
  tr: (pt: string, en: string) => string;
  onStatus: (comment: DemoModeratedComment, status: DemoCommentStatus) => void;
  onReport: (comment: DemoModeratedComment) => void;
  onBlock: (comment: DemoModeratedComment) => void;
}) {
  if (!comments.length) {
    return (
      <Card className="mt-3 border-dashed p-8 text-center text-sm text-muted-foreground">
        {tr("Nenhum comentário nesta categoria.", "No comments in this category.")}
      </Card>
    );
  }
  return (
    <div className="mt-3 space-y-3">
      {comments.map((comment) => (
        <Card key={comment.id} className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-foreground">
                  {comment.author.display_name || comment.author.username}
                </strong>
                <span className="text-xs text-muted-foreground">@{comment.author.username}</span>
                <Badge variant="outline">
                  {statusLabel(comment.moderation_status, locale)}
                </Badge>
                {comment.reported_by_creator && (
                  <Badge variant="destructive">{tr("Denunciado", "Reported")}</Badge>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{comment.body}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{formatDate(comment.created_at, locale)}</span>
                <span>{tr("Publicação: Bastidores do estúdio", "Post: Studio backstage")}</span>
                {comment.reports_count > 0 && (
                  <span>
                    {comment.reports_count} {tr("denúncias", "reports")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
              {comment.moderation_status === "pending" && (
                <>
                  <Button size="sm" onClick={() => onStatus(comment, "published")}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> {tr("Aprovar", "Approve")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onStatus(comment, "rejected")}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> {tr("Rejeitar", "Reject")}
                  </Button>
                </>
              )}
              {comment.moderation_status === "published" && (
                <Button size="sm" variant="outline" onClick={() => onStatus(comment, "hidden")}>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" /> {tr("Ocultar", "Hide")}
                </Button>
              )}
              {(comment.moderation_status === "hidden" ||
                comment.moderation_status === "rejected") && (
                <Button size="sm" variant="outline" onClick={() => onStatus(comment, "published")}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> {tr("Publicar", "Publish")}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={comment.reported_by_creator}
                onClick={() => onReport(comment)}
              >
                <Flag className="mr-1.5 h-3.5 w-3.5" />
                {comment.reported_by_creator ? tr("Denunciado", "Reported") : tr("Denunciar", "Report")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onBlock(comment)}>
                <UserX className="mr-1.5 h-3.5 w-3.5" /> {tr("Bloquear", "Block")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onStatus(comment, "deleted")}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {tr("Excluir", "Delete")}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

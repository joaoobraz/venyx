import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Loader2, MessageCircle, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { DEMO_MODE } from "@/lib/demo-creators";
import {
  addCreatorKeyword,
  blockCreatorCommenter,
  listCreatorModeration,
  removeCreatorModerationRule,
} from "@/_server/creator-moderation.functions";

export const Route = createFileRoute("/creator/moderation")({
  component: CreatorModerationPage,
});

type ModerationRule = {
  id: string;
  kind: string;
  value: string | null;
  blocked_user_id: string | null;
  is_active: boolean;
  created_at: string;
  blockedProfile: {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type RecurringUser = {
  userId: string;
  commentsCount: number;
  reportsCount: number;
  lastCommentAt: string;
  profile: {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

const demoRulesKey = (userId: string) => `venyx:demo:creator-moderation:${userId}`;

function readDemoRules(userId: string): ModerationRule[] {
  try {
    return JSON.parse(localStorage.getItem(demoRulesKey(userId)) ?? "[]") as ModerationRule[];
  } catch {
    return [];
  }
}

function writeDemoRules(userId: string, rules: ModerationRule[]) {
  localStorage.setItem(demoRulesKey(userId), JSON.stringify(rules));
}

function readDemoRecurring(): RecurringUser[] {
  const summaries = new Map<string, RecurringUser>();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("venyx-demo-comments:")) continue;
    try {
      const comments = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
        id: string;
        user_id: string;
        created_at: string;
        author: RecurringUser["profile"];
      }>;
      for (const comment of comments) {
        const current = summaries.get(comment.user_id);
        summaries.set(comment.user_id, {
          userId: comment.user_id,
          commentsCount: (current?.commentsCount ?? 0) + 1,
          reportsCount: current?.reportsCount ?? 0,
          lastCommentAt:
            !current ||
            new Date(comment.created_at).getTime() >
              new Date(current.lastCommentAt).getTime()
              ? comment.created_at
              : current.lastCommentAt,
          profile: comment.author,
        });
      }
    } catch {
      // Ignore corrupted demo-only rows.
    }
  }
  return Array.from(summaries.values()).sort(
    (first, second) => second.commentsCount - first.commentsCount,
  );
}

function CreatorModerationPage() {
  const { user, session, isCreator, loading: authLoading } = useAuth();
  const { tr, locale } = useI18n();
  const listFn = useServerFn(listCreatorModeration);
  const addKeywordFn = useServerFn(addCreatorKeyword);
  const blockUserFn = useServerFn(blockCreatorCommenter);
  const removeRuleFn = useServerFn(removeCreatorModerationRule);
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [recurring, setRecurring] = useState<RecurringUser[]>([]);
  const [keyword, setKeyword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const headers = useMemo(
    () =>
      session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    [session?.access_token],
  );

  const load = async () => {
    if (!user || !headers || !isCreator) return;
    setLoading(true);
    try {
      const result = await listFn({ headers });
      setRules(result.rules as ModerationRule[]);
      setRecurring(result.recurringUsers as RecurringUser[]);
    } catch (error) {
      if (DEMO_MODE) {
        setRules(readDemoRules(user.id));
        setRecurring(readDemoRecurring());
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : tr("Não foi possível carregar a moderação.", "Couldn't load moderation."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && headers && isCreator) load();
    else if (!authLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, headers, isCreator, authLoading]);

  const addKeyword = async (event: FormEvent) => {
    event.preventDefault();
    const value = keyword.trim();
    if (!value || !user || !headers || busy) return;
    setBusy(true);
    try {
      await addKeywordFn({ data: { keyword: value }, headers });
      setKeyword("");
      await load();
    } catch (error) {
      if (!DEMO_MODE) {
        toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
      } else {
        if (
          rules.some(
            (rule) =>
              rule.kind === "keyword" &&
              rule.value?.toLowerCase() === value.toLowerCase(),
          )
        ) {
          toast.error(tr("Esta palavra já está na lista.", "This word is already listed."));
        } else {
          const next: ModerationRule[] = [
            {
              id: crypto.randomUUID(),
              kind: "keyword",
              value,
              blocked_user_id: null,
              is_active: true,
              created_at: new Date().toISOString(),
              blockedProfile: null,
            },
            ...rules,
          ];
          setRules(next);
          writeDemoRules(user.id, next);
          setKeyword("");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const blockUsername = async (targetUsername = username) => {
    const normalized = targetUsername.trim().replace(/^@/, "").toLowerCase();
    if (!normalized || !user || !headers || busy) return;
    setBusy(true);
    try {
      await blockUserFn({ data: { username: normalized }, headers });
      setUsername("");
      await load();
    } catch (error) {
      if (!DEMO_MODE) {
        toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
      } else {
        const recurringUser = recurring.find(
          (item) => item.profile.username.toLowerCase() === normalized,
        );
        const blockedId = recurringUser?.userId ?? `demo:${normalized}`;
        if (rules.some((rule) => rule.blocked_user_id === blockedId)) {
          toast.error(tr("Este usuário já está bloqueado.", "This user is already blocked."));
        } else {
          const next: ModerationRule[] = [
            {
              id: crypto.randomUUID(),
              kind: "user",
              value: null,
              blocked_user_id: blockedId,
              is_active: true,
              created_at: new Date().toISOString(),
              blockedProfile: recurringUser?.profile ?? {
                user_id: blockedId,
                username: normalized,
                display_name: null,
                avatar_url: null,
              },
            },
            ...rules,
          ];
          setRules(next);
          writeDemoRules(user.id, next);
          setUsername("");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async (ruleId: string) => {
    if (!user || !headers || busy) return;
    setBusy(true);
    try {
      await removeRuleFn({ data: { ruleId }, headers });
      setRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch (error) {
      if (!DEMO_MODE) {
        toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
      } else {
        const next = rules.filter((rule) => rule.id !== ruleId);
        setRules(next);
        writeDemoRules(user.id, next);
      }
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) return null;
  if (!isCreator) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-primary" />
          <h1 className="text-lg font-semibold">
            {tr("Área exclusiva para criadoras", "Creator-only area")}
          </h1>
        </div>
      </AppShell>
    );
  }

  const keywordRules = rules.filter((rule) => rule.kind === "keyword");
  const userRules = rules.filter((rule) => rule.kind === "user");

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {tr("Moderação de comentários", "Comment moderation")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              "Controle palavras e usuários antes que novos comentários apareçam nas suas publicações.",
              "Control words and users before new comments appear on your posts.",
            )}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <MessageCircle className="h-4 w-4 text-primary" />
              {tr("Palavras bloqueadas", "Blocked words")}
            </h2>
            <form onSubmit={addKeyword} className="flex gap-2">
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                maxLength={60}
                placeholder={tr("Ex.: golpe", "Example: scam")}
              />
              <Button disabled={busy || keyword.trim().length < 2}>
                {tr("Adicionar", "Add")}
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {keywordRules.length ? (
                keywordRules.map((rule) => (
                  <Badge key={rule.id} variant="secondary" className="gap-1.5 py-1">
                    {rule.value}
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      aria-label={tr("Remover palavra", "Remove word")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  {tr("Nenhuma palavra bloqueada.", "No blocked words.")}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Ban className="h-4 w-4 text-primary" />
              {tr("Usuários impedidos de comentar", "Users blocked from commenting")}
            </h2>
            <div className="flex gap-2">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@username"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    blockUsername();
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => blockUsername()}
                disabled={busy || username.trim().length < 3}
              >
                {tr("Bloquear", "Block")}
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {userRules.length ? (
                userRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      @{rule.blockedProfile?.username ?? tr("usuário", "user")}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={tr("Desbloquear usuário", "Unblock user")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  {tr("Nenhum usuário bloqueado.", "No blocked users.")}
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-primary" />
            {tr("Usuários recorrentes — últimos 30 dias", "Recurring users — last 30 days")}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {tr(
              "Ordenados primeiro por denúncias e depois por volume de comentários.",
              "Sorted first by reports, then by comment volume.",
            )}
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : recurring.length ? (
            <div className="divide-y divide-border">
              {recurring.map((item) => {
                const alreadyBlocked = userRules.some(
                  (rule) => rule.blocked_user_id === item.userId,
                );
                return (
                  <div
                    key={item.userId}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {item.profile.display_name || item.profile.username}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        @{item.profile.username} ·{" "}
                        {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
                          day: "2-digit",
                          month: "short",
                        }).format(new Date(item.lastCommentAt))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">
                        {item.commentsCount} {tr("comentários", "comments")}
                      </Badge>
                      {item.reportsCount > 0 && (
                        <Badge variant="destructive">
                          {item.reportsCount} {tr("denúncias", "reports")}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant={alreadyBlocked ? "secondary" : "outline"}
                        disabled={busy || alreadyBlocked}
                        onClick={() => blockUsername(item.profile.username)}
                      >
                        {alreadyBlocked ? tr("Bloqueado", "Blocked") : tr("Bloquear", "Block")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {tr(
                "Ainda não há atividade suficiente para mostrar usuários recorrentes.",
                "There isn't enough activity to show recurring users yet.",
              )}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Crown,
  Gift,
  History,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { claimLoyaltyReward, listMyLoyalty } from "@/_server/loyalty.functions";
import { useI18n } from "@/lib/i18n";
import { DEMO_MODE, getDemoAsset } from "@/lib/demo-creators";
import {
  DEMO_LOYALTY_CHANGED_EVENT,
  claimDemoLoyaltyReward,
  readDemoLoyalty,
  relationshipCreator,
  type DemoLoyaltyState,
} from "@/lib/demo-loyalty";
import {
  LOYALTY_TIERS,
  TIER_META,
  loyaltyProgress,
  loyaltyTierFromPoints,
  tierMeetsMinimum,
  type LoyaltyTier,
} from "@/lib/loyalty";

export const Route = createFileRoute("/loyalty")({ component: LoyaltyPage });

const REASON_LABELS: Record<string, { pt: string; en: string }> = {
  subscription: { pt: "Assinatura confirmada", en: "Subscription confirmed" },
  renewal_streak: { pt: "Bônus de sequência", en: "Streak bonus" },
  ppv_spend: { pt: "Compra de PPV", en: "PPV purchase" },
  ppv_bonus: { pt: "Bônus de PPV", en: "PPV bonus" },
  gift: { pt: "Mimo confirmado", en: "Confirmed gift" },
  post_like: { pt: "Curtida válida", en: "Valid like" },
  post_comment: { pt: "Comentário aprovado", en: "Approved comment" },
};

function tierName(tier: LoyaltyTier, locale: "pt-BR" | "en") {
  return locale === "en" ? TIER_META[tier].labelEn : TIER_META[tier].label;
}

function ProgressBar({ points, compact = false }: { points: number; compact?: boolean }) {
  const progress = loyaltyProgress(points);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        {progress.nextTier && progress.nextAt ? (
          <>
            <span>
              {progress.nextAt - points} pontos para {TIER_META[progress.nextTier].label}
            </span>
            <span>
              {points.toLocaleString("pt-BR")} / {progress.nextAt.toLocaleString("pt-BR")}
            </span>
          </>
        ) : (
          <>
            <span>Nível máximo conquistado</span>
            <span>{points.toLocaleString("pt-BR")} pontos</span>
          </>
        )}
      </div>
      <div className={`${compact ? "h-2" : "h-2.5"} overflow-hidden rounded-full bg-muted`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-fuchsia-500 transition-all"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
    </div>
  );
}

export function LoyaltyPage() {
  const { user, loading } = useAuth();
  const { tr, locale } = useI18n();
  const fn = useServerFn(listMyLoyalty);
  const claimRewardFn = useServerFn(claimLoyaltyReward);
  const [demoState, setDemoState] = useState<DemoLoyaltyState | null>(null);
  const [realData, setRealData] = useState<Awaited<ReturnType<typeof listMyLoyalty>> | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (DEMO_MODE) {
      const load = () => {
        setDemoState(readDemoLoyalty(user.id));
        setBusy(false);
      };
      load();
      window.addEventListener(DEMO_LOYALTY_CHANGED_EVENT, load);
      return () => window.removeEventListener(DEMO_LOYALTY_CHANGED_EVENT, load);
    }
    fn()
      .then(setRealData)
      .finally(() => setBusy(false));
  }, [fn, user]);

  const relationships = useMemo(() => {
    if (demoState) {
      return demoState.relationships.map((relationship) => ({
        creator_id: relationship.creatorId,
        points: relationship.points,
        tier: loyaltyTierFromPoints(relationship.points),
        streak_months: relationship.streakMonths,
        profile: relationshipCreator(relationship),
        ledger: relationship.ledger,
      }));
    }
    return (realData?.items ?? []).map((item) => ({
      creator_id: item.creator_id,
      points: item.points,
      tier: loyaltyTierFromPoints(item.points),
      streak_months: 0,
      profile: item.profile,
      ledger: [],
    }));
  }, [demoState, realData]);

  const globalPoints =
    demoState?.globalPoints ??
    realData?.global.points ??
    relationships.reduce((sum, item) => sum + item.points, 0);
  const globalTier = loyaltyTierFromPoints(globalPoints);
  const programRelationship = demoState?.relationships.find(
    (item) => item.creatorId === demoState.program.creatorId,
  );
  const programTier = loyaltyTierFromPoints(programRelationship?.points ?? 0);
  const rewards = demoState
    ? demoState.program.rewards.map((reward) => ({
        ...reward,
        creatorId: demoState.program.creatorId,
      }))
    : (realData?.rewards ?? []).map((reward) => ({
        id: reward.id,
        creatorId: reward.creator_id,
        title: reward.title,
        description: reward.description,
        type: reward.reward_type,
        minimumTier: reward.minimum_tier as LoyaltyTier,
        stock: reward.stock,
        redeemedCount: reward.redeemed_count,
        active: reward.active,
        expiresAt: reward.expires_at,
      }));
  const claimedRewardIds = new Set(
    demoState
      ? demoState.claims.map((claim) => claim.rewardId)
      : (realData?.claims ?? []).map((claim) => claim.reward_id),
  );
  const history = demoState
    ? demoState.relationships
        .flatMap((relationship) =>
          relationship.ledger.map((entry) => ({
            ...entry,
            creator: relationshipCreator(relationship).display_name,
          })),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8)
    : (realData?.ledger ?? []).map((entry) => {
        const relationship = relationships.find((item) => item.creator_id === entry.creator_id);
        return {
          id: entry.id,
          reason: entry.reason,
          label: entry.reason,
          creator:
            relationship?.profile?.display_name ?? relationship?.profile?.username ?? "Fanlira",
          createdAt: entry.created_at,
          points: entry.points_delta,
        };
      });

  if (loading || busy) {
    return (
      <AppShell>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="p-6 text-center text-muted-foreground">
          {tr("Faça login para ver sua fidelidade.", "Sign in to view your loyalty status.")}
        </div>
      </AppShell>
    );
  }

  const globalMeta = TIER_META[globalTier];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-3">
              <Trophy className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {tr("Minha fidelidade", "My loyalty")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {tr(
                  "Seu apoio confirmado vira progresso, níveis e benefícios.",
                  "Your confirmed support becomes progress, tiers and benefits.",
                )}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            {tr("Somente ações confirmadas pontuam", "Only confirmed actions earn points")}
          </div>
        </header>

        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 p-6 shadow-card">
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${globalMeta.bg} ${globalMeta.color}`}
                >
                  <span>{globalMeta.emoji}</span>
                  {tr("Nível Fanlira", "Fanlira tier")} {tierName(globalTier, locale)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tr(
                    "Visível somente às modelos que você assina",
                    "Visible only to creators you subscribe to",
                  )}
                </span>
              </div>
              <div className="mt-5 text-4xl font-black tracking-tight text-foreground">
                {globalPoints.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}
                <span className="ml-2 text-sm font-semibold text-muted-foreground">
                  {tr("pontos gerais", "global points")}
                </span>
              </div>
              <div className="mt-4 max-w-2xl">
                <ProgressBar points={globalPoints} />
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {tr("Sua sequência mais forte", "Your strongest streak")}
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-black text-primary">
                  {Math.max(0, ...relationships.map((item) => item.streak_months))}
                </span>
                <span className="pb-1 text-sm text-muted-foreground">{tr("meses", "months")}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {tr(
                  "Renovações consecutivas liberam 25 pontos extras.",
                  "Consecutive renewals unlock 25 bonus points.",
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            {
              icon: Crown,
              title: tr("Renove sua sequência", "Renew your streak"),
              body: tr("Próxima renovação confirmada", "Next confirmed renewal"),
              points: "+25",
            },
            {
              icon: LockKeyhole,
              title: tr("Descubra um PPV", "Unlock a PPV"),
              body: tr("Pontos do valor + bônus", "Value points plus bonus"),
              points: "+5",
            },
            {
              icon: Target,
              title: tr("Interaja esta semana", "Engage this week"),
              body: tr("3 de 10 pontos possíveis", "3 of 10 possible points"),
              points: "3/10",
            },
          ].map((mission) => {
            const Icon = mission.icon;
            return (
              <div key={mission.title} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <strong className="text-sm text-accent">{mission.points}</strong>
                </div>
                <div className="mt-3 text-sm font-bold text-foreground">{mission.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{mission.body}</div>
              </div>
            );
          })}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {tr("Com cada modelo", "With each creator")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Cada relacionamento tem progresso e benefícios próprios.",
                  "Each relationship has its own progress and benefits.",
                )}
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {relationships.map((item) => {
              const tier = loyaltyTierFromPoints(item.points);
              const meta = TIER_META[tier];
              const profile = item.profile;
              return (
                <article
                  key={item.creator_id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    {profile && (
                      <Link
                        to="/profile/$username"
                        params={{ username: profile.username }}
                        className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted"
                      >
                        {profile.avatar_url ? (
                          <img
                            src={
                              DEMO_MODE
                                ? getDemoAsset(profile.username).avatar_url
                                : profile.avatar_url
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                            {profile.username[0]?.toUpperCase()}
                          </div>
                        )}
                      </Link>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-foreground">
                        {profile?.display_name || profile?.username || "—"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.points.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}{" "}
                        {tr("pontos", "points")} · {item.streak_months}{" "}
                        {tr("meses seguidos", "month streak")}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${meta.bg} ${meta.color}`}
                    >
                      {meta.emoji} {tierName(tier, locale)}
                    </span>
                  </div>
                  <div className="mt-4">
                    <ProgressBar points={item.points} compact />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {(demoState?.program.enabled || (!DEMO_MODE && rewards.length > 0)) && (
          <section className="space-y-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Gift className="h-5 w-5 text-accent" />
                {tr("Benefícios disponíveis", "Available benefits")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Resgatar não reduz seus pontos nem seu nível.",
                  "Claiming does not reduce your points or tier.",
                )}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rewards
                .filter((reward) => reward.active)
                .map((reward) => {
                  const relationshipTier = demoState
                    ? programTier
                    : loyaltyTierFromPoints(
                        relationships.find((item) => item.creator_id === reward.creatorId)
                          ?.points ?? 0,
                      );
                  const eligible = tierMeetsMinimum(relationshipTier, reward.minimumTier);
                  const claimed = claimedRewardIds.has(reward.id);
                  const soldOut = reward.stock !== null && reward.redeemedCount >= reward.stock;
                  const rewardMeta = TIER_META[reward.minimumTier];
                  return (
                    <article
                      key={reward.id}
                      className="flex min-h-52 flex-col rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${rewardMeta.bg} ${rewardMeta.color}`}
                        >
                          {rewardMeta.emoji} {tierName(reward.minimumTier, locale)}
                        </span>
                        {claimed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {tr("Resgatado", "Claimed")}
                          </span>
                        ) : eligible ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                            <BadgeCheck className="h-3.5 w-3.5" /> {tr("Disponível", "Available")}
                          </span>
                        ) : (
                          <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <h3 className="mt-4 text-sm font-bold text-foreground">{reward.title}</h3>
                      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                        {reward.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[10px] text-muted-foreground">
                          {reward.stock === null
                            ? tr("Sem limite de vagas", "No slot limit")
                            : `${Math.max(0, reward.stock - reward.redeemedCount)} ${tr("vagas", "slots")}`}
                        </span>
                        <Button
                          size="sm"
                          variant={eligible && !claimed ? "default" : "outline"}
                          disabled={!eligible || claimed || soldOut}
                          onClick={async () => {
                            if (DEMO_MODE) {
                              const result = claimDemoLoyaltyReward(user.id, reward.id);
                              if (result.error) toast.error(result.error);
                              else toast.success(tr("Benefício resgatado!", "Benefit claimed!"));
                              return;
                            }
                            try {
                              await claimRewardFn({ data: { rewardId: reward.id } });
                              setRealData(await fn());
                              toast.success(tr("Benefício resgatado!", "Benefit claimed!"));
                            } catch {
                              toast.error(
                                tr("Não foi possível resgatar.", "Could not claim benefit."),
                              );
                            }
                          }}
                        >
                          {claimed
                            ? tr("Resgatado", "Claimed")
                            : eligible
                              ? tr("Resgatar", "Claim")
                              : tr("Bloqueado", "Locked")}
                        </Button>
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <History className="h-4 w-4 text-primary" />{" "}
              {tr("Extrato de pontos", "Points history")}
            </h2>
            <div className="mt-4 divide-y divide-border/60">
              {history.length ? (
                history.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="rounded-full bg-primary/10 p-2 text-primary">
                      <History className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {REASON_LABELS[entry.reason]
                          ? locale === "en"
                            ? REASON_LABELS[entry.reason].en
                            : REASON_LABELS[entry.reason].pt
                          : entry.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {entry.creator} ·{" "}
                        {new Date(entry.createdAt).toLocaleDateString(
                          locale === "en" ? "en-US" : "pt-BR",
                        )}
                      </div>
                    </div>
                    <strong className="text-xs text-emerald-500">+{entry.points}</strong>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {tr("Seu extrato aparecerá aqui.", "Your history will appear here.")}
                </div>
              )}
            </div>
          </div>
          <aside className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground">
              {tr("Como pontuar", "How to earn")}
            </h2>
            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              {(
                [
                  [CheckCircle2, tr("R$ 1 confirmado = 1 ponto", "Confirmed BRL 1 = 1 point")],
                  [Crown, tr("Renovação consecutiva = +25", "Consecutive renewal = +25")],
                  [LockKeyhole, tr("PPV confirmado = +5 de bônus", "Confirmed PPV = +5 bonus")],
                  [Target, tr("Interações = até 10/semana", "Engagement = up to 10/week")],
                  [
                    Clock3,
                    tr(
                      "Lives e produtos: disponíveis quando os módulos forem lançados",
                      "Lives and products: available when their modules launch",
                    ),
                  ],
                ] as Array<[typeof CheckCircle2, string]>
              ).map(([Icon, label]) => (
                <div key={String(label)} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {tr("Caminho de níveis", "Tier path")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {tr("Os níveis são iguais em toda a Fanlira.", "Tiers are consistent across Fanlira.")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {LOYALTY_TIERS.map((tier) => {
                const meta = TIER_META[tier];
                return (
                  <span
                    key={tier}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.bg} ${meta.color}`}
                  >
                    {meta.emoji} {tierName(tier, locale)}
                  </span>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Trophy } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { listMyLoyalty } from "@/_server/loyalty.functions";
import { TIER_META, type LoyaltyTier } from "@/components/LoyaltyBadge";

export const Route = createFileRoute("/loyalty")({
  component: LoyaltyPage,
});

const TIER_THRESHOLDS: Record<LoyaltyTier, { next: LoyaltyTier | null; nextAt: number | null }> = {
  bronze:  { next: "silver",  nextAt: 500 },
  silver:  { next: "gold",    nextAt: 2000 },
  gold:    { next: "diamond", nextAt: 5000 },
  diamond: { next: null,      nextAt: null },
};

function LoyaltyPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Awaited<ReturnType<typeof listMyLoyalty>>["items"]>([]);
  const [busy, setBusy] = useState(true);
  const fn = useServerFn(listMyLoyalty);

  useEffect(() => {
    if (!user) return;
    fn().then((res) => setItems(res.items)).finally(() => setBusy(false));
  }, [user, fn]);

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
        <div className="p-6 text-center text-muted-foreground">Faça login para ver sua fidelidade.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-3">
            <Trophy className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Programa de fidelidade</h1>
            <p className="text-sm text-muted-foreground">
              Ganhe pontos com cada criadora. Quanto mais você apoia, maior o seu tier.
            </p>
          </div>
        </header>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-accent" /> Como ganhar pontos
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• 1 ponto por cada R$ 1 gasto (assinatura, PPV, gorjeta)</li>
            <li>• Tiers: 🥉 Bronze (0+) → 🥈 Prata (500+) → 🥇 Ouro (2.000+) → 💎 Diamante (5.000+)</li>
            <li>• Diamante entra automático na lista VIP da criadora</li>
          </ul>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Você ainda não tem pontos. Apoie uma criadora para começar.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => {
              const tier = (it.tier as LoyaltyTier) ?? "bronze";
              const meta = TIER_META[tier];
              const t = TIER_THRESHOLDS[tier];
              const pct = t.nextAt ? Math.min(100, Math.round((it.points / t.nextAt) * 100)) : 100;
              return (
                <div key={it.creator_id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    {it.profile && (
                      <Link
                        to="/profile/$username"
                        params={{ username: it.profile.username }}
                        className="h-12 w-12 overflow-hidden rounded-full bg-muted shrink-0"
                      >
                        {it.profile.avatar_url ? (
                          <img src={it.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                            {it.profile.username[0]?.toUpperCase()}
                          </div>
                        )}
                      </Link>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-foreground">
                        {it.profile?.display_name || it.profile?.username || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {it.points} pontos
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold ${meta.bg} ${meta.color}`}>
                      <span>{meta.emoji}</span> {meta.label}
                    </span>
                  </div>
                  {t.nextAt && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Próximo: {TIER_META[t.next as LoyaltyTier].label}</span>
                        <span>{it.points} / {t.nextAt}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

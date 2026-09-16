import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { listTopFans } from "@/_server/loyalty.functions";
import { TIER_META, type LoyaltyTier } from "@/components/LoyaltyBadge";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/creator/loyalty")({
  component: CreatorLoyaltyPage,
});

export function CreatorLoyaltyPage() {
  const { tr } = useI18n();
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();
  const [fans, setFans] = useState<Awaited<ReturnType<typeof listTopFans>>["fans"]>([]);
  const [busy, setBusy] = useState(true);
  const fn = useServerFn(listTopFans);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  useEffect(() => {
    if (!user || !isCreator) return;
    fn()
      .then((res) => setFans(res.fans))
      .finally(() => setBusy(false));
  }, [user, isCreator, fn]);

  if (!user || !isCreator) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 p-3">
            <Trophy className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr("Top fãs", "Top fans")}</h1>
            <p className="text-sm text-muted-foreground">
              {tr(
                "Ranking de fidelidade dos seus assinantes.",
                "Your subscribers' loyalty ranking.",
              )}
            </p>
          </div>
        </header>

        {busy ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : fans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {tr(
              "Nenhum fã pontuado ainda. Os pontos crescem conforme cada um consome seu conteúdo.",
              "No ranked fans yet. Points grow as each fan engages with your content.",
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {fans.map((f, idx) => {
              const tier = (f.tier as LoyaltyTier) ?? "bronze";
              const meta = TIER_META[tier];
              return (
                <div
                  key={f.user_id}
                  className="flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0"
                >
                  <div className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {idx + 1}
                  </div>
                  {f.profile && (
                    <Link
                      to="/profile/$username"
                      params={{ username: f.profile.username }}
                      className="h-9 w-9 overflow-hidden rounded-full bg-muted shrink-0"
                    >
                      {f.profile.avatar_url ? (
                        <img
                          src={f.profile.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                          {f.profile.username[0]?.toUpperCase()}
                        </div>
                      )}
                    </Link>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-foreground">
                      {f.profile?.display_name || f.profile?.username || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">@{f.profile?.username}</div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${meta.bg} ${meta.color}`}
                  >
                    {meta.emoji} {meta.label}
                  </span>
                  <div className="ml-2 w-16 text-right text-sm font-bold text-foreground">
                    {f.points}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

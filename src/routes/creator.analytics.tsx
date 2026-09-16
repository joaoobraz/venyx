import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DollarSign, Users, TrendingUp, Trophy, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/creator/analytics")({
  component: CreatorAnalyticsPage,
});

interface DailyPoint {
  date: string;
  cents: number;
}
interface TopFan {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_cents: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function CreatorAnalyticsPage() {
  const { tr } = useI18n();
  const { user, isCreator, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);
  const [active, setActive] = useState(0);
  const [churned, setChurned] = useState(0);
  const [ppvViews, setPpvViews] = useState(0);
  const [ppvUnlocks, setPpvUnlocks] = useState(0);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [topFans, setTopFans] = useState<TopFan[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, authLoading, nav]);

  useEffect(() => {
    if (!user || !isCreator) return;
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString();

      const [{ data: txs }, { data: subs }, { data: posts }] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount_cents,type,created_at,payer_id,status")
          .eq("payee_id", user.id)
          .eq("status", "paid")
          .gte("created_at", sinceIso),
        supabase
          .from("subscriptions")
          .select("subscriber_id,status,current_period_end")
          .eq("creator_id", user.id),
        supabase.from("posts").select("id,unlocks_count,visibility").eq("creator_id", user.id),
      ]);

      const txList = (txs ?? []) as {
        amount_cents: number;
        type: string;
        created_at: string;
        payer_id: string | null;
      }[];
      const subList = (subs ?? []) as {
        subscriber_id: string;
        status: string;
        current_period_end: string | null;
      }[];
      const postList = (posts ?? []) as { id: string; unlocks_count: number; visibility: string }[];

      // Receita 30d
      const totalCents = txList.reduce((s, t) => s + t.amount_cents, 0);

      // Assinantes ativos / churn
      const activeNow = subList.filter((s) => s.status === "active").length;
      const expired = subList.filter(
        (s) => s.status === "expired" || s.status === "canceled",
      ).length;

      // PPV
      const ppvPosts = postList.filter((p) => p.visibility === "ppv");
      const ppvViewsCount = ppvPosts.length;
      const ppvUnlocksCount = ppvPosts.reduce((s, p) => s + p.unlocks_count, 0);

      // Daily (últimos 14 dias)
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = d.toISOString().slice(0, 10);
        days[k] = 0;
      }
      txList.forEach((t) => {
        const k = t.created_at.slice(0, 10);
        if (k in days) days[k] += t.amount_cents;
      });
      const dailyArr: DailyPoint[] = Object.entries(days).map(([date, cents]) => ({
        date: date.slice(5),
        cents,
      }));

      // Top fãs (top 5)
      const byPayer = new Map<string, number>();
      txList.forEach((t) => {
        if (!t.payer_id) return;
        byPayer.set(t.payer_id, (byPayer.get(t.payer_id) ?? 0) + t.amount_cents);
      });
      const topIds = Array.from(byPayer.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      let fans: TopFan[] = [];
      if (topIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,username,display_name,avatar_url")
          .in(
            "user_id",
            topIds.map((t) => t[0]),
          );
        const profMap = new Map(
          (
            (profs ?? []) as {
              user_id: string;
              username: string;
              display_name: string | null;
              avatar_url: string | null;
            }[]
          ).map((p) => [p.user_id, p]),
        );
        fans = topIds.map(([uid, total]) => {
          const p = profMap.get(uid);
          return {
            user_id: uid,
            username: p?.username ?? "anonymous",
            display_name: p?.display_name ?? null,
            avatar_url: p?.avatar_url ?? null,
            total_cents: total,
          };
        });
      }

      if (cancelled) return;
      setRevenue(totalCents);
      setActive(activeNow);
      setChurned(expired);
      setPpvViews(ppvViewsCount);
      setPpvUnlocks(ppvUnlocksCount);
      setDaily(dailyArr);
      setTopFans(fans);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isCreator]);

  if (!isCreator || !user) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-xs text-muted-foreground">{tr("Últimos 30 dias", "Last 30 days")}</p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                icon={DollarSign}
                label={tr("Receita em 30 dias", "30-day revenue")}
                value={`R$ ${(revenue / 100).toFixed(2)}`}
                accent
              />
              <Stat
                icon={Users}
                label={tr("Assinantes ativos", "Active subscribers")}
                value={active.toString()}
              />
              <Stat
                icon={TrendingUp}
                label={tr("Cancelados ou expirados", "Canceled or expired")}
                value={churned.toString()}
              />
              <Stat
                icon={Trophy}
                label={tr("Conversão PPV", "PPV conversion")}
                value={
                  ppvViews > 0 ? `${Math.round((ppvUnlocks / Math.max(1, ppvViews)) * 100)}%` : "—"
                }
                hint={tr(
                  `${ppvUnlocks} desbloqueios em ${ppvViews} posts PPV`,
                  `${ppvUnlocks} unlocks across ${ppvViews} PPV posts`,
                )}
              />
            </div>

            <section className="rounded-2xl bg-card p-5 shadow-card">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                {tr("Receita por dia (14 dias)", "Daily revenue (14 days)")}
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                      formatter={(v: number) => [
                        `R$ ${(v / 100).toFixed(2)}`,
                        tr("Receita", "Revenue"),
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="cents"
                      stroke="hsl(var(--primary))"
                      fill="url(#revGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl bg-card p-5 shadow-card">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                🏆 {tr("Top fãs (30 dias)", "Top fans (30 days)")}
              </h2>
              {topFans.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {tr("Nenhum fã ainda. Compartilhe seu link!", "No fans yet. Share your link!")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {topFans.map((f, i) => (
                    <li
                      key={f.user_id}
                      className="flex items-center gap-3 rounded-xl bg-background px-3 py-2"
                    >
                      <span className="text-base font-bold text-accent">#{i + 1}</span>
                      <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                        {f.avatar_url ? (
                          <img
                            src={
                              f.avatar_url.startsWith("http")
                                ? f.avatar_url
                                : `${SUPABASE_URL}/storage/v1/object/public/avatars/${f.avatar_url}`
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                            {f.username[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {f.display_name || f.username}
                        </div>
                        <div className="text-[10px] text-muted-foreground">@{f.username}</div>
                      </div>
                      <div className="text-sm font-semibold text-primary">
                        R$ {(f.total_cents / 100).toFixed(2)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-card ${accent ? "bg-gradient-primary text-primary-foreground" : "bg-card text-foreground"}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent ? "" : "text-primary"}`} />
        <span
          className={`text-[11px] font-medium ${accent ? "opacity-80" : "text-muted-foreground"}`}
        >
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && (
        <div className={`mt-1 text-[10px] ${accent ? "opacity-70" : "text-muted-foreground"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_CREATORS, DEMO_MODE } from "@/lib/demo-creators";
import { useI18n } from "@/lib/i18n";

interface TopCreator {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  score: number;
}

const MAX_RANKING_SIZE = 15;
const RANKING_CACHE_MS = 6 * 60 * 60 * 1000;
const RANKING_CACHE_KEY = "venyx:top-creators:v3";

export function TopCreators({ limit = 15, compact = false }: { limit?: number; compact?: boolean }) {
  const { t } = useI18n();
  const [creators, setCreators] = useState<TopCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const safeLimit = Math.min(MAX_RANKING_SIZE, Math.max(1, limit));

  useEffect(() => {
    (async () => {
      if (DEMO_MODE) {
        setCreators(DEMO_CREATORS.slice(0, safeLimit));
        setLoading(false);
        return;
      }

      try {
        const cached = localStorage.getItem(RANKING_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { savedAt: number; creators: TopCreator[] };
          if (Date.now() - parsed.savedAt < RANKING_CACHE_MS) {
            setCreators(parsed.creators.slice(0, safeLimit));
            setLoading(false);
            return;
          }
        }
      } catch {
        // Cache is only an optimization.
      }

      const [{ data: roles }, { data: plans }] = await Promise.all([
        supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "creator"),
        supabase
          .from("subscription_plans")
          .select("creator_id")
          .eq("is_active", true),
      ]);
      const planIds = new Set((plans ?? []).map((plan) => plan.creator_id));
      const ids = Array.from(
        new Set((roles ?? []).map((role) => role.user_id).filter((id) => planIds.has(id))),
      );
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      const [{ data: profs }, { data: followsRows }, { data: postsRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, is_verified")
          .in("user_id", ids),
        supabase.from("follows").select("followee_id").in("followee_id", ids),
        supabase.from("posts").select("creator_id, likes_count").in("creator_id", ids),
      ]);

      const followCount = new Map<string, number>();
      (followsRows ?? []).forEach((r: { followee_id: string }) => {
        followCount.set(r.followee_id, (followCount.get(r.followee_id) ?? 0) + 1);
      });
      const likesSum = new Map<string, number>();
      (postsRows ?? []).forEach((p: { creator_id: string; likes_count: number }) => {
        likesSum.set(p.creator_id, (likesSum.get(p.creator_id) ?? 0) + p.likes_count);
      });

      const ranked: TopCreator[] = (profs ?? [])
        .map((p) => ({
          ...p,
          score:
            (followCount.get(p.user_id) ?? 0) * 100 +
            (likesSum.get(p.user_id) ?? 0) +
            (p.is_verified ? 500 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, safeLimit);
      setCreators(ranked);
      try {
        localStorage.setItem(
          RANKING_CACHE_KEY,
          JSON.stringify({ savedAt: Date.now(), creators: ranked }),
        );
      } catch {
        // Cache is only an optimization.
      }
      setLoading(false);
    })();
  }, [safeLimit]);

  if (loading) return null;
  if (creators.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border p-6 text-center">
        <h2 className="font-display text-lg font-semibold text-foreground">{t("top.empty.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("top.empty.body")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Trophy className="h-5 w-5 text-primary" />
        <span className="text-gradient-gold font-display">{t("top.title")}</span>
      </h2>
      <p className="text-xs text-muted-foreground">{t("top.refresh")}</p>
      <div className={compact ? "flex gap-3 overflow-x-auto pb-2" : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"}>
        {creators.map((c, idx) => (
          <Link
            key={c.user_id}
            to="/profile/$username"
            params={{ username: c.username }}
            className={`group relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-card shadow-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-elegant ${
              compact ? "min-w-[140px] flex-shrink-0" : ""
            }`}
          >
            <div className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-xs font-bold text-primary backdrop-blur">
              #{idx + 1}
            </div>
            <div className="aspect-square overflow-hidden">
              {c.avatar_url ? (
                <img
                  src={c.avatar_url}
                  alt={c.display_name ?? c.username}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-3xl font-bold text-primary">
                  {c.username[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                {c.display_name ?? c.username}
                {c.is_verified && <Crown className="h-3 w-3 flex-shrink-0 text-primary" />}
              </div>
              <div className="truncate text-xs text-muted-foreground">@{c.username}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { listPublicCreators } from "@/_server/discovery.functions";
import { DEMO_CREATORS, DEMO_MODE } from "@/lib/demo-creators";
import { useI18n } from "@/lib/i18n";

interface TopCreator {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  score: number;
  rank?: number;
  status?: "online" | "recent";
}

const MAX_RANKING_SIZE = 15;
const RANKING_CACHE_MS = 6 * 60 * 60 * 1000;
const RANKING_CACHE_KEY = "venyx:top-creators:v3";

export function TopCreators({
  limit = 15,
  compact = false,
  hideHeading = false,
}: {
  limit?: number;
  compact?: boolean;
  hideHeading?: boolean;
}) {
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

      let ranked: TopCreator[] = [];
      try {
        const { creators: publicCreators } = await listPublicCreators({
          data: { limit: MAX_RANKING_SIZE },
        });
        ranked = publicCreators
          .map((p) => ({
            user_id: p.user_id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            is_verified: p.is_verified,
            score: p.score,
          }))
          .slice(0, safeLimit);
      } catch (error) {
        console.error("[TopCreators]", error);
      }
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
      {!hideHeading && (
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="text-gradient-gold font-display">{t("top.title")}</span>
        </h2>
      )}
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
              #{c.rank ?? idx + 1}
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
              {c.status === "online" && (
                <span
                  className="absolute bottom-2 right-2 h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
                  aria-label="online"
                />
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

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TopCreator {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  score: number;
}

export function TopCreators({ limit = 50, compact = false }: { limit?: number; compact?: boolean }) {
  const [creators, setCreators] = useState<TopCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Buscar criadoras (quem tem role 'creator')
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "creator");
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
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
        .slice(0, limit);
      setCreators(ranked);
      setLoading(false);
    })();
  }, [limit]);

  if (loading) return null;
  if (creators.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Trophy className="h-5 w-5 text-primary" />
        <span className="text-gradient-gold font-display">Top {limit} Criadoras</span>
      </h2>
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

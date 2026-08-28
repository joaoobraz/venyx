import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { DEMO_MODE, getDemoAsset } from "@/lib/demo-creators";

export interface CreatorSummary {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
}

export function CreatorCard({
  c,
  visitSource,
}: {
  c: CreatorSummary;
  visitSource?: "venyx_search";
}) {
  const demo = DEMO_MODE ? getDemoAsset(c.username) : null;
  const avatar = demo?.avatar_url ?? c.avatar_url;
  const cover = demo?.cover_url ?? c.cover_url ?? avatar;
  return (
    <Link
      to="/profile/$username"
      params={{ username: c.username }}
      search={visitSource ? { via: visitSource } : undefined}
      className="group overflow-hidden rounded-2xl border border-border/40 bg-gradient-card shadow-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-elegant"
    >
      <div className="aspect-[4/5] overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={c.display_name ?? c.username}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-primary">
            {c.username[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 p-3">
        {avatar && (
          <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
            <span className="truncate">{c.display_name ?? c.username}</span>
            {c.is_verified && <Crown className="h-3 w-3 flex-shrink-0 text-primary" />}
          </div>
          <div className="truncate text-xs text-muted-foreground">@{c.username}</div>
        </div>
      </div>
    </Link>
  );
}

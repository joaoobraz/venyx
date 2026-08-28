import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrendingUp, Compass } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopCreators } from "@/components/TopCreators";
import { useI18n } from "@/lib/i18n";
import { DEMO_CREATORS, DEMO_MODE, type DemoCreator } from "@/lib/demo-creators";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
});

type DiscoverCreator = Pick<
  DemoCreator,
  "user_id" | "username" | "display_name" | "avatar_url" | "cover_url" | "is_verified"
>;

export function ExplorePage() {
  const { t } = useI18n();
  const [discoverCreators, setDiscoverCreators] = useState<DiscoverCreator[]>(
    DEMO_MODE ? DEMO_CREATORS : [],
  );
  useEffect(() => {
    if (DEMO_MODE) {
      setDiscoverCreators(DEMO_CREATORS);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: roleRows }, { data: planRows }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "creator"),
        supabase.from("subscription_plans").select("creator_id").eq("is_active", true),
      ]);
      const creatorsWithPlans = new Set((planRows ?? []).map((row) => row.creator_id));
      const ids = (roleRows ?? [])
        .map((row) => row.user_id)
        .filter((id) => creatorsWithPlans.has(id));
      if (!ids.length) {
        if (!cancelled) setDiscoverCreators([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, cover_url, is_verified")
        .in("user_id", ids)
        .eq("is_verified", true)
        .limit(30);
      if (!cancelled) setDiscoverCreators((data ?? []) as DiscoverCreator[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <AppShell>
      <div className="space-y-8 sm:space-y-10">
        <TopCreators limit={15} />
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>{t("explore.trending")}</span>
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {discoverCreators.map((c) => (
              <Link
                key={c.username}
                to="/profile/$username"
                params={{ username: c.username }}
                className="group overflow-hidden rounded-2xl bg-gradient-card shadow-card transition-transform hover:-translate-y-1"
              >
                <div className="aspect-[4/5] overflow-hidden">
                  <img
                    src={c.cover_url}
                    alt={c.display_name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <img src={c.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{c.display_name}</div>
                    <div className="text-xs text-muted-foreground">@{c.username}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <Compass className="h-5 w-5 text-primary" />
            <span>{t("explore.new")}</span>
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {discoverCreators.slice()
              .reverse()
              .map((c) => (
                <Link
                  key={c.username + "n"}
                  to="/profile/$username"
                  params={{ username: c.username }}
                  className="overflow-hidden rounded-2xl bg-gradient-card p-4 text-center shadow-card"
                >
                  <img src={c.avatar_url} alt="" className="mx-auto h-16 w-16 rounded-full object-cover" />
                  <div className="mt-2 text-sm font-semibold text-foreground">{c.display_name}</div>
                  <div className="text-xs text-muted-foreground">@{c.username}</div>
                </Link>
              ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

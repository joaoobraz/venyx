import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, Compass, Tag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopCreators } from "@/components/TopCreators";
import { useI18n } from "@/lib/i18n";
import { DEMO_CREATORS } from "@/lib/demo-creators";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
});

function ExplorePage() {
  const { t, locale } = useI18n();
  const categories =
    locale === "en"
      ? ["Brazilian", "Blonde", "Brunette", "Redhead", "Fitness", "Cosplay", "Latina", "Couples"]
      : ["Brasileiras", "Loiras", "Morenas", "Ruivas", "Fitness", "Cosplay", "Latinas", "Casais"];
  return (
    <AppShell>
      <div className="space-y-8 sm:space-y-10">
        <TopCreators limit={15} />
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>{t("explore.trending")}</span>
          </h2>

          <p className="mb-4 text-sm text-muted-foreground">{t("explore.demoDisclosure")}</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {DEMO_CREATORS.map((c) => (
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
            {DEMO_CREATORS.slice()
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

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <Tag className="h-5 w-5 text-primary" />
            <span>{t("explore.categories")}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat}
                to="/search"
                search={{ q: cat }}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {cat}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

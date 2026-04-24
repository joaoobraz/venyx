import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, Sparkles, Tag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopCreators } from "@/components/TopCreators";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
});

const TRENDING = [
  { username: "aline", name: "Aline", avatar: "https://i.pravatar.cc/200?img=47", cover: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600" },
  { username: "lara", name: "Lara", avatar: "https://i.pravatar.cc/200?img=32", cover: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600" },
  { username: "bia", name: "Bia", avatar: "https://i.pravatar.cc/200?img=20", cover: "https://images.unsplash.com/photo-1521577352947-9bb58764b69a?w=600" },
  { username: "duda", name: "Duda", avatar: "https://i.pravatar.cc/200?img=49", cover: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600" },
];

const CATEGORIES = ["Brasileiras", "Loiras", "Morenas", "Ruivas", "Fitness", "Cosplay", "Latinas", "Casais"];

function ExplorePage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="space-y-10">
        <TopCreators limit={50} />
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" /> {t("explore.trending")}
          </h2>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {TRENDING.map((c) => (
              <Link
                key={c.username}
                to="/profile/$username"
                params={{ username: c.username }}
                className="group overflow-hidden rounded-2xl bg-gradient-card shadow-card transition-transform hover:-translate-y-1"
              >
                <div className="aspect-[4/5] overflow-hidden">
                  <img src={c.cover} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <img src={c.avatar} alt="" className="h-8 w-8 rounded-full" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground">@{c.username}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <Sparkles className="h-5 w-5 text-primary" /> {t("explore.new")}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {TRENDING.slice().reverse().map((c) => (
              <Link
                key={c.username + "n"}
                to="/profile/$username"
                params={{ username: c.username }}
                className="overflow-hidden rounded-2xl bg-gradient-card p-4 text-center shadow-card"
              >
                <img src={c.avatar} alt="" className="mx-auto h-16 w-16 rounded-full" />
                <div className="mt-2 text-sm font-semibold text-foreground">{c.name}</div>
                <div className="text-xs text-muted-foreground">@{c.username}</div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <Tag className="h-5 w-5 text-primary" /> {t("explore.categories")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button key={cat} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary">
                {cat}
              </button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

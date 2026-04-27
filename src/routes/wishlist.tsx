import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Crown, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { listMyWishlist } from "@/server/wishlist.functions";
import { WishlistButton } from "@/components/WishlistButton";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof listMyWishlist>> | null>(null);
  const [busy, setBusy] = useState(true);
  const fn = useServerFn(listMyWishlist);

  useEffect(() => {
    if (!user) return;
    fn().then((res) => setData(res)).finally(() => setBusy(false));
  }, [user, fn]);

  if (loading || busy) {
    return (
      <AppShell>
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="p-6 text-center text-muted-foreground">
          Faça login para ver sua wishlist.
        </div>
      </AppShell>
    );
  }

  const empty = !data || (data.creators.length === 0 && data.posts.length === 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <div className="rounded-2xl bg-accent/15 p-3">
            <Heart className="h-6 w-6 text-accent fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Minha wishlist</h1>
            <p className="text-sm text-muted-foreground">
              Criadoras e posts que você salvou. Receba aviso quando entrar em promoção.
            </p>
          </div>
        </header>

        {empty && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Sua wishlist está vazia. Toque no coração em qualquer post ou perfil.
            </p>
          </div>
        )}

        {data && data.creators.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Criadoras ({data.creators.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.creators.map((c) => (
                <div
                  key={c.user_id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <Link
                    to="/profile/$username"
                    params={{ username: c.username }}
                    className="h-12 w-12 overflow-hidden rounded-full bg-muted shrink-0"
                  >
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                        {c.username[0]?.toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/profile/$username"
                      params={{ username: c.username }}
                      className="block truncate text-sm font-bold text-foreground"
                    >
                      {c.display_name || c.username}
                    </Link>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Crown className="h-3 w-3 text-accent" />
                      {c.subscription_price_cents
                        ? `R$ ${(c.subscription_price_cents / 100).toFixed(2)}/mês`
                        : "Grátis"}
                    </div>
                  </div>
                  <WishlistButton targetType="creator" targetId={c.user_id} variant="icon" />
                </div>
              ))}
            </div>
          </section>
        )}

        {data && data.posts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Posts ({data.posts.length})
            </h2>
            <div className="space-y-2">
              {data.posts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="rounded-lg bg-primary/10 p-2 text-xs font-bold text-primary">
                    {p.visibility === "ppv" ? "PPV" : p.visibility === "subscribers" ? "VIP" : "PUB"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-foreground">{p.body || "(sem texto)"}</p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.price_cents > 0 && `R$ ${(p.price_cents / 100).toFixed(2)} • `}
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <WishlistButton targetType="post" targetId={p.id} variant="icon" />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

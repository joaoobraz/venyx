import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Crown, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { listMyWishlist } from "@/_server/wishlist.functions";
import { getFirstMediaForPosts } from "@/_server/media.functions";
import { WishlistButton } from "@/components/WishlistButton";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof listMyWishlist>> | null>(null);
  const [busy, setBusy] = useState(true);
  const [previewMap, setPreviewMap] = useState<Record<string, { url: string; mime_type: string }>>({});
  const fn = useServerFn(listMyWishlist);
  const mediaFn = useServerFn(getFirstMediaForPosts);

  useEffect(() => {
    if (!user) return;
    fn().then((res) => {
      setData(res);
      // Load media for all posts in batch
      if (res.posts.length > 0) {
        mediaFn({ data: { postIds: res.posts.map((p) => p.id) } })
          .then((mediaRes) => {
            setPreviewMap(mediaRes.mediaByPostId);
          })
          .catch((error) => {
            console.warn("Failed to load media previews:", error);
          });
      }
    }).finally(() => setBusy(false));
  }, [user, fn, mediaFn]);

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
            <h1 className="text-2xl font-bold text-foreground">Salvos</h1>
            <p className="text-sm text-muted-foreground">
              Conteúdos que você salvou. Clique em qualquer card para abrir o post correspondente.
            </p>
          </div>
        </header>

        {empty && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Você ainda não salvou nenhum conteúdo. Toque no coração em qualquer post para adicioná-lo aqui.
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
              Conteúdo salvo ({data.posts.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.posts.map((p) => {
                const preview = previewMap[p.id];
                return (
                  <Link
                    key={p.id}
                    to="/saved/$postId"
                    params={{ postId: p.id }}
                    className="block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {preview?.url ? (
                        preview.mime_type.startsWith("video/") ? (
                          <video
                            src={preview.url}
                            muted
                            autoPlay
                            loop
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img src={preview.url} alt="Prévia do conteúdo salvo" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4 text-center">
                          <div className="mb-2 text-2xl font-bold text-primary/40">
                            {p.body ? "📄" : "🖼️"}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">{p.body || "Conteúdo sem legenda"}</p>
                        </div>
                      )}
                      <div className="absolute right-2 top-2">
                        <WishlistButton targetType="post" targetId={p.id} variant="icon" />
                      </div>
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        <span>{p.visibility === "ppv" ? "PPV" : p.visibility === "subscribers" ? "VIP" : "PÚBLICO"}</span>
                        {p.price_cents > 0 && <span>R$ {(p.price_cents / 100).toFixed(2)}</span>}
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground">{p.body || "Conteúdo salvo sem descrição."}</p>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

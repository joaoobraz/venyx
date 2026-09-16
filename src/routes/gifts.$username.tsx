import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, Gift, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { GiftProductImage } from "@/components/GiftProductImage";
import { TipModal } from "@/components/TipModal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/demo-creators";
import { getDemoGiftList, type PublicGiftItem } from "@/lib/demo-gifts";
import { DEMO_OPERATIONS_CHANGED_EVENT } from "@/lib/demo-operations";
import { useI18n } from "@/lib/i18n";
import {
  CLIENT_PROFILE_PREVIEW,
  canPreviewOwnProfileAsClient,
  previewOnlyMessage,
} from "@/lib/creator-profile-preview";

export const Route = createFileRoute("/gifts/$username")({
  validateSearch: (search: Record<string, unknown>): { preview?: "client" } => ({
    preview: search.preview === CLIENT_PROFILE_PREVIEW ? CLIENT_PROFILE_PREVIEW : undefined,
  }),
  component: PublicGiftListPage,
});

type PublicCreator = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
};

type PublicSettings = {
  title: string;
  intro: string;
  thank_you_message: string;
  is_published: boolean;
};

function money(cents: number, locale: "pt-BR" | "en" | "es") {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function PublicGiftListPage() {
  const { username } = useParams({ strict: false }) as { username: string };
  const { preview } = useSearch({ strict: false }) as { preview?: "client" };
  const { tr, locale } = useI18n();
  const { user, isCreator, demoPreviewRole } = useAuth();
  const [creator, setCreator] = useState<PublicCreator | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [items, setItems] = useState<PublicGiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PublicGiftItem | null>(null);
  const isClientPreview = canPreviewOwnProfileAsClient({
    requested: preview === CLIENT_PROFILE_PREVIEW,
    authenticatedUserId: user?.id,
    profileUserId: creator?.user_id,
    isCreator,
    demoPreviewRole,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const demo = DEMO_MODE ? getDemoGiftList(username, user?.id) : null;
      if (demo) {
        if (cancelled) return;
        setCreator(demo.creator);
        setSettings(demo.settings);
        setItems(demo.items);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id,username,display_name,avatar_url,cover_url,is_verified")
        .eq("username", username)
        .maybeSingle();
      if (!profile || cancelled) {
        setLoading(false);
        return;
      }
      const [{ data: giftSettings }, { data: giftItems }] = await Promise.all([
        supabase
          .from("creator_gift_settings")
          .select("title,intro,thank_you_message,is_published")
          .eq("creator_id", profile.user_id)
          .eq("is_published", true)
          .maybeSingle(),
        supabase
          .from("creator_gift_items")
          .select(
            "id,title,description,emoji,image_url,value_cents,received_count,availability,track_stock,stock_quantity",
          )
          .eq("creator_id", profile.user_id)
          .eq("is_active", true)
          .order("position"),
      ]);
      if (cancelled) return;
      setCreator(profile);
      setSettings(giftSettings);
      setItems(
        (giftItems ?? [])
          .filter((item) => !item.track_stock || (item.stock_quantity ?? 0) > 0)
          .map((item) => ({
            ...item,
            availability: item.availability === "on_request" ? "on_request" : "available",
          })),
      );
      setLoading(false);
    };
    void load();
    const reloadDemo = () => void load();
    const refreshTimer = DEMO_MODE ? null : window.setInterval(reloadDemo, 10_000);
    window.addEventListener(DEMO_OPERATIONS_CHANGED_EVENT, reloadDemo);
    window.addEventListener("storage", reloadDemo);
    return () => {
      cancelled = true;
      if (refreshTimer) window.clearInterval(refreshTimer);
      window.removeEventListener(DEMO_OPERATIONS_CHANGED_EVENT, reloadDemo);
      window.removeEventListener("storage", reloadDemo);
    };
  }, [username, user?.id]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {tr("Carregando…", "Loading…")}
      </div>
    );
  if (!creator || !settings?.is_published) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <Gift className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">
            {tr("Lista não encontrada", "List not found")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {tr(
              "Esta criadora ainda não publicou uma Lista de Mimos.",
              "This creator has not published a Gift List yet.",
            )}
          </p>
          <Button className="mt-5" variant="outline" asChild>
            <Link
              to="/profile/$username"
              params={{ username }}
              search={isClientPreview ? { preview: CLIENT_PROFILE_PREVIEW } : {}}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tr("Voltar ao perfil", "Back to profile")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const creatorName = creator.display_name || creator.username;
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_36%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.5))]">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-serif text-xl font-bold italic text-foreground">
            Fanlira
          </Link>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link
                to="/profile/$username"
                params={{ username }}
                search={isClientPreview ? { preview: CLIENT_PROFILE_PREVIEW } : {}}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {tr("Perfil", "Profile")}
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/links/$username" params={{ username }}>
                <Link2 className="mr-1.5 h-4 w-4" />
                Fanlira Links
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        {isClientPreview && (
          <div className="mx-auto mb-8 flex max-w-4xl flex-col gap-3 rounded-2xl border border-primary/35 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">
                  {tr("Lista de Mimos vista como cliente", "Gift List viewed as a client")}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {tr(
                    "Os produtos e valores são reais, mas nenhum mimo poderá ser comprado nesta prévia.",
                    "Products and prices are real, but no gift can be purchased in this preview.",
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile/$username" params={{ username }} search={{}}>
                <X className="mr-1.5 h-4 w-4" />
                {tr("Encerrar prévia", "Exit preview")}
              </Link>
            </Button>
          </div>
        )}
        <section className="mx-auto max-w-2xl text-center">
          <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-muted shadow-xl ring-2 ring-primary/30">
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creatorName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-primary">
                {creatorName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <h1 className="font-serif text-3xl font-bold">{creatorName}</h1>
            {creator.is_verified && <CheckCircle2 className="h-5 w-5 text-primary" />}
          </div>
          <p className="text-sm text-muted-foreground">@{creator.username}</p>
          <h2 className="mt-6 text-2xl font-semibold">{settings.title}</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{settings.intro}</p>
        </section>

        {items.length === 0 ? (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            {tr("Nenhum mimo disponível agora.", "No gifts are available right now.")}
          </div>
        ) : (
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="group flex flex-col rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <GiftProductImage
                  src={item.image_url}
                  alt={item.title}
                  emoji={item.emoji}
                  className="aspect-[4/5] w-full rounded-2xl"
                />
                <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
                  {item.availability === "on_request"
                    ? tr("Disponível sob encomenda", "Available on request")
                    : tr("Disponível agora", "Available now")}
                </div>
                <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {tr("Valor do mimo", "Gift value")}
                    </div>
                    <strong className="text-xl text-primary">
                      {money(item.value_cents, locale)}
                    </strong>
                  </div>
                  {item.received_count > 0 && (
                    <span className="text-xs text-muted-foreground">{item.received_count}×</span>
                  )}
                </div>
                {item.track_stock && item.stock_quantity !== null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.stock_quantity} {tr("unidades disponíveis", "units available")}
                  </p>
                )}
                <Button
                  className="mt-4 w-full"
                  onClick={() =>
                    isClientPreview ? toast.info(previewOnlyMessage(locale)) : setSelected(item)
                  }
                >
                  <Gift className="mr-2 h-4 w-4" />
                  {tr("Enviar este mimo", "Send this gift")}
                </Button>
              </article>
            ))}
          </section>
        )}

        <footer className="py-12 text-center text-xs text-muted-foreground">
          {tr("Pagamento protegido pela Fanlira", "Payment protected by Fanlira")}
        </footer>
      </main>

      <TipModal
        open={!isClientPreview && !!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        creatorId={creator.user_id}
        creatorName={creatorName}
        giftItem={
          selected
            ? {
                id: selected.id,
                title: selected.title,
                amountCents: selected.value_cents,
                emoji: selected.emoji,
              }
            : undefined
        }
      />
    </div>
  );
}

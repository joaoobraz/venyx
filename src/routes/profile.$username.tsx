import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  MessageCircle,
  Heart,
  ShieldCheck,
  MapPin,
  Users,
  Images,
  Clock3,
  Gift,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PostCard, type PostWithRelations } from "@/components/PostCard";
import { fetchPosts } from "@/lib/posts";
import { TipModal } from "@/components/TipModal";
import { SubscribeModal } from "@/components/SubscribeModal";
import { SafetyMenu } from "@/components/SafetyMenu";
import { DEMO_MODE, getDemoCreator } from "@/lib/demo-creators";
import { getDemoChatThreadForCreator } from "@/lib/demo-chat";
import { isDemoSubscribed, toggleDemoSubscription } from "@/lib/demo-content";
import {
  readDemoOperations,
  recordDemoPurchase,
  updateDemoOperations,
} from "@/lib/demo-operations";
import { addDemoNotification } from "@/lib/demo-notifications";

export const Route = createFileRoute("/profile/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { t, tr, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "media" | "about">("posts");
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [tipOpen, setTipOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [ownerMfa, setOwnerMfa] = useState(false);
  const [giftListAvailable, setGiftListAvailable] = useState(false);
  const [demoSubscribed, setDemoSubscribed] = useState(false);
  const [demoSubscriptionOpen, setDemoSubscriptionOpen] = useState(false);
  const [demoCouponCode, setDemoCouponCode] = useState("");

  useEffect(() => {
    if (!profile) return;
    if (profile.user_id.startsWith("demo-")) {
      setOwnerMfa(false);
      setGiftListAvailable(true);
      return;
    }
    void Promise.all([
      supabase
        .from("security_settings")
        .select("mfa_enabled")
        .eq("user_id", profile.user_id)
        .maybeSingle(),
      supabase
        .from("creator_gift_settings")
        .select("is_published")
        .eq("creator_id", profile.user_id)
        .eq("is_published", true)
        .maybeSingle(),
    ]).then(([{ data: security }, { data: gifts }]) => {
      setOwnerMfa(!!(security as { mfa_enabled?: boolean } | null)?.mfa_enabled);
      setGiftListAvailable(!!gifts);
    });
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    const demoCreator = DEMO_MODE ? getDemoCreator(username) : null;
    if (demoCreator) {
      setProfile({
        id: demoCreator.user_id,
        user_id: demoCreator.user_id,
        username: demoCreator.username,
        display_name: demoCreator.display_name,
        bio: locale === "en" ? demoCreator.bio_en : demoCreator.bio,
        avatar_url: demoCreator.avatar_url,
        cover_url: demoCreator.cover_url,
        is_verified: true,
        subscription_price_cents: demoCreator.subscription_price_cents,
      });
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => {
        const next = (data as Profile) ?? null;
        setProfile(next);
        setLoading(false);
      });
  }, [username, locale]);

  useEffect(() => {
    if (!profile) return;
    fetchPosts({ creatorId: profile.user_id, viewerId: user?.id ?? null, locale }).then(setPosts);
  }, [profile, user?.id, locale, demoSubscribed]);

  const isMe = user && profile && user.id === profile.user_id;
  const isDemoProfile = profile?.user_id.startsWith("demo-") ?? false;
  const demoCreator = isDemoProfile ? getDemoCreator(username) : null;
  const demoThread = demoCreator ? getDemoChatThreadForCreator(demoCreator.user_id) : null;
  const demoCoupon =
    user && demoCouponCode.trim()
      ? readDemoOperations(user.id).coupons.find(
          (item) => item.active && item.code === demoCouponCode.trim().toUpperCase(),
        )
      : null;
  const demoSubscriptionCents = demoCreator
    ? Math.round(
        demoCreator.subscription_price_cents * (1 - (demoCoupon?.discount_percent ?? 0) / 100),
      )
    : 0;
  const mediaPosts = posts.filter((p) => p.media.length > 0);

  useEffect(() => {
    if (user && demoCreator) {
      setDemoSubscribed(isDemoSubscribed(user.id, demoCreator.user_id));
    }
  }, [demoCreator, user]);

  return (
    <AppShell>
      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : !profile ? (
        <div className="text-center text-muted-foreground">404 — perfil não encontrado</div>
      ) : (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl bg-gradient-card shadow-card">
            <div className="h-36 bg-gradient-primary sm:h-44 md:h-56">
              {profile.cover_url && (
                <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="relative px-4 pb-5 sm:px-5">
              <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-card bg-muted sm:h-24 sm:w-24">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
                      {profile.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                {!isMe && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {giftListAvailable && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/gifts/$username" params={{ username: profile.username }}>
                          <Gift className="mr-1.5 h-4 w-4 text-primary" />{" "}
                          {tr("Lista de Mimos", "Gift List")}
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setTipOpen(true)}>
                      <Heart className="mr-1.5 h-4 w-4 text-primary" /> {t("profile.tip")}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to="/chat"
                        search={
                          isDemoProfile && demoThread
                            ? { thread: demoThread.id }
                            : { with: profile.user_id }
                        }
                      >
                        <MessageCircle className="mr-1.5 h-4 w-4" /> {t("profile.message")}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (isDemoProfile) {
                          if (!user || !demoCreator) {
                            navigate({ to: "/login" });
                            return;
                          }
                          setDemoSubscriptionOpen(true);
                          return;
                        }
                        setSubOpen(true);
                      }}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isDemoProfile && demoSubscribed
                        ? tr("Assinatura ativa", "Active subscription")
                        : t("profile.subscribe")}
                    </Button>
                    <SafetyMenu
                      targetType="profile"
                      targetId={profile.user_id}
                      targetUserId={profile.user_id}
                      targetLabel={`@${profile.username}`}
                      onBlocked={() => navigate({ to: "/explore" })}
                    />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">
                  {profile.display_name || profile.username}
                </h1>
                {profile.is_verified && <CheckCircle2 className="h-5 w-5 text-primary" />}
                {ownerMfa && (
                  <span title="Conta protegida com 2FA" className="inline-flex items-center">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">@{profile.username}</div>
              {profile.bio && (
                <p data-user-content className="mt-3 text-sm text-foreground">
                  {profile.bio}
                </p>
              )}
              {demoCreator && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {demoCreator.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                    <Users className="h-3.5 w-3.5 text-primary" /> {demoCreator.age}{" "}
                    {tr("anos", "years")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                    <Images className="h-3.5 w-3.5 text-primary" />
                    {locale === "en" ? demoCreator.category_en : demoCreator.category}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                    <Clock3 className="h-3.5 w-3.5 text-primary" />
                    {demoCreator.status === "online"
                      ? tr("Online agora", "Online now")
                      : tr(
                          `Ativa há ${demoCreator.last_active_minutes} min`,
                          `Active ${demoCreator.last_active_minutes} min ago`,
                        )}
                  </span>
                  <span className="rounded-lg bg-background/60 px-2.5 py-2">
                    {demoCreator.subscribers_count.toLocaleString(
                      locale === "en" ? "en-US" : "pt-BR",
                    )}{" "}
                    {tr("assinantes", "subscribers")}
                  </span>
                  <span className="rounded-lg bg-background/60 px-2.5 py-2">
                    {demoCreator.likes_count.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}{" "}
                    {tr("curtidas", "likes")}
                  </span>
                  <span className="rounded-lg bg-background/60 px-2.5 py-2">
                    {demoCreator.posts_count} posts
                  </span>
                  <span className="rounded-lg bg-background/60 px-2.5 py-2">
                    R$ {(demoCreator.subscription_price_cents / 100).toFixed(2)}/
                    {tr("mês", "month")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {isMe && <BecomeCreatorBanner />}

          <div className="flex gap-1 rounded-xl bg-card p-1">
            {(["posts", "media", "about"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === k
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`profile.${k}`)}
              </button>
            ))}
          </div>

          {tab === "about" ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {profile.bio ?? t("profile.noBio")}
            </div>
          ) : tab === "media" ? (
            mediaPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {t("profile.noMedia")}
              </div>
            ) : (
              <div className="space-y-4">
                {mediaPosts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("profile.noPosts")}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
          {profile && (
            <>
              <TipModal
                open={tipOpen}
                onOpenChange={setTipOpen}
                creatorId={profile.user_id}
                creatorName={profile.display_name || profile.username}
              />
              {!isDemoProfile && (
                <>
                  <SubscribeModal
                    open={subOpen}
                    onOpenChange={setSubOpen}
                    creatorId={profile.user_id}
                    creatorName={profile.display_name || profile.username}
                    basePriceCents={profile.subscription_price_cents ?? 0}
                  />
                </>
              )}
              {isDemoProfile && demoCreator && user && (
                <Dialog open={demoSubscriptionOpen} onOpenChange={setDemoSubscriptionOpen}>
                  <DialogContent className="w-[calc(100%-2rem)] max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {demoSubscribed
                          ? tr("Gerenciar assinatura", "Manage subscription")
                          : tr("Confirmar assinatura", "Confirm subscription")}
                      </DialogTitle>
                      <DialogDescription>
                        {tr(
                          "Esta operação é apenas demonstrativa e não cria cobrança real.",
                          "This is a demo-only operation and creates no real charge.",
                        )}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="font-semibold text-foreground">
                        {demoCreator.display_name}
                      </div>
                      <div className="text-sm text-muted-foreground">@{demoCreator.username}</div>
                      <div className="mt-4 text-2xl font-bold text-primary">
                        R$ {(demoSubscriptionCents / 100).toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{tr("mês", "month")}
                        </span>
                      </div>
                      {demoCoupon && (
                        <div className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {demoCoupon.code}: {demoCoupon.discount_percent}%{" "}
                          {tr("de desconto aplicado", "discount applied")}
                        </div>
                      )}
                    </div>
                    {!demoSubscribed && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          {tr("Cupom (opcional)", "Coupon (optional)")}
                        </label>
                        <Input
                          value={demoCouponCode}
                          onChange={(event) => setDemoCouponCode(event.target.value.toUpperCase())}
                          placeholder="BEMVINDO20"
                        />
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDemoSubscriptionOpen(false)}>
                        {tr("Voltar", "Back")}
                      </Button>
                      <Button
                        variant={demoSubscribed ? "destructive" : "default"}
                        onClick={() => {
                          if (!demoSubscribed && demoCouponCode.trim() && !demoCoupon) {
                            toast.error(
                              tr("Cupom inválido ou pausado.", "Invalid or paused coupon."),
                            );
                            return;
                          }
                          const subscribed = toggleDemoSubscription(user.id, demoCreator.user_id);
                          setDemoSubscribed(subscribed);
                          if (subscribed) {
                            recordDemoPurchase({
                              kind: "subscription",
                              buyer_id: user.id,
                              creator_id: demoCreator.user_id,
                              creator_name: demoCreator.display_name,
                              reference_id: demoCreator.user_id,
                              label: tr("Assinatura mensal", "Monthly subscription"),
                              amount_cents: demoSubscriptionCents,
                            });
                            if (demoCoupon) {
                              updateDemoOperations(user.id, (state) => ({
                                ...state,
                                coupons: state.coupons.map((item) =>
                                  item.id === demoCoupon.id
                                    ? { ...item, uses: item.uses + 1 }
                                    : item,
                                ),
                              }));
                            }
                            addDemoNotification(user.id, {
                              type: "sale",
                              title: `Nova assinatura de ${demoCreator.display_name}`,
                              title_en: `New ${demoCreator.display_name} subscription`,
                              body: "Pagamento demonstrativo confirmado e refletido na carteira da Modelo.",
                              body_en:
                                "Demo payment confirmed and reflected in the Creator wallet.",
                              link: "/presentation/wallet",
                            });
                            toast.success(
                              tr(
                                "Assinatura simulada ativada!",
                                "Simulated subscription activated!",
                              ),
                            );
                          } else {
                            toast.success(
                              tr(
                                "Assinatura simulada cancelada.",
                                "Simulated subscription cancelled.",
                              ),
                            );
                          }
                          setDemoCouponCode("");
                          setDemoSubscriptionOpen(false);
                        }}
                      >
                        {demoSubscribed
                          ? tr("Cancelar assinatura", "Cancel subscription")
                          : tr("Confirmar pagamento simulado", "Confirm simulated payment")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

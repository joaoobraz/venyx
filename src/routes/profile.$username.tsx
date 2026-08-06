import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
  PauseCircle,
  Trophy,
  Instagram,
  Settings,
  MapPinOff,
  Eye,
  X,
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
import { PostCard, type PostWithRelations } from "@/components/PostCard";
import { fetchPosts } from "@/lib/posts";
import { TipModal } from "@/components/TipModal";
import { SubscribeModal } from "@/components/SubscribeModal";
import { SafetyMenu } from "@/components/SafetyMenu";
import { DEMO_MODE, getDemoCreator } from "@/lib/demo-creators";
import { demoLocale } from "@/lib/demo-content";
import { getDemoChatThreadForCreator } from "@/lib/demo-chat";
import { isDemoSubscribed, toggleDemoSubscription } from "@/lib/demo-content";
import {
  readDemoOperations,
  recordDemoPurchase,
  updateDemoOperations,
} from "@/lib/demo-operations";
import { addDemoNotification } from "@/lib/demo-notifications";
import {
  calculateCouponPrice,
  couponBenefitLabel,
  couponPostOfferPrice,
  couponRemainingSlots,
  evaluateCouponAvailability,
} from "@/lib/coupon-offers";
import {
  CREATOR_PROFILE_VISIBILITY_CHANGED_EVENT,
  DEFAULT_PROFILE_VISIBILITY,
  isViewerStateBlocked,
  profileVisibilityFromDatabase,
  readDemoProfileVisibility,
  type CreatorProfileVisibility,
} from "@/lib/profile-visibility";
import {
  CLIENT_PROFILE_PREVIEW,
  canPreviewOwnProfileAsClient,
  previewOnlyMessage,
} from "@/lib/creator-profile-preview";

export const Route = createFileRoute("/profile/$username")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { coupon?: string; via?: "venyx_search"; preview?: "client" } => ({
    coupon: typeof search.coupon === "string" ? search.coupon : undefined,
    via: search.via === "venyx_search" ? "venyx_search" : undefined,
    preview: search.preview === CLIENT_PROFILE_PREVIEW ? CLIENT_PROFILE_PREVIEW : undefined,
  }),
  component: ProfilePage,
});

export function ProfilePage() {
  const { username } = useParams({ strict: false }) as { username: string };
  const { coupon: linkedCouponCode, preview } = useSearch({ strict: false }) as {
    coupon?: string;
    preview?: "client";
  };
  const { t, tr, locale } = useI18n();
  const {
    user,
    profile: authenticatedProfile,
    accountPaused,
    demoPreviewRole,
    isCreator,
  } = useAuth();
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
  const [profilePaused, setProfilePaused] = useState(false);
  const [visibility, setVisibility] = useState<CreatorProfileVisibility>({
    ...DEFAULT_PROFILE_VISIBILITY,
    blockedStates: [],
  });

  useEffect(() => {
    if (!profile) {
      setProfilePaused(false);
      return;
    }
    if (profile.user_id === user?.id) {
      setProfilePaused(accountPaused);
      return;
    }
    if (profile.user_id.startsWith("demo-")) {
      setProfilePaused(false);
      return;
    }
    void (supabase as any)
      .rpc("is_account_paused", { _user_id: profile.user_id })
      .then(({ data }: { data: boolean | null }) => setProfilePaused(data === true))
      .catch(() => setProfilePaused(false));
  }, [accountPaused, profile, user?.id]);

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
    if (!visibility.showBio && tab === "about") setTab("posts");
  }, [tab, visibility.showBio]);

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
        location: demoCreator.location,
        links: null,
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
    let cancelled = false;
    const loadVisibility = () => {
      if (profile.user_id.startsWith("demo-")) {
        setVisibility(readDemoProfileVisibility(profile.user_id));
        return;
      }
      void supabase
        .from("creator_profile_visibility")
        .select("*")
        .eq("creator_id", profile.user_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) {
            setVisibility(profileVisibilityFromDatabase(data as Record<string, unknown> | null));
          }
        });
    };
    const handleVisibilityChange = (event: Event) => {
      const changedCreatorId = (event as CustomEvent<{ creatorId?: string }>).detail?.creatorId;
      if (!changedCreatorId || changedCreatorId === profile.user_id) loadVisibility();
    };
    loadVisibility();
    window.addEventListener(CREATOR_PROFILE_VISIBILITY_CHANGED_EVENT, handleVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CREATOR_PROFILE_VISIBILITY_CHANGED_EVENT, handleVisibilityChange);
    };
  }, [profile]);

  const isMe = user && profile && user.id === profile.user_id;
  const isDemoCreatorOwner = demoPreviewRole === "creator" && profile?.user_id === "demo-aline";
  const isProfileOwner = Boolean(isMe || isDemoCreatorOwner);
  const isLeadPreview = canPreviewOwnProfileAsClient({
    requested: preview === CLIENT_PROFILE_PREVIEW,
    authenticatedUserId: user?.id,
    profileUserId: profile?.user_id,
    isCreator,
    demoPreviewRole,
  });
  const showingClientExperience = !isProfileOwner || isLeadPreview;
  const viewerStateBlocked =
    Boolean(profile) &&
    !isProfileOwner &&
    isViewerStateBlocked(visibility, authenticatedProfile?.location);
  const isDemoProfile = profile?.user_id.startsWith("demo-") ?? false;
  const demoCreator = isDemoProfile ? getDemoCreator(username) : null;
  const demoThread = demoCreator ? getDemoChatThreadForCreator(demoCreator.user_id) : null;
  const demoOperations = readDemoOperations(user?.id ?? "anonymous-coupon-preview");
  const normalizedCouponCode = demoCouponCode.trim().toUpperCase();
  const normalizedLinkedCode = linkedCouponCode?.trim().toUpperCase();
  const notifyPreviewOnly = () => toast.info(previewOnlyMessage(locale));

  const loadProfilePosts = useCallback(async () => {
    if (!profile) return;
    const nextPosts = await fetchPosts({
      creatorId: profile.user_id,
      viewerId: isLeadPreview ? null : (user?.id ?? null),
      demoStateUserId: isDemoProfile ? (user?.id ?? null) : null,
      locale: demoLocale(locale),
    });
    setPosts(nextPosts);
  }, [isDemoProfile, isLeadPreview, locale, profile, user?.id]);

  useEffect(() => {
    void loadProfilePosts();
  }, [demoSubscribed, loadProfilePosts]);

  useEffect(() => {
    if (!isLeadPreview) return;
    setTipOpen(false);
    setSubOpen(false);
    setDemoSubscriptionOpen(false);
  }, [isLeadPreview]);
  const demoCouponCandidate =
    demoOperations && normalizedCouponCode
      ? (demoOperations.coupons.find((item) => item.code === normalizedCouponCode) ?? null)
      : null;
  const wasDemoSubscriber = Boolean(
    user &&
    demoCreator &&
    demoOperations?.purchases.some(
      (purchase) =>
        purchase.kind === "subscription" &&
        purchase.buyer_id === user.id &&
        purchase.creator_id === demoCreator.user_id,
    ),
  );
  const demoCouponAvailability = demoCouponCandidate
    ? evaluateCouponAvailability(demoCouponCandidate, {
        userId: user?.id ?? "anonymous-coupon-viewer",
        wasSubscriber: wasDemoSubscriber,
        isActiveSubscriber: demoSubscribed,
      })
    : null;
  const couponWasAppliedByLink =
    Boolean(normalizedLinkedCode) && normalizedLinkedCode === normalizedCouponCode;
  const demoCoupon =
    demoCouponCandidate &&
    demoCouponAvailability?.available &&
    (!demoCouponCandidate.link_only || couponWasAppliedByLink)
      ? demoCouponCandidate
      : null;
  const demoSubscriptionCents = demoCreator
    ? demoCoupon
      ? calculateCouponPrice(demoCoupon)
      : demoCreator.subscription_price_cents
    : 0;
  const demoPostOfferCents = demoCoupon
    ? couponPostOfferPrice(demoCoupon)
    : (demoCreator?.subscription_price_cents ?? 0);
  const demoCouponIssue =
    normalizedCouponCode && !demoCoupon
      ? !demoCouponCandidate
        ? tr("Oferta não encontrada.", "Offer not found.")
        : demoCouponCandidate.link_only && !couponWasAppliedByLink
          ? tr(
              "Esta oferta só pode ser aplicada pelo link oficial da modelo.",
              "This offer can only be applied through the creator's official link.",
            )
          : demoCouponAvailability?.reason === "expired"
            ? tr("Esta oferta expirou.", "This offer has expired.")
            : demoCouponAvailability?.reason === "sold_out"
              ? tr("As vagas promocionais acabaram.", "The promotional slots are gone.")
              : demoCouponAvailability?.reason === "already_used"
                ? tr("Você já utilizou esta oferta.", "You already used this offer.")
                : demoCouponAvailability?.reason === "new_only"
                  ? tr(
                      "Esta oferta é somente para novos assinantes.",
                      "This offer is for new subscribers only.",
                    )
                  : demoCouponAvailability?.reason === "former_only"
                    ? tr(
                        "Esta oferta é somente para antigos assinantes.",
                        "This offer is for former subscribers only.",
                      )
                    : tr("Esta oferta não está disponível.", "This offer is not available.")
      : null;
  const mediaPosts = posts.filter((p) => p.media.length > 0);
  const profileTabs = visibility.showBio
    ? (["posts", "media", "about"] as const)
    : (["posts", "media"] as const);

  useEffect(() => {
    if (user && demoCreator) {
      setDemoSubscribed(isDemoSubscribed(user.id, demoCreator.user_id));
    }
  }, [demoCreator, user]);

  useEffect(() => {
    if (!demoCreator || !linkedCouponCode || isLeadPreview) return;
    setDemoCouponCode(linkedCouponCode.trim().toUpperCase());
    setDemoSubscriptionOpen(true);
  }, [demoCreator, isLeadPreview, linkedCouponCode]);

  return (
    <AppShell>
      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : !profile ? (
        <div className="text-center text-muted-foreground">404 — perfil não encontrado</div>
      ) : viewerStateBlocked ? (
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-500/30 bg-card p-8 text-center shadow-card">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <MapPinOff className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-foreground">
            {tr("Perfil indisponível na sua região", "Profile unavailable in your region")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tr(
              "A criadora restringiu a visualização deste perfil no estado cadastrado na sua conta.",
              "The creator restricted this profile in the state registered on your account.",
            )}
          </p>
          <Button className="mt-5" variant="outline" asChild>
            <Link to="/explore">{tr("Voltar para Explorar", "Back to Explore")}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {isLeadPreview && (
            <div
              data-testid="client-profile-preview-banner"
              className="flex flex-col gap-3 rounded-2xl border border-primary/35 bg-primary/10 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-primary/15 p-2 text-primary">
                  <Eye className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">
                    {tr("Visualizando como cliente", "Viewing as a client")}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {tr(
                      "Prévia segura: nenhuma interação, compra ou assinatura será criada.",
                      "Safe preview: no interaction, purchase or subscription will be created.",
                    )}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/profile/$username" params={{ username: profile.username }} search={{}}>
                  <X className="mr-1.5 h-4 w-4" />
                  {tr("Sair da visualização", "Exit preview")}
                </Link>
              </Button>
            </div>
          )}
          {profilePaused && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">
                    {isProfileOwner && !isLeadPreview
                      ? tr("Seu perfil está pausado", "Your profile is paused")
                      : tr(
                          "Esta conta está temporariamente pausada",
                          "This account is temporarily paused",
                        )}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {isProfileOwner && !isLeadPreview
                      ? tr(
                          "Ele não aparece publicamente e não aceita novas compras ou mensagens.",
                          "It is not public and cannot receive new purchases or messages.",
                        )
                      : tr(
                          "O conteúdo já contratado continua disponível até o vencimento, sem novas compras ou mensagens.",
                          "Already purchased content remains available until expiration, with no new purchases or messages.",
                        )}
                  </p>
                </div>
              </div>
              {isProfileOwner && !isLeadPreview && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings/privacy">{tr("Gerenciar pausa", "Manage pause")}</Link>
                </Button>
              )}
            </div>
          )}
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
                {showingClientExperience ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {visibility.showWishlist && giftListAvailable && !profilePaused && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          to="/gifts/$username"
                          params={{ username: profile.username }}
                          search={isLeadPreview ? { preview: CLIENT_PROFILE_PREVIEW } : {}}
                        >
                          <Gift className="mr-1.5 h-4 w-4 text-primary" />{" "}
                          {tr("Lista de Mimos", "Gift List")}
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={profilePaused || accountPaused}
                      onClick={() => (isLeadPreview ? notifyPreviewOnly() : setTipOpen(true))}
                    >
                      <Heart className="mr-1.5 h-4 w-4 text-primary" /> {t("profile.tip")}
                    </Button>
                    {profilePaused || accountPaused ? (
                      <Button variant="outline" size="sm" disabled>
                        <MessageCircle className="mr-1.5 h-4 w-4" /> {t("profile.message")}
                      </Button>
                    ) : isLeadPreview ? (
                      <Button variant="outline" size="sm" onClick={notifyPreviewOnly}>
                        <MessageCircle className="mr-1.5 h-4 w-4" /> {t("profile.message")}
                      </Button>
                    ) : (
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
                    )}
                    {visibility.showPlans && (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (isLeadPreview) {
                            setSubOpen(true);
                            return;
                          }
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
                        disabled={profilePaused || accountPaused}
                      >
                        {profilePaused
                          ? tr("Conta pausada", "Account paused")
                          : isDemoProfile && demoSubscribed && !isLeadPreview
                            ? tr("Assinatura ativa", "Active subscription")
                            : t("profile.subscribe")}
                      </Button>
                    )}
                    {!isLeadPreview && (
                      <SafetyMenu
                        targetType="profile"
                        targetId={profile.user_id}
                        targetUserId={profile.user_id}
                        targetLabel={`@${profile.username}`}
                        onBlocked={() => navigate({ to: "/explore" })}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to="/profile/$username"
                        params={{ username: profile.username }}
                        search={{ preview: CLIENT_PROFILE_PREVIEW }}
                      >
                        <Eye className="mr-1.5 h-4 w-4" />
                        {tr("Visualizar como cliente", "View as client")}
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/settings/profile">
                        <Settings className="mr-1.5 h-4 w-4" />
                        {tr("Editar exibição", "Edit visibility")}
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">
                  {profile.display_name || profile.username}
                </h1>
                {visibility.showVerifiedBadge && profile.is_verified && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
                {visibility.showVerifiedBadge && ownerMfa && (
                  <span title="Conta protegida com 2FA" className="inline-flex items-center">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">@{profile.username}</div>
              {visibility.showBio && profile.bio && (
                <p data-user-content className="mt-3 text-sm text-foreground">
                  {profile.bio}
                </p>
              )}
              {demoCreator && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  {visibility.showLocation && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                      <MapPin className="h-3.5 w-3.5 text-primary" /> {demoCreator.location}
                    </span>
                  )}
                  {visibility.showAge && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                      <Users className="h-3.5 w-3.5 text-primary" /> {demoCreator.age}{" "}
                      {tr("anos", "years")}
                    </span>
                  )}
                  {visibility.showCategory && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                      <Images className="h-3.5 w-3.5 text-primary" />
                      {locale === "en" ? demoCreator.category_en : demoCreator.category}
                    </span>
                  )}
                  {visibility.showActivityStatus && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                      <Clock3 className="h-3.5 w-3.5 text-primary" />
                      {demoCreator.status === "online"
                        ? tr("Online agora", "Online now")
                        : tr(
                            `Ativa há ${demoCreator.last_active_minutes} min`,
                            `Active ${demoCreator.last_active_minutes} min ago`,
                          )}
                    </span>
                  )}
                  {visibility.showSubscriberCount && (
                    <span className="rounded-lg bg-background/60 px-2.5 py-2">
                      {demoCreator.subscribers_count.toLocaleString(
                        locale === "en" ? "en-US" : "pt-BR",
                      )}{" "}
                      {tr("assinantes", "subscribers")}
                    </span>
                  )}
                  {visibility.showLikeCount && (
                    <span className="rounded-lg bg-background/60 px-2.5 py-2">
                      {demoCreator.likes_count.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}{" "}
                      {tr("curtidas", "likes")}
                    </span>
                  )}
                  {visibility.showPostCount && (
                    <span className="rounded-lg bg-background/60 px-2.5 py-2">
                      {demoCreator.posts_count} posts
                    </span>
                  )}
                  {visibility.showPlans && (
                    <span className="rounded-lg bg-background/60 px-2.5 py-2">
                      R$ {(demoCreator.subscription_price_cents / 100).toFixed(2)}/
                      {tr("mês", "month")}
                    </span>
                  )}
                  {visibility.showRanking && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" /> #{demoCreator.rank}{" "}
                      {tr("no ranking", "in ranking")}
                    </span>
                  )}
                  {visibility.showResponseTime && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
                      <Clock3 className="h-3.5 w-3.5 text-primary" />
                      {tr("Responde em até 2h", "Replies within 2h")}
                    </span>
                  )}
                </div>
              )}
              {demoCreator && visibility.showSocialLinks && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground">
                    <Instagram className="h-3.5 w-3.5" /> Instagram
                  </span>
                  <span className="rounded-full border border-border px-3 py-1.5 text-muted-foreground">
                    TikTok
                  </span>
                </div>
              )}
            </div>
          </div>

          {isMe && !isLeadPreview && <BecomeCreatorBanner />}

          <div className="flex gap-1 rounded-xl bg-card p-1">
            {profileTabs.map((k) => (
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

          {tab === "about" && visibility.showBio ? (
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
                  <PostCard
                    key={p.id}
                    post={p}
                    commentsEnabled={visibility.showComments}
                    previewOnly={isLeadPreview}
                    ownerView={isProfileOwner && !isLeadPreview}
                    onChange={() => void loadProfilePosts()}
                  />
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
                <PostCard
                  key={p.id}
                  post={p}
                  commentsEnabled={visibility.showComments}
                  previewOnly={isLeadPreview}
                  ownerView={isProfileOwner && !isLeadPreview}
                  onChange={() => void loadProfilePosts()}
                />
              ))}
            </div>
          )}
          {profile && (
            <>
              <TipModal
                open={!isLeadPreview && tipOpen}
                onOpenChange={setTipOpen}
                creatorId={profile.user_id}
                creatorName={profile.display_name || profile.username}
              />
              {(!isDemoProfile || isLeadPreview) && (
                <>
                  <SubscribeModal
                    open={subOpen}
                    onOpenChange={setSubOpen}
                    creatorId={profile.user_id}
                    creatorName={profile.display_name || profile.username}
                    basePriceCents={profile.subscription_price_cents ?? 0}
                    previewOnly={isLeadPreview}
                  />
                </>
              )}
              {isDemoProfile && demoCreator && !isLeadPreview && (
                <Dialog
                  open={!isLeadPreview && demoSubscriptionOpen}
                  onOpenChange={setDemoSubscriptionOpen}
                >
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
                      {demoCoupon ? (
                        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-xs text-emerald-700 dark:text-emerald-300">
                              {demoCoupon.code} ·{" "}
                              {couponBenefitLabel(demoCoupon.benefit_type, locale)}
                            </strong>
                            <span className="text-[11px] text-muted-foreground">
                              {couponRemainingSlots(demoCoupon) === null
                                ? tr("Sem limite de vagas", "Unlimited slots")
                                : `${couponRemainingSlots(demoCoupon)} ${tr("vagas restantes", "slots left")}`}
                            </span>
                          </div>
                          <div className="mt-3">
                            {demoCoupon.benefit_type === "trial" ? (
                              <strong className="text-2xl text-primary">
                                {demoCoupon.trial_days} {tr("dias grátis", "free days")}
                              </strong>
                            ) : (
                              <>
                                <span className="mr-2 text-sm text-muted-foreground line-through">
                                  R$ {(demoCoupon.normal_price_cents / 100).toFixed(2)}
                                </span>
                                <strong className="text-2xl text-primary">
                                  R$ {(demoSubscriptionCents / 100).toFixed(2)}
                                </strong>
                              </>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {tr("Depois da oferta:", "After the offer:")}{" "}
                            <strong className="text-foreground">
                              R$ {(demoPostOfferCents / 100).toFixed(2)}/{tr("mês", "month")}
                            </strong>
                          </p>
                          {demoCoupon.benefit_type === "trial" && (
                            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                              {demoCoupon.auto_renew_after_trial
                                ? tr(
                                    "A renovação automática só ocorre quando existir uma autorização válida de cobrança recorrente; Pix avulso nunca será cobrado sozinho.",
                                    "Automatic renewal only happens with valid recurring payment authorization; a one-time PIX is never charged automatically.",
                                  )
                                : tr(
                                    "Ao final do teste, será necessária uma nova confirmação para assinar.",
                                    "At the end of the trial, a new confirmation will be required to subscribe.",
                                  )}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 text-2xl font-bold text-primary">
                          R$ {(demoSubscriptionCents / 100).toFixed(2)}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{tr("mês", "month")}
                          </span>
                        </div>
                      )}
                    </div>
                    {!demoSubscribed && demoCouponIssue && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                        <strong className="block text-foreground">{demoCouponIssue}</strong>
                        <span className="mt-1 block">
                          {tr(
                            "Você ainda pode assinar pelo valor normal exibido acima.",
                            "You can still subscribe at the regular price shown above.",
                          )}
                        </span>
                      </div>
                    )}
                    {!demoSubscribed && !normalizedLinkedCode && (
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          "As promoções são aplicadas automaticamente ao abrir o link divulgado pela modelo; não é necessário digitar código.",
                          "Promotions are applied automatically when opening the link shared by the creator; no code entry is required.",
                        )}
                      </p>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDemoSubscriptionOpen(false)}>
                        {tr("Voltar", "Back")}
                      </Button>
                      <Button
                        variant={demoSubscribed ? "destructive" : "default"}
                        onClick={() => {
                          if (!user) {
                            navigate({ to: "/login" });
                            return;
                          }
                          if (!demoSubscribed && demoCoupon) {
                            let couponRedeemed = false;
                            updateDemoOperations(user.id, (state) => {
                              const currentCoupon = state.coupons.find(
                                (item) => item.id === demoCoupon.id,
                              );
                              if (!currentCoupon) return state;
                              const availability = evaluateCouponAvailability(currentCoupon, {
                                userId: user.id,
                                wasSubscriber: wasDemoSubscriber,
                                isActiveSubscriber: false,
                              });
                              if (!availability.available) return state;
                              couponRedeemed = true;
                              return {
                                ...state,
                                coupons: state.coupons.map((item) =>
                                  item.id === currentCoupon.id
                                    ? {
                                        ...item,
                                        uses: item.uses + 1,
                                        used_by_user_ids: [...item.used_by_user_ids, user.id],
                                      }
                                    : item,
                                ),
                              };
                            });
                            if (!couponRedeemed) {
                              toast.error(
                                tr(
                                  "A oferta acabou antes da confirmação. Nenhuma assinatura foi criada.",
                                  "The offer ended before confirmation. No subscription was created.",
                                ),
                              );
                              return;
                            }
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
                              label:
                                demoCoupon?.benefit_type === "trial"
                                  ? tr("Período de teste", "Trial period")
                                  : tr("Assinatura mensal", "Monthly subscription"),
                              amount_cents: demoSubscriptionCents,
                              coupon_id: demoCoupon?.id,
                              coupon_code: demoCoupon?.code,
                            });
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
                          if (linkedCouponCode) {
                            navigate({
                              to: "/profile/$username",
                              params: { username },
                              search: {},
                              replace: true,
                            });
                          }
                        }}
                      >
                        {demoSubscribed
                          ? tr("Cancelar assinatura", "Cancel subscription")
                          : user
                            ? tr("Confirmar pagamento simulado", "Confirm simulated payment")
                            : tr("Entrar para usar a oferta", "Sign in to use offer")}
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

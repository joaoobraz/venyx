import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Heart,
  MessageCircle,
  DollarSign,
  Lock,
  Loader2,
  Crown,
  Pin,
  PinOff,
  Target,
  Users,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { createPpvPixCharge, createGoalPixCharge } from "@/_server/checkout.functions";
import { getPostMediaUrls } from "@/_server/media.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TipModal } from "@/components/TipModal";
import { PixCheckoutModal, type PixCharge } from "@/components/PixCheckoutModal";
import { CreatorWatermark, type WatermarkPosition } from "@/components/CreatorWatermark";
import { WishlistButton } from "@/components/WishlistButton";
import { LoyaltyBadge } from "@/components/LoyaltyBadge";
import { SafetyMenu } from "@/components/SafetyMenu";
import { TranslateButton } from "@/components/TranslateButton";
import { PostComments } from "@/components/PostComments";
import { togglePostLike } from "@/_server/post-interactions.functions";
import { DEMO_MODE } from "@/lib/demo-creators";
import { recordDemoPurchase } from "@/lib/demo-operations";
import { addDemoNotification } from "@/lib/demo-notifications";
import { awardDemoLoyaltyPoints } from "@/lib/demo-loyalty";
import { previewOnlyMessage } from "@/lib/creator-profile-preview";
import { setPinnedPostForCreator } from "@/lib/post-pinning";
import {
  buildGoalContributionPresets,
  goalRemainingCents,
  parseGoalContributionToCents,
  validateGoalContribution,
} from "@/lib/goal-contributions";

export interface PostMedia {
  id: string;
  storage_path: string;
  mime_type: string;
  position: number;
}

export interface PostGoal {
  target_cents: number;
  raised_cents: number;
  unlock_price_cents: number;
  is_unlocked: boolean;
}

export interface PostWithRelations {
  id: string;
  creator_id: string;
  body: string | null;
  visibility: "public" | "subscribers" | "ppv" | "goal";
  price_cents: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  is_pinned: boolean;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    watermark_position?: string;
    watermark_opacity?: number;
  };
  media: PostMedia[];
  unlocked?: boolean;
  subscribed?: boolean;
  goal?: PostGoal | null;
  goal_contributed?: boolean;
  liked?: boolean;
}

export function PostCard({
  post,
  onChange,
  commentsEnabled = true,
  previewOnly = false,
  ownerView = false,
}: {
  post: PostWithRelations;
  onChange?: () => void;
  commentsEnabled?: boolean;
  previewOnly?: boolean;
  ownerView?: boolean;
}) {
  const { user, session, accountPaused } = useAuth();
  const { t, tr, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [pixTitle, setPixTitle] = useState(() => tr("Pague com Pix", "Pay with Pix"));
  const [demoCheckoutOpen, setDemoCheckoutOpen] = useState(false);
  const [demoCheckoutPurpose, setDemoCheckoutPurpose] = useState<"ppv" | "goal">("ppv");
  const [demoUnlocked, setDemoUnlocked] = useState(Boolean(post.unlocked));
  const [demoGoalContributed, setDemoGoalContributed] = useState(
    Boolean(post.goal_contributed),
  );
  const [goalContributionReais, setGoalContributionReais] = useState(() =>
    post.goal ? (post.goal.unlock_price_cents / 100).toFixed(2) : "",
  );

  const ppvFn = useServerFn(createPpvPixCharge);
  const goalFn = useServerFn(createGoalPixCharge);
  const mediaFn = useServerFn(getPostMediaUrls);
  const likeFn = useServerFn(togglePostLike);
  const isDemoContent = DEMO_MODE && post.creator_id.startsWith("demo-");

  const isOwner = !previewOnly && (ownerView || user?.id === post.creator_id);
  const isPpv = post.visibility === "ppv";
  const isSubsOnly = post.visibility === "subscribers";
  const isGoal = post.visibility === "goal";
  const goalUnlocked =
    isGoal && (post.goal?.is_unlocked || post.goal_contributed || demoGoalContributed);
  const locked =
    !isOwner &&
    ((isPpv && !post.unlocked && !demoUnlocked) ||
      (isSubsOnly && !post.subscribed) ||
      (isGoal && !goalUnlocked));
  const notifyPreviewOnly = () => toast.info(previewOnlyMessage(locale));

  // Pega URLs assinadas para a mídia (só se houver acesso, server decide)
  useEffect(() => {
    let cancel = false;
    if (locked || post.media.length === 0) return;
    const localMedia = post.media.filter((item) =>
      /^(\/|blob:|data:)/.test(item.storage_path),
    );
    if (localMedia.length === post.media.length) {
      setSignedUrls(Object.fromEntries(localMedia.map((item) => [item.id, item.storage_path])));
      return;
    }
    mediaFn({ data: { postId: post.id } })
      .then((res) => {
        if (cancel) return;
        const map: Record<string, string> = {};
        res.urls.forEach((u) => {
          map[u.id] = u.url;
        });
        setSignedUrls(map);
      })
      .catch(() => {
        // silencioso: mídia simplesmente não aparece
      });
    return () => {
      cancel = true;
    };
  }, [post.id, locked, post.media, mediaFn]);

  const authHeaders = () =>
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;

  const togglePinned = async () => {
    if (!user || !isOwner) return;
    setPinBusy(true);
    try {
      const nextPostId = post.is_pinned ? null : post.id;
      await setPinnedPostForCreator({
        viewerId: user.id,
        creatorId: post.creator_id,
        postId: nextPostId,
      });
      toast.success(
        nextPostId
          ? tr("Publicação fixada no perfil.", "Post pinned to the profile.")
          : tr("Publicação desafixada.", "Post unpinned."),
      );
      onChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível alterar o destaque.", "Couldn't update the pinned post."),
      );
    } finally {
      setPinBusy(false);
    }
  };

  useEffect(() => {
    setLikesCount(post.likes_count);
    setCommentsCount(post.comments_count);
    setLiked(Boolean(post.liked));
  }, [post.id, post.likes_count, post.comments_count, post.liked]);

  useEffect(() => {
    setDemoUnlocked(Boolean(post.unlocked));
    setDemoGoalContributed(Boolean(post.goal_contributed));
    setGoalContributionReais(
      post.goal ? (post.goal.unlock_price_cents / 100).toFixed(2) : "",
    );
  }, [post.id, post.unlocked, post.goal, post.goal_contributed]);

  useEffect(() => {
    if (!DEMO_MODE || !user || post.liked) return;
    try {
      const stored = JSON.parse(
        localStorage.getItem(`venyx-demo-liked-posts:${user.id}`) ?? "[]",
      ) as string[];
      if (stored.includes(post.id)) {
        setLiked(true);
        setLikesCount((count) => count + 1);
      }
    } catch {
      // Invalid local demo data is ignored.
    }
  }, [post.id, post.liked, user]);

  const toggleLike = async () => {
    if (previewOnly) {
      notifyPreviewOnly();
      return;
    }
    if (!user) {
      toast.error(tr("Faça login para curtir.", "Sign in to like."));
      return;
    }
    const headers = authHeaders();
    if (!headers || likeBusy) return;

    const previousLiked = liked;
    const previousCount = likesCount;
    const nextLiked = !previousLiked;
    setLikeBusy(true);
    setLiked(nextLiked);
    setLikesCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));

    if (isDemoContent) {
      const key = `venyx-demo-liked-posts:${user.id}`;
      const ids = (() => {
        try {
          return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
        } catch {
          return [] as string[];
        }
      })();
      const nextIds = nextLiked
        ? Array.from(new Set([...ids, post.id]))
        : ids.filter((id) => id !== post.id);
      localStorage.setItem(key, JSON.stringify(nextIds));
      if (nextLiked) {
        awardDemoLoyaltyPoints({
          userId: user.id,
          creatorId: post.creator_id,
          points: 1,
          reason: "post_like",
          label: `Curtida em uma publicação de ${post.author.display_name || post.author.username}`,
          refId: post.id,
        });
      }
      setLikeBusy(false);
      return;
    }

    try {
      const result = await likeFn({ data: { postId: post.id }, headers });
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch (error) {
      if (DEMO_MODE) {
        const key = `venyx-demo-liked-posts:${user.id}`;
        const ids = (() => {
          try {
            return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
          } catch {
            return [] as string[];
          }
        })();
        const nextIds = nextLiked
          ? Array.from(new Set([...ids, post.id]))
          : ids.filter((id) => id !== post.id);
        localStorage.setItem(key, JSON.stringify(nextIds));
      } else {
        setLiked(previousLiked);
        setLikesCount(previousCount);
        toast.error(
          error instanceof Error
            ? error.message
            : tr("Não foi possível atualizar a curtida.", "Couldn't update the like."),
        );
      }
    } finally {
      setLikeBusy(false);
    }
  };

  const unlockPpv = async () => {
    if (previewOnly) {
      notifyPreviewOnly();
      return;
    }
    if (!user) {
      toast.error("Faça login para desbloquear.");
      return;
    }
    if (isDemoContent) {
      setDemoCheckoutPurpose("ppv");
      setDemoCheckoutOpen(true);
      return;
    }
    const headers = authHeaders();
    if (!headers) {
      toast.error("Faça login para desbloquear.");
      return;
    }
    setBusy(true);
    try {
      const res = await ppvFn({ data: { postId: post.id }, headers });
      if ("alreadyUnlocked" in res && res.alreadyUnlocked) {
        toast.success("Já desbloqueado");
        onChange?.();
        return;
      }
      if ("ok" in res && res.ok === false) {
        toast.error(res.error || "Não foi possível gerar o Pix.");
        return;
      }
      if ("chargeId" in res) {
        setPixCharge({
          chargeId: res.chargeId,
          qrCode: res.qrCode,
          qrCodeBase64: res.qrCodeBase64,
          amountCents: res.amountCents,
        });
        setPixTitle(tr("Desbloquear conteúdo", "Unlock content"));
        setPixOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const contributeGoal = async () => {
    if (previewOnly) {
      notifyPreviewOnly();
      return;
    }
    if (!user || !post.goal) return;
    const amountCents = parseGoalContributionToCents(goalContributionReais);
    const remainingCents = goalRemainingCents(
      post.goal.target_cents,
      post.goal.raised_cents,
    );
    const validationError = validateGoalContribution({
      amountCents,
      minimumCents: post.goal.unlock_price_cents,
      remainingCents,
    });
    if (validationError || amountCents === null) {
      toast.error(validationError || "Informe um valor válido.");
      return;
    }
    if (isDemoContent) {
      setDemoCheckoutPurpose("goal");
      setDemoCheckoutOpen(true);
      return;
    }
    const headers = authHeaders();
    if (!headers) {
      toast.error("Faça login para contribuir.");
      return;
    }
    setBusy(true);
    try {
      const res = await goalFn({ data: { postId: post.id, amountCents }, headers });
      if ("ok" in res && res.ok === false) {
        toast.error(res.error || "Não foi possível gerar o Pix.");
        return;
      }
      if ("chargeId" in res) {
        setPixCharge({
          chargeId: res.chargeId,
          qrCode: res.qrCode,
          qrCodeBase64: res.qrCodeBase64,
          amountCents: res.amountCents,
        });
        setPixTitle(tr("Contribuir para a meta", "Contribute to the goal"));
        setPixOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const firstMedia = post.media[0];
  const firstUrl = firstMedia ? signedUrls[firstMedia.id] : "";
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const avatarFull =
    post.author.avatar_url &&
    (post.author.avatar_url.startsWith("http") || post.author.avatar_url.startsWith("/"))
      ? post.author.avatar_url
      : post.author.avatar_url
        ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${post.author.avatar_url}`
        : null;

  // Fallback: use signed media URL when available, otherwise show avatar or placeholder
  const effectiveImageUrl = firstUrl || avatarFull || "/test-images/cover-placeholder.svg";
  const goalPct = post.goal
    ? Math.min(100, Math.round((post.goal.raised_cents / post.goal.target_cents) * 100))
    : 0;
  const goalRemaining = post.goal
    ? goalRemainingCents(post.goal.target_cents, post.goal.raised_cents)
    : 0;
  const selectedGoalAmountCents = parseGoalContributionToCents(goalContributionReais);
  const goalPresets = post.goal
    ? buildGoalContributionPresets({
        minimumCents: post.goal.unlock_price_cents,
        targetCents: post.goal.target_cents,
        raisedCents: post.goal.raised_cents,
      })
    : [];

  if (!visible) return null;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/40 bg-gradient-card shadow-card transition-all duration-300 hover:border-primary/30 hover:shadow-elegant animate-fade-in-up">
      <header className="flex items-center gap-3 p-4">
        <Link
          to="/profile/$username"
          params={{ username: post.author.username }}
          className="h-10 w-10 overflow-hidden rounded-full bg-muted"
        >
          {avatarFull ? (
            <img src={avatarFull} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
              {post.author.username[0]?.toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {post.author.display_name || post.author.username}
            {post.author.is_verified && <Crown className="h-3.5 w-3.5 text-primary" />}
            {!isDemoContent && <LoyaltyBadge creatorId={post.creator_id} className="ml-1" />}
          </div>
          <div className="text-xs text-muted-foreground">@{post.author.username}</div>
        </div>
        {post.is_pinned && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
            <Pin className="h-3 w-3" /> {tr("Fixado", "Pinned")}
          </span>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={togglePinned}
            disabled={pinBusy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label={
              post.is_pinned
                ? tr("Desafixar publicação", "Unpin post")
                : tr("Fixar publicação", "Pin post")
            }
            title={
              post.is_pinned
                ? tr("Desafixar publicação", "Unpin post")
                : tr("Fixar publicação", "Pin post")
            }
          >
            {pinBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : post.is_pinned ? (
              <PinOff className="h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
          </button>
        )}
        {!isOwner && !previewOnly && (
          <WishlistButton
            targetType="post"
            targetId={post.id}
            variant="icon"
            label="Favoritar conteúdo"
          />
        )}
        {!isOwner && !previewOnly && (
          <SafetyMenu
            targetType="post"
            targetId={post.id}
            targetUserId={post.creator_id}
            targetLabel={`@${post.author.username}`}
            onBlocked={() => {
              setVisible(false);
              onChange?.();
            }}
          />
        )}
        {isPpv && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            PPV
          </span>
        )}
        {isSubsOnly && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            VIP
          </span>
        )}
        {isGoal && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
            <Target className="h-3 w-3" /> META
          </span>
        )}
      </header>

      {post.body && (
        <div className="px-4 pb-3">
          <p data-user-content className="text-sm text-foreground whitespace-pre-wrap">
            {post.body}
          </p>
          <TranslateButton text={post.body} />
        </div>
      )}

      {(locked || firstMedia) && <div className="relative">
        {locked ? (
          <div className="aspect-square w-full bg-muted" />
        ) : effectiveImageUrl ? (
          <CreatorWatermark
            username={post.author.username}
            position={(post.author.watermark_position ?? "bottom-right") as WatermarkPosition}
            opacity={post.author.watermark_opacity ?? 0.6}
          >
            {firstMedia && firstMedia.mime_type.startsWith("video/") && firstUrl ? (
              // vídeo real quando houver URL assinada
              <video
                src={firstUrl}
                controls
                className="aspect-square w-full bg-black object-cover"
              />
            ) : effectiveImageUrl ? (
              // imagem do post quando houver, caso contrário usar avatar/placeholder
              <img src={effectiveImageUrl} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CreatorWatermark>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 p-4 backdrop-blur-sm">
            <Lock className="h-8 w-8 text-primary" />
            {isPpv && (
              <Button
                onClick={unlockPpv}
                disabled={busy}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `${t("feed.unlock")} R$ ${(post.price_cents / 100).toFixed(2)}`
                )}
              </Button>
            )}
            {isSubsOnly &&
              (previewOnly ? (
                <Button
                  onClick={notifyPreviewOnly}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t("feed.subscribers")}
                </Button>
              ) : (
                <Link to="/profile/$username" params={{ username: post.author.username }}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {t("feed.subscribers")}
                  </Button>
                </Link>
              ))}
            {isGoal && post.goal && (
              <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/15 bg-black/45 p-3 backdrop-blur-md">
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">
                    {tr("Ajude a liberar este conteúdo", "Help unlock this content")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/70">
                    {tr(
                      "Quem contribuir também recebe acesso.",
                      "Contributors also get access.",
                    )}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-white">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> R$ {(post.goal.raised_cents / 100).toFixed(2)} /
                    R$ {(post.goal.target_cents / 100).toFixed(2)}
                  </span>
                  <span className="font-semibold">{goalPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-white/80">
                    {tr("Escolha um valor", "Choose an amount")}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {goalPresets.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setGoalContributionReais((amount / 100).toFixed(2))}
                        aria-pressed={selectedGoalAmountCents === amount}
                        className={`rounded-lg border px-1.5 py-2 text-[11px] font-semibold transition-colors ${
                          selectedGoalAmountCents === amount
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-white/20 bg-black/30 text-white hover:border-white/40"
                        }`}
                      >
                        R$ {(amount / 100).toFixed(2).replace(".", ",")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      R$
                    </span>
                    <Input
                      aria-label={tr("Outro valor para contribuição", "Custom contribution amount")}
                      type="number"
                      inputMode="decimal"
                      min={post.goal.unlock_price_cents / 100}
                      max={goalRemaining / 100}
                      step="0.50"
                      value={goalContributionReais}
                      onChange={(event) => setGoalContributionReais(event.target.value)}
                      className="border-white/20 bg-black/40 pl-9 text-white"
                    />
                  </div>
                </div>
                <Button
                  onClick={contributeGoal}
                  disabled={busy}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `${tr("Contribuir", "Contribute")} R$ ${(
                      (selectedGoalAmountCents ?? post.goal.unlock_price_cents) / 100
                    )
                      .toFixed(2)
                      .replace(".", ",")}`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
        {post.media.length > 1 && !locked && (
          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            +{post.media.length - 1}
          </div>
        )}
      </div>}

      {/* Barra de meta visível também quando desbloqueado/sem mídia */}
      {isGoal && post.goal && !locked && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3 text-accent" /> Meta{" "}
              {post.goal.is_unlocked ? "atingida" : "em andamento"}
            </span>
            <span>{goalPct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-accent" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      )}

      <footer className="flex items-center gap-4 px-4 py-3 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={toggleLike}
          disabled={likeBusy || previewOnly}
          aria-pressed={liked}
          aria-label={liked ? tr("Remover curtida", "Unlike") : tr("Curtir", "Like")}
          className={`group/btn flex items-center gap-1.5 transition-colors ${liked ? "text-accent" : "hover:text-accent"}`}
        >
          <Heart
            className={`h-4 w-4 transition-transform group-hover/btn:scale-125 ${liked ? "fill-current" : ""}`}
          />{" "}
          {likesCount}
        </button>
        {commentsEnabled && (
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            aria-expanded={commentsOpen}
            aria-label={tr(
              `Abrir comentários (${commentsCount})`,
              `Open comments (${commentsCount})`,
            )}
            className="group/btn flex items-center gap-1.5 transition-colors hover:text-primary"
          >
            <MessageCircle className="h-4 w-4 transition-transform group-hover/btn:scale-110" />{" "}
            {commentsCount}
          </button>
        )}
        <button
          onClick={() => (previewOnly ? notifyPreviewOnly() : setTipOpen(true))}
          disabled={accountPaused}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-glow"
        >
          <DollarSign className="h-3.5 w-3.5" /> {t("feed.tip")}
        </button>
      </footer>
      {commentsEnabled && (
        <PostComments
          postId={post.id}
          creatorId={post.creator_id}
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          commentsCount={commentsCount}
          onCommentsCountChange={setCommentsCount}
          previewOnly={previewOnly}
        />
      )}
      <TipModal
        open={!previewOnly && tipOpen}
        onOpenChange={setTipOpen}
        creatorId={post.creator_id}
        creatorName={post.author.display_name || post.author.username}
        postId={post.id}
      />
      <PixCheckoutModal
        open={!previewOnly && pixOpen}
        onOpenChange={setPixOpen}
        title={pixTitle}
        charge={pixCharge}
        onPaid={() => {
          setPixCharge(null);
          onChange?.();
        }}
      />
      <Dialog open={!previewOnly && demoCheckoutOpen} onOpenChange={setDemoCheckoutOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {demoCheckoutPurpose === "goal"
                ? tr("Contribuir para a meta", "Contribute to the goal")
                : tr("Desbloquear conteúdo PPV", "Unlock PPV content")}
            </DialogTitle>
            <DialogDescription>
              {tr(
                "Pagamento demonstrativo: nenhum Pix ou cobrança real será criado.",
                "Demo payment: no real Pix charge or payment will be created.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="text-sm font-semibold text-foreground">
              {post.author.display_name || post.author.username}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {demoCheckoutPurpose === "goal"
                ? tr("Contribuição para liberar o conteúdo", "Contribution to unlock the content")
                : tr("Conteúdo exclusivo", "Exclusive content")}
            </div>
            <div className="mt-4 text-2xl font-bold text-primary">
              R${" "}
              {(
                (demoCheckoutPurpose === "goal"
                  ? selectedGoalAmountCents ?? post.goal?.unlock_price_cents ?? 0
                  : post.price_cents) / 100
              )
                .toFixed(2)
                .replace(".", ",")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDemoCheckoutOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!user) return;
                if (accountPaused) {
                  toast.info(
                    tr(
                      "Reative sua conta antes de fazer uma compra.",
                      "Reactivate your account before making a purchase.",
                    ),
                  );
                  return;
                }
                const demoAmountCents =
                  demoCheckoutPurpose === "goal"
                    ? selectedGoalAmountCents ?? post.goal?.unlock_price_cents ?? 0
                    : post.price_cents;
                recordDemoPurchase({
                  kind: demoCheckoutPurpose,
                  buyer_id: user.id,
                  creator_id: post.creator_id,
                  creator_name: post.author.display_name || post.author.username,
                  reference_id: post.id,
                  label:
                    demoCheckoutPurpose === "goal"
                      ? tr("Contribuição para meta", "Goal contribution")
                      : tr("Conteúdo PPV", "PPV content"),
                  amount_cents: demoAmountCents,
                });
                addDemoNotification(user.id, {
                  type: "sale",
                  title:
                    demoCheckoutPurpose === "goal"
                      ? "Contribuição confirmada"
                      : "Conteúdo PPV desbloqueado",
                  title_en:
                    demoCheckoutPurpose === "goal"
                      ? "Contribution confirmed"
                      : "PPV content unlocked",
                  body: `${post.author.display_name || post.author.username} · R$ ${(demoAmountCents / 100).toFixed(2)}`,
                  body_en: `${post.author.display_name || post.author.username} · BRL ${(demoAmountCents / 100).toFixed(2)}`,
                  link: "/presentation/wallet",
                });
                if (demoCheckoutPurpose === "goal") {
                  setDemoGoalContributed(true);
                } else {
                  setDemoUnlocked(true);
                }
                setDemoCheckoutOpen(false);
                toast.success(
                  demoCheckoutPurpose === "goal"
                    ? tr(
                        "Contribuição simulada confirmada. Conteúdo liberado!",
                        "Simulated contribution confirmed. Content unlocked!",
                      )
                    : tr(
                        "Pagamento simulado confirmado. Conteúdo liberado!",
                        "Simulated payment confirmed. Content unlocked!",
                      ),
                );
                onChange?.();
              }}
            >
              {tr("Confirmar pagamento simulado", "Confirm simulated payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

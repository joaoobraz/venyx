import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, MessageCircle, DollarSign, Lock, Loader2, Crown, Target, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TipModal } from "@/components/TipModal";

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
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
  media: PostMedia[];
  unlocked?: boolean;
  subscribed?: boolean;
  goal?: PostGoal | null;
  goal_contributed?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function publicUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/posts/${path}`;
}

export function PostCard({ post, onChange }: { post: PostWithRelations; onChange?: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  const isOwner = user?.id === post.creator_id;
  const isPpv = post.visibility === "ppv";
  const isSubsOnly = post.visibility === "subscribers";
  const isGoal = post.visibility === "goal";
  const goalUnlocked = isGoal && (post.goal?.is_unlocked || post.goal_contributed);
  const locked =
    !isOwner &&
    ((isPpv && !post.unlocked) ||
      (isSubsOnly && !post.subscribed) ||
      (isGoal && !goalUnlocked));

  const unlockPpv = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error: te } = await supabase.from("transactions").insert({
        payer_id: user.id,
        payee_id: post.creator_id,
        type: "ppv",
        status: "paid",
        amount_cents: post.price_cents,
        reference_id: post.id,
        gateway: "mock",
      });
      if (te) throw te;

      const { error: ue } = await supabase
        .from("ppv_unlocks")
        .insert({ user_id: user.id, post_id: post.id, amount_cents: post.price_cents });
      if (ue) throw ue;

      toast.success("Conteúdo desbloqueado!");
      onChange?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg.includes("duplicate")) {
        toast.success("Já desbloqueado");
        onChange?.();
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const contributeGoal = async () => {
    if (!user || !post.goal) return;
    setBusy(true);
    try {
      const amount = post.goal.unlock_price_cents;
      const { error: te } = await supabase.from("transactions").insert({
        payer_id: user.id,
        payee_id: post.creator_id,
        type: "ppv",
        status: "paid",
        amount_cents: amount,
        reference_id: post.id,
        gateway: "mock",
        metadata: { kind: "goal_contribution" },
      });
      if (te) throw te;

      const { error: ce } = await supabase
        .from("post_goal_contributions")
        .insert({ user_id: user.id, post_id: post.id, amount_cents: amount });
      if (ce) throw ce;

      toast.success("Você contribuiu para a meta!");
      onChange?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg.includes("duplicate")) {
        toast.info("Você já contribuiu para esta meta");
        onChange?.();
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const firstMedia = post.media[0];
  const goalPct = post.goal
    ? Math.min(100, Math.round((post.goal.raised_cents / post.goal.target_cents) * 100))
    : 0;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/40 bg-gradient-card shadow-card transition-all duration-300 hover:border-primary/30 hover:shadow-elegant animate-fade-in-up">
      <header className="flex items-center gap-3 p-4">
        <Link
          to="/profile/$username"
          params={{ username: post.author.username }}
          className="h-10 w-10 overflow-hidden rounded-full bg-muted"
        >
          {post.author.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" />
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
          </div>
          <div className="text-xs text-muted-foreground">@{post.author.username}</div>
        </div>
        {isPpv && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">PPV</span>
        )}
        {isSubsOnly && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">VIP</span>
        )}
        {isGoal && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
            <Target className="h-3 w-3" /> META
          </span>
        )}
      </header>

      {post.body && <p className="px-4 pb-3 text-sm text-foreground whitespace-pre-wrap">{post.body}</p>}

      {firstMedia && (
        <div className="relative">
          {firstMedia.mime_type.startsWith("video/") ? (
            <video
              src={publicUrl(firstMedia.storage_path)}
              controls={!locked}
              className={`aspect-square w-full bg-black object-cover ${locked ? "blur-2xl scale-110 pointer-events-none" : ""}`}
            />
          ) : (
            <img
              src={publicUrl(firstMedia.storage_path)}
              alt=""
              className={`aspect-square w-full object-cover ${locked ? "blur-2xl scale-110" : ""}`}
            />
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
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `${t("feed.unlock")} R$ ${(post.price_cents / 100).toFixed(2)}`}
                </Button>
              )}
              {isSubsOnly && (
                <Link to="/profile/$username" params={{ username: post.author.username }}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {t("feed.subscribers")}
                  </Button>
                </Link>
              )}
              {isGoal && post.goal && (
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> R$ {(post.goal.raised_cents / 100).toFixed(2)} / R$ {(post.goal.target_cents / 100).toFixed(2)}
                    </span>
                    <span className="font-semibold">{goalPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full bg-accent transition-all" style={{ width: `${goalPct}%` }} />
                  </div>
                  <Button
                    onClick={contributeGoal}
                    disabled={busy}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Contribuir R$ ${(post.goal.unlock_price_cents / 100).toFixed(2)}`}
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
        </div>
      )}

      {/* Barra de meta visível também quando desbloqueado/sem mídia */}
      {isGoal && post.goal && !locked && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3 text-accent" /> Meta {post.goal.is_unlocked ? "atingida" : "em andamento"}
            </span>
            <span>{goalPct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-accent" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      )}

      <footer className="flex items-center gap-4 px-4 py-3 text-sm text-muted-foreground">
        <button className="group/btn flex items-center gap-1.5 transition-colors hover:text-accent">
          <Heart className="h-4 w-4 transition-transform group-hover/btn:scale-125" /> {post.likes_count}
        </button>
        <button className="group/btn flex items-center gap-1.5 transition-colors hover:text-primary">
          <MessageCircle className="h-4 w-4 transition-transform group-hover/btn:scale-110" /> {post.comments_count}
        </button>
        <button
          onClick={() => setTipOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-glow"
        >
          <DollarSign className="h-3.5 w-3.5" /> {t("feed.tip")}
        </button>
      </footer>
      <TipModal
        open={tipOpen}
        onOpenChange={setTipOpen}
        creatorId={post.creator_id}
        creatorName={post.author.display_name || post.author.username}
        postId={post.id}
      />
    </article>
  );
}

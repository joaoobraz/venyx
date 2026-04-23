import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, MessageCircle, DollarSign, Lock, Loader2, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export interface PostMedia {
  id: string;
  storage_path: string;
  mime_type: string;
  position: number;
}

export interface PostWithRelations {
  id: string;
  creator_id: string;
  body: string | null;
  visibility: "public" | "subscribers" | "ppv";
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
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/posts/${path}`;
}

export function PostCard({ post, onChange }: { post: PostWithRelations; onChange?: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [unlocking, setUnlocking] = useState(false);

  const isOwner = user?.id === post.creator_id;
  const isPpv = post.visibility === "ppv";
  const isSubsOnly = post.visibility === "subscribers";
  const locked =
    !isOwner &&
    ((isPpv && !post.unlocked) || (isSubsOnly && !post.subscribed));

  const unlock = async () => {
    if (!user) return;
    setUnlocking(true);
    try {
      // MOCK: cria transação paga + unlock direto.
      // Quando o gateway real for plugado, o webhook é quem cria o unlock.
      const { data: tx, error: te } = await supabase
        .from("transactions")
        .insert({
          payer_id: user.id,
          payee_id: post.creator_id,
          type: "ppv",
          status: "paid",
          amount_cents: post.price_cents,
          reference_id: post.id,
          gateway: "mock",
        })
        .select()
        .single();
      if (te) throw te;

      const { error: ue } = await supabase
        .from("ppv_unlocks")
        .insert({ user_id: user.id, post_id: post.id, amount_cents: post.price_cents });
      if (ue) throw ue;

      toast.success("Conteúdo desbloqueado!");
      onChange?.();
      // Use tx for future ref
      void tx;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg.includes("duplicate")) {
        toast.success("Já desbloqueado");
        onChange?.();
      } else {
        toast.error(msg);
      }
    } finally {
      setUnlocking(false);
    }
  };

  const firstMedia = post.media[0];

  return (
    <article className="overflow-hidden rounded-2xl bg-gradient-card shadow-card">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm">
              <Lock className="h-8 w-8 text-primary" />
              {isPpv ? (
                <Button
                  onClick={unlock}
                  disabled={unlocking}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : `${t("feed.unlock")} R$ ${(post.price_cents / 100).toFixed(2)}`}
                </Button>
              ) : (
                <Link to="/profile/$username" params={{ username: post.author.username }}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {t("feed.subscribers")}
                  </Button>
                </Link>
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

      <footer className="flex items-center gap-4 px-4 py-3 text-sm text-muted-foreground">
        <button className="flex items-center gap-1.5 hover:text-primary">
          <Heart className="h-4 w-4" /> {post.likes_count}
        </button>
        <button className="flex items-center gap-1.5 hover:text-primary">
          <MessageCircle className="h-4 w-4" /> {post.comments_count}
        </button>
        <button className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">
          <DollarSign className="h-3.5 w-3.5" /> {t("feed.tip")}
        </button>
      </footer>
    </article>
  );
}

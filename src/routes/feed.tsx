import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Heart, MessageCircle, DollarSign, Lock, Compass } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
});

interface MockPost {
  id: string;
  author: { name: string; username: string; avatar: string };
  text: string;
  image: string;
  ppvCents?: number;
  subscribersOnly?: boolean;
  likes: number;
  comments: number;
}

const MOCK_POSTS: MockPost[] = [
  {
    id: "1",
    author: { name: "Aline", username: "aline", avatar: "https://i.pravatar.cc/100?img=47" },
    text: "Bom dia, amores 💋 Conteúdo novo no perfil!",
    image: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=900",
    likes: 124,
    comments: 8,
  },
  {
    id: "2",
    author: { name: "Lara", username: "lara", avatar: "https://i.pravatar.cc/100?img=32" },
    text: "Ensaio especial — só para assinantes 🔥",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900",
    subscribersOnly: true,
    likes: 412,
    comments: 22,
  },
  {
    id: "3",
    author: { name: "Bia", username: "bia", avatar: "https://i.pravatar.cc/100?img=20" },
    text: "Vídeo exclusivo PPV 🎬",
    image: "https://images.unsplash.com/photo-1521577352947-9bb58764b69a?w=900",
    ppvCents: 1990,
    likes: 88,
    comments: 4,
  },
];

function FeedPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <BecomeCreatorBanner />
        {MOCK_POSTS.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Compass className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("feed.empty.title")}</p>
          <Link to="/explore" className="mt-3 inline-block">
            <Button size="sm" variant="outline">{t("feed.empty.cta")}</Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function PostCard({ post }: { post: MockPost }) {
  const { t } = useI18n();
  const locked = post.subscribersOnly || post.ppvCents;

  return (
    <article className="overflow-hidden rounded-2xl bg-gradient-card shadow-card">
      <header className="flex items-center gap-3 p-4">
        <Link
          to="/profile/$username"
          params={{ username: post.author.username }}
          className="h-10 w-10 overflow-hidden rounded-full"
        >
          <img src={post.author.avatar} alt="" className="h-full w-full object-cover" />
        </Link>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">{post.author.name}</div>
          <div className="text-xs text-muted-foreground">@{post.author.username}</div>
        </div>
      </header>
      <p className="px-4 pb-3 text-sm text-foreground">{post.text}</p>
      <div className="relative">
        <img
          src={post.image}
          alt=""
          className={`aspect-square w-full object-cover ${locked ? "blur-2xl scale-110" : ""}`}
        />
        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm">
            <Lock className="h-8 w-8 text-primary" />
            {post.ppvCents ? (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                {t("feed.unlock")} R$ {(post.ppvCents / 100).toFixed(2)}
              </Button>
            ) : (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                {t("feed.subscribers")}
              </Button>
            )}
          </div>
        )}
      </div>
      <footer className="flex items-center gap-4 px-4 py-3 text-sm text-muted-foreground">
        <button className="flex items-center gap-1.5 hover:text-primary">
          <Heart className="h-4 w-4" /> {post.likes}
        </button>
        <button className="flex items-center gap-1.5 hover:text-primary">
          <MessageCircle className="h-4 w-4" /> {post.comments}
        </button>
        <button className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">
          <DollarSign className="h-3.5 w-3.5" /> {t("feed.tip")}
        </button>
      </footer>
    </article>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Compass, PenSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";
import { PostCard, type PostWithRelations } from "@/components/PostCard";
import { StoriesBar } from "@/components/StoriesBar";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { TopCreators } from "@/components/TopCreators";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchPosts } from "@/lib/posts";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
});

function FeedPage() {
  const { user, loading, isCreator } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadingPosts(true);
    try {
      const list = await fetchPosts({ viewerId: user.id });
      setPosts(list);
    } finally {
      setLoadingPosts(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <StoriesBar />
        {isCreator && <OnboardingChecklist />}
        <TopCreators limit={10} compact />
        <BecomeCreatorBanner />

        {isCreator && (
          <Link to="/creator/posts">
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
              <PenSquare className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">Criar novo post</span>
            </div>
          </Link>
        )}

        {loadingPosts ? (
          <div className="text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Compass className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("feed.empty.title")}</p>
            <Link to="/explore" className="mt-3 inline-block">
              <Button size="sm" variant="outline">
                {t("feed.empty.cta")}
              </Button>
            </Link>
          </div>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)
        )}
      </div>
    </AppShell>
  );
}


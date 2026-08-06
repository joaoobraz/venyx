import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PostCard, type PostWithRelations } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";
import { demoLocale } from "@/lib/demo-content";
import { fetchPosts } from "@/lib/posts";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/saved/$postId")({
  component: SavedPostPage,
});

export function SavedPostPage() {
  const { postId } = useParams({ strict: false }) as { postId: string };
  const { user } = useAuth();
  const { tr, locale } = useI18n();
  const [post, setPost] = useState<PostWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchPosts({ postId, viewerId: user?.id ?? null, locale: demoLocale(locale) });
      setPost(list[0] ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [postId, user?.id, locale]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/wishlist" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {tr("Voltar para Salvos", "Back to Saved")}
        </Link>

        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !post ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {tr("Este conteúdo não está mais disponível.", "This content is no longer available.")}
          </div>
        ) : (
          <PostCard post={post} onChange={load} />
        )}
      </div>
    </AppShell>
  );
}

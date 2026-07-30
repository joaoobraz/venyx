import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PostCard, type PostWithRelations } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";
import { fetchPosts } from "@/lib/posts";

export const Route = createFileRoute("/saved/$postId")({
  component: SavedPostPage,
});

function SavedPostPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<PostWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchPosts({ postId, viewerId: user?.id ?? null });
      setPost(list[0] ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [postId, user?.id]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/wishlist" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para Salvos
        </Link>

        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !post ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Este conteúdo não está mais disponível.
          </div>
        ) : (
          <PostCard post={post} onChange={load} />
        )}
      </div>
    </AppShell>
  );
}

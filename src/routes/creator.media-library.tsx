import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Images } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { CreatorMediaLibrary } from "@/components/CreatorMediaLibrary";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/creator/media-library")({
  component: CreatorMediaLibraryPage,
});

function CreatorMediaLibraryPage() {
  const { user, isCreator, loading } = useAuth();
  const { tr } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (!isCreator) navigate({ to: "/become-creator" });
  }, [isCreator, loading, navigate, user]);

  if (!user || !isCreator) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Images className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr("Acervo", "Media library")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(
                "Organize fotos e vídeos e reutilize o conteúdo no perfil, nas mensagens e nos PPVs.",
                "Organize photos and videos and reuse content in your profile, messages and PPVs.",
              )}
            </p>
          </div>
        </header>
        <CreatorMediaLibrary userId={user.id} />
      </div>
    </AppShell>
  );
}

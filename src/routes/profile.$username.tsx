import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PostCard, type PostWithRelations } from "@/components/PostCard";
import { fetchPosts } from "@/lib/posts";

export const Route = createFileRoute("/profile/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "media" | "about">("posts");
  const [posts, setPosts] = useState<PostWithRelations[]>([]);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => {
        setProfile((data as Profile) ?? null);
        setLoading(false);
      });
  }, [username]);

  useEffect(() => {
    if (!profile) return;
    fetchPosts({ creatorId: profile.user_id, viewerId: user?.id ?? null }).then(setPosts);
  }, [profile, user?.id]);

  const isMe = user && profile && user.id === profile.user_id;
  const mediaPosts = posts.filter((p) => p.media.length > 0);

  return (
    <AppShell>
      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : !profile ? (
        <div className="text-center text-muted-foreground">404 — perfil não encontrado</div>
      ) : (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl bg-gradient-card shadow-card">
            <div className="h-44 bg-gradient-primary md:h-56">
              {profile.cover_url && (
                <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="relative px-5 pb-5">
              <div className="-mt-12 flex items-end justify-between">
                <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-card bg-muted">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
                      {profile.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                {!isMe && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <MessageCircle className="mr-1.5 h-4 w-4" /> {t("profile.message")}
                    </Button>
                    {profile.subscription_price_cents && profile.subscription_price_cents > 0 ? (
                      <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {t("profile.subscribe")} R$ {(profile.subscription_price_cents / 100).toFixed(2)}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">
                  {profile.display_name || profile.username}
                </h1>
                {profile.is_verified && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </div>
              <div className="text-sm text-muted-foreground">@{profile.username}</div>
              {profile.bio && <p className="mt-3 text-sm text-foreground">{profile.bio}</p>}
            </div>
          </div>

          {isMe && <BecomeCreatorBanner />}

          <div className="flex gap-1 rounded-xl bg-card p-1">
            {(["posts", "media", "about"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`profile.${k}`)}
              </button>
            ))}
          </div>

          {tab === "about" ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {profile.bio ?? "Sem bio"}
            </div>
          ) : tab === "media" ? (
            mediaPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhuma mídia ainda.
              </div>
            ) : (
              <div className="space-y-4">
                {mediaPosts.map((p) => <PostCard key={p.id} post={p} />)}
              </div>
            )
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum post ainda.
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

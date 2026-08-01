import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Heart, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PostCard, type PostWithRelations } from "@/components/PostCard";
import { fetchPosts } from "@/lib/posts";
import { TipModal } from "@/components/TipModal";
import { SubscribeModal } from "@/components/SubscribeModal";
import { SafetyMenu } from "@/components/SafetyMenu";
import { DEMO_MODE, getDemoAsset, getDemoCreator } from "@/lib/demo-creators";

export const Route = createFileRoute("/profile/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "media" | "about">("posts");
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [tipOpen, setTipOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [ownerMfa, setOwnerMfa] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (profile.user_id.startsWith("demo-")) {
      setOwnerMfa(false);
      return;
    }
    supabase
      .from("security_settings")
      .select("mfa_enabled")
      .eq("user_id", profile.user_id)
      .maybeSingle()
      .then(({ data }) => setOwnerMfa(!!(data as { mfa_enabled?: boolean } | null)?.mfa_enabled));
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    const demoCreator = DEMO_MODE ? getDemoCreator(username) : null;
    if (demoCreator) {
      setProfile({
        id: demoCreator.user_id,
        user_id: demoCreator.user_id,
        username: demoCreator.username,
        display_name: demoCreator.display_name,
        bio: null,
        avatar_url: demoCreator.avatar_url,
        cover_url: demoCreator.cover_url,
        is_verified: true,
        subscription_price_cents: 1990,
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
        if (next && DEMO_MODE) {
          const demo = getDemoAsset(next.username);
          setProfile({ ...next, avatar_url: demo.avatar_url, cover_url: demo.cover_url });
        } else {
          setProfile(next);
        }
        setLoading(false);
      });
  }, [username]);

  useEffect(() => {
    if (!profile) return;
    if (profile.user_id.startsWith("demo-")) {
      setPosts([]);
      return;
    }
    fetchPosts({ creatorId: profile.user_id, viewerId: user?.id ?? null }).then(setPosts);
  }, [profile, user?.id]);

  const isMe = user && profile && user.id === profile.user_id;
  const isDemoProfile = profile?.user_id.startsWith("demo-") ?? false;
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
                {!isMe && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDemoProfile}
                      title={isDemoProfile ? t("profile.previewOnly") : undefined}
                      onClick={() => setTipOpen(true)}
                    >
                      <Heart className="mr-1.5 h-4 w-4 text-primary" /> {t("profile.tip")}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/chat" search={isDemoProfile ? {} : { with: profile.user_id }}>
                        <MessageCircle className="mr-1.5 h-4 w-4" /> {t("profile.message")}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      disabled={isDemoProfile}
                      title={isDemoProfile ? t("profile.previewOnly") : undefined}
                      onClick={() => setSubOpen(true)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {t("profile.subscribe")}
                    </Button>
                    <SafetyMenu
                      targetType="profile"
                      targetId={profile.user_id}
                      targetUserId={profile.user_id}
                      targetLabel={`@${profile.username}`}
                      onBlocked={() => navigate({ to: "/explore" })}
                    />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">
                  {profile.display_name || profile.username}
                </h1>
                {profile.is_verified && <CheckCircle2 className="h-5 w-5 text-primary" />}
                {ownerMfa && (
                  <span title="Conta protegida com 2FA" className="inline-flex items-center">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">@{profile.username}</div>
              {profile.bio && <p data-user-content className="mt-3 text-sm text-foreground">{profile.bio}</p>}
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
              {profile.bio ?? (isDemoProfile ? t("profile.previewBio") : t("profile.noBio"))}
            </div>
          ) : tab === "media" ? (
            mediaPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {t("profile.noMedia")}
              </div>
            ) : (
              <div className="space-y-4">
                {mediaPosts.map((p) => <PostCard key={p.id} post={p} />)}
              </div>
            )
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("profile.noPosts")}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          )}
          {profile && (
            <>
              <TipModal
                open={tipOpen}
                onOpenChange={setTipOpen}
                creatorId={profile.user_id}
                creatorName={profile.display_name || profile.username}
              />
              <SubscribeModal
                open={subOpen}
                onOpenChange={setSubOpen}
                creatorId={profile.user_id}
                creatorName={profile.display_name || profile.username}
                basePriceCents={profile.subscription_price_cents ?? 0}
              />
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

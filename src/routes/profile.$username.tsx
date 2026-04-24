import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  MessageCircle,
  Heart,
  ShieldCheck,
  MoreVertical,
  MapPin,
  Images,
  Film,
  Lock,
  ArrowLeft,
} from "lucide-react";
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

export const Route = createFileRoute("/profile/$username")({
  component: ProfilePage,
});

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function ProfilePage() {
  const { username } = Route.useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "media">("posts");
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [tipOpen, setTipOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [ownerMfa, setOwnerMfa] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("security_settings")
      .select("mfa_enabled")
      .eq("user_id", profile.user_id)
      .maybeSingle()
      .then(({ data }) => setOwnerMfa(!!(data as { mfa_enabled?: boolean } | null)?.mfa_enabled));
  }, [profile]);

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

  const isMe = !!(user && profile && user.id === profile.user_id);
  const mediaPosts = useMemo(() => posts.filter((p) => p.media.length > 0), [posts]);

  const stats = useMemo(() => {
    const photos = posts.reduce(
      (acc, p) => acc + p.media.filter((m) => m.mime_type.startsWith("image")).length,
      0,
    );
    const videos = posts.reduce(
      (acc, p) => acc + p.media.filter((m) => m.mime_type.startsWith("video")).length,
      0,
    );
    const ppv = posts.filter((p) => p.visibility === "ppv").length;
    const likes = posts.reduce((acc, p) => acc + (p.likes_count ?? 0), 0);
    return { photos, videos, ppv, likes };
  }, [posts]);

  const bio = profile?.bio ?? "";
  const isLongBio = bio.length > 160;
  const bioToShow = bioExpanded || !isLongBio ? bio : `${bio.slice(0, 160).trimEnd()}…`;
  const subPriceCents = profile?.subscription_price_cents ?? 0;

  return (
    <AppShell>
      {loading ? (
        <div className="py-20 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : !profile ? (
        <div className="py-20 text-center text-muted-foreground">404 — perfil não encontrado</div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Top bar minimalista */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => window.history.back()}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="font-display text-base font-semibold text-foreground">
              {profile.display_name || profile.username}
            </h2>
            <button
              className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Mais opções"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>

          {/* Card principal: capa + avatar + stats + bio + assinatura */}
          <article className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
            {/* Capa */}
            <div className="relative aspect-[3/1] w-full bg-gradient-primary">
              {profile.cover_url && (
                <img
                  src={profile.cover_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>

            {/* Linha avatar + stats */}
            <div className="relative px-5">
              <div className="-mt-12 flex items-end justify-between gap-4">
                {/* Avatar com indicador online */}
                <div className="relative shrink-0">
                  <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-card bg-muted shadow-card">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-primary text-3xl font-bold text-primary-foreground">
                        {profile.username[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span
                    className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card"
                    aria-label="Online"
                  />
                </div>

                {/* Stats compactos à direita */}
                <div className="mb-2 flex items-center gap-4 text-sm text-muted-foreground sm:gap-5">
                  <Stat icon={<Images className="h-4 w-4" />} value={formatCount(stats.photos)} label="fotos" />
                  <Stat icon={<Film className="h-4 w-4" />} value={formatCount(stats.videos)} label="vídeos" />
                  <Stat icon={<Lock className="h-4 w-4" />} value={formatCount(stats.ppv)} label="PPV" />
                  <Stat
                    icon={<Heart className="h-4 w-4 text-primary" />}
                    value={formatCount(stats.likes)}
                    label="likes"
                  />
                </div>
              </div>
            </div>

            {/* Identidade */}
            <div className="px-5 pb-5 pt-4">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-2xl font-bold leading-tight text-foreground">
                  {profile.display_name || profile.username}
                </h1>
                {profile.is_verified && (
                  <CheckCircle2 className="h-5 w-5 fill-primary text-primary-foreground" />
                )}
                {ownerMfa && (
                  <span title="Conta protegida com 2FA" className="ml-0.5 inline-flex">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-primary">@{profile.username}</div>

              {bio && (
                <div className="mt-3 text-sm leading-relaxed text-foreground/90">
                  <p className="whitespace-pre-wrap">{bioToShow}</p>
                  {isLongBio && (
                    <button
                      onClick={() => setBioExpanded((v) => !v)}
                      className="mt-1 text-sm font-medium text-primary hover:underline"
                    >
                      {bioExpanded ? "Ler menos" : "Ler mais"}
                    </button>
                  )}
                </div>
              )}

              {(profile as Profile & { location?: string | null }).location && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{(profile as Profile & { location?: string | null }).location}</span>
                </div>
              )}

              {/* Bloco de Assinatura — só para visitantes */}
              {!isMe && (
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Assinaturas</h3>
                  <button
                    onClick={() => setSubOpen(true)}
                    className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-full bg-gradient-primary px-6 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="relative z-10">
                      {subPriceCents > 0
                        ? `Assinar — R$ ${(subPriceCents / 100).toFixed(2).replace(".", ",")}/mês`
                        : "Gratuito"}
                    </span>
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-10 rounded-full border-border/70 bg-card/50"
                      onClick={() => setTipOpen(true)}
                    >
                      <Heart className="mr-1.5 h-4 w-4 text-primary" />
                      {t("profile.tip")}
                    </Button>
                    <Button variant="outline" className="h-10 rounded-full border-border/70 bg-card/50">
                      <MessageCircle className="mr-1.5 h-4 w-4" />
                      {t("profile.message")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </article>

          {isMe && <BecomeCreatorBanner />}

          {/* Tabs estilo Privacy: cheias, com contagem e indicador inferior */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="grid grid-cols-2">
              <TabButton
                active={tab === "posts"}
                onClick={() => setTab("posts")}
                icon={<Images className="h-4 w-4" />}
                label={`${posts.length} ${posts.length === 1 ? "Postagem" : "Postagens"}`}
              />
              <TabButton
                active={tab === "media"}
                onClick={() => setTab("media")}
                icon={<Film className="h-4 w-4" />}
                label={`${stats.photos + stats.videos} Mídias`}
              />
            </div>
          </div>

          {/* Conteúdo das tabs */}
          {tab === "media" ? (
            mediaPosts.length === 0 ? (
              <EmptyState text="Nenhuma mídia ainda." />
            ) : (
              <div className="space-y-4">
                {mediaPosts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )
          ) : posts.length === 0 ? (
            <EmptyState text="Nenhum post ainda." />
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
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
                basePriceCents={subPriceCents}
              />
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      {icon}
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-gradient-primary transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

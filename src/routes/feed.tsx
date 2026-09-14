import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Compass, PenSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";
import { PostCard, type PostWithRelations } from "@/components/PostCard";
import { StoriesBar } from "@/components/StoriesBar";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { demoLocale } from "@/lib/demo-content";
import { fetchPosts } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { getMyVerificationStatus } from "@/_server/verification.functions";
import { IdentityVerificationModal } from "@/components/IdentityVerificationModal";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
});

export function FeedPage() {
  const { user, loading, isCreator } = useAuth();
  const { t, tr, locale } = useI18n();
  const nav = useNavigate();
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const checkVerifyFn = useServerFn(getMyVerificationStatus);
  const [identityStatus, setIdentityStatus] = useState<"unknown" | "verified" | "pending" | "missing">("unknown");
  const [showVerify, setShowVerify] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    checkVerifyFn()
      .then((result) => {
        if (cancelled) return;
        const status = (result as { verified?: boolean; status?: string | null }).status ?? null;
        if ((result as { verified?: boolean }).verified) setIdentityStatus("verified");
        else if (status === "pending") setIdentityStatus("pending");
        else setIdentityStatus("missing");
      })
      .catch(() => {
        if (!cancelled) setIdentityStatus("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [user, checkVerifyFn]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadingPosts(true);
    try {
      const list = await fetchPosts({ viewerId: user.id, locale: demoLocale(locale) });
      setPosts(list);
    } finally {
      setLoadingPosts(false);
    }
  }, [user, locale]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <StoriesBar />
        {isCreator && <OnboardingChecklist />}
        
        <BecomeCreatorBanner />

        {(identityStatus === "missing" || identityStatus === "pending") && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span className="text-foreground">
                {identityStatus === "pending"
                  ? tr(
                      "Sua verificação de identidade está em análise. O conteúdo aparece assim que for aprovada.",
                      "Your identity verification is under review. Content appears as soon as it is approved.",
                    )
                  : tr(
                      "Confirme que você é maior de 18 anos para ver o conteúdo das criadoras.",
                      "Confirm you are over 18 to see creators' content.",
                    )}
              </span>
            </div>
            {identityStatus === "missing" && (
              <Button size="sm" onClick={() => setShowVerify(true)}>
                {tr("Verificar identidade", "Verify identity")}
              </Button>
            )}
          </div>
        )}
        <IdentityVerificationModal
          open={showVerify}
          onOpenChange={setShowVerify}
          onVerified={() => {
            setIdentityStatus("verified");
            load();
          }}
          onPending={() => setIdentityStatus("pending")}
        />

        {isCreator && (
          <Link to="/creator/posts">
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
              <PenSquare className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {tr("Criar novo post", "Create a new post")}
              </span>
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

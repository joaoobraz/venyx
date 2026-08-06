import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  FileCheck2,
  ImagePlus,
  Loader2,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  acceptCurrentCreatorConsents,
  getCreatorOnboardingStatus,
} from "@/_server/creator-onboarding.functions";

export const Route = createFileRoute("/creator/onboarding")({
  component: CreatorOnboardingPage,
  head: () => ({
    meta: [
      { title: "Configuração da criadora | Fanlira" },
      { name: "description", content: "Etapas para configurar e liberar a monetização." },
    ],
  }),
});

type Status = {
  isCreator: boolean;
  kycApproved: boolean;
  consentComplete: boolean;
  profileComplete: boolean;
  priceConfigured: boolean;
  payoutKeyConfigured: boolean;
  firstPostCreated: boolean;
  monetizationReady: boolean;
};

export function CreatorOnboardingPage() {
  const { tr } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const getStatus = useServerFn(getCreatorOnboardingStatus);
  const acceptConsents = useServerFn(acceptCurrentCreatorConsents);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingConsent, setSavingConsent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [confirmedRights, setConfirmedRights] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, navigate, user]);

  const load = useCallback(async () => {
    try {
      const next = (await getStatus()) as Status;
      if (!next.isCreator) {
        navigate({ to: "/become-creator" });
        return;
      }
      setStatus(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro ao carregar as etapas.", "Could not load setup steps."));
    } finally {
      setLoading(false);
    }
  }, [getStatus, navigate, tr]);

  useEffect(() => {
    if (user) load();
  }, [load, user]);

  const steps = useMemo(
    () => [
      {
        title: "KYC",
        description: tr("Identidade e maioridade aprovadas.", "Identity and age approved."),
        done: status?.kycApproved ?? false,
        href: "/become-creator",
        icon: ShieldCheck,
      },
      {
        title: tr("Consentimentos", "Consents"),
        description: tr("Termos, privacidade e direitos do conteúdo registrados.", "Terms, privacy, and content rights recorded."),
        done: status?.consentComplete ?? false,
        href: null,
        icon: FileCheck2,
      },
      {
        title: tr("Perfil completo", "Complete profile"),
        description: tr("Foto, nome público e biografia com pelo menos 20 caracteres.", "Photo, public name, and a bio of at least 20 characters."),
        done: status?.profileComplete ?? false,
        href: "/settings/profile",
        icon: UserRound,
      },
      {
        title: tr("Preço configurado", "Pricing configured"),
        description: tr("Preço base e planos de assinatura definidos.", "Base price and subscription plans configured."),
        done: status?.priceConfigured ?? false,
        href: "/creator/subscription-plans",
        icon: CircleDollarSign,
      },
      {
        title: tr("Chave de saque", "Payout key"),
        description: tr("Chave PIX e titular cadastrados com 2FA.", "PIX key and account holder registered with 2FA."),
        done: status?.payoutKeyConfigured ?? false,
        href: "/creator/wallet",
        icon: Wallet,
      },
      {
        title: tr("Primeira publicação", "First post"),
        description: tr("Publicação inicial enviada e moderada.", "First post submitted and moderated."),
        done: status?.firstPostCreated ?? false,
        href: "/creator/posts",
        icon: ImagePlus,
      },
    ],
    [status, tr],
  );

  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  const handleConsent = async () => {
    if (!acceptedTerms || !confirmedAdult || !confirmedRights) return;
    setSavingConsent(true);
    try {
      await acceptConsents({
        data: {
          acceptedTerms: true,
          confirmedAdult: true,
          confirmedContentRights: true,
        },
      });
      toast.success(tr("Consentimentos registrados.", "Consents recorded."));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Não foi possível salvar.", "Could not save."));
    } finally {
      setSavingConsent(false);
    }
  };

  if (authLoading || loading || !user) {
    return (
      <AppShell>
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="overflow-hidden">
          <div className="bg-gradient-primary p-6 text-primary-foreground">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                  {tr("Entrada da criadora", "Creator setup")}
                </p>
                <h1 className="mt-1 text-2xl font-bold">
                  {tr("Prepare sua conta para monetizar", "Prepare your account for monetization")}
                </h1>
              </div>
              <Badge className="border-white/30 bg-white/15 text-white">
                {completed}/{steps.length} {tr("etapas", "steps")}
              </Badge>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/15">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="p-5">
            {status?.monetizationReady ? (
              <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-foreground">{tr("Monetização liberada", "Monetization enabled")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tr("Sua conta atende aos requisitos obrigatórios. Complete a primeira publicação se ainda estiver pendente.", "Your account meets the mandatory requirements. Complete your first post if it is still pending.")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-sm text-muted-foreground">
                  {tr("Conteúdo público pode ser preparado, mas assinatura, PPV, mimo e conteúdo exclusivo ficam bloqueados até KYC, consentimentos, perfil e chave PIX estarem completos.", "Public content can be prepared, but subscriptions, PPV, tips, and exclusive content remain blocked until KYC, consents, profile, and PIX key are complete.")}
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={step.title} className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${step.done ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    {step.done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{index + 1}. {step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  {step.href && !step.done && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={step.href as never}>
                        {tr("Abrir", "Open")} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>

                {step.title === tr("Consentimentos", "Consents") && !step.done && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <ConsentCheck checked={acceptedTerms} onChange={setAcceptedTerms}>
                      {tr("Li e aceito os Termos e a Política de Privacidade vigentes.", "I have read and accept the current Terms and Privacy Policy.")}
                    </ConsentCheck>
                    <ConsentCheck checked={confirmedAdult} onChange={setConfirmedAdult}>
                      {tr("Confirmo que tenho 18 anos ou mais.", "I confirm that I am at least 18 years old.")}
                    </ConsentCheck>
                    <ConsentCheck checked={confirmedRights} onChange={setConfirmedRights}>
                      {tr("Confirmo que possuo autorização e consentimento verificável de todas as pessoas retratadas.", "I confirm I hold verifiable authorization and consent from every person depicted.")}
                    </ConsentCheck>
                    <Button
                      size="sm"
                      onClick={handleConsent}
                      disabled={savingConsent || !acceptedTerms || !confirmedAdult || !confirmedRights}
                    >
                      {savingConsent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {tr("Registrar consentimentos", "Record consents")}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function ConsentCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[oklch(0.72_0.19_47)]"
      />
      <span>{children}</span>
    </label>
  );
}

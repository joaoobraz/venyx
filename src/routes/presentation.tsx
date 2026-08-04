import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  CreditCard,
  CircleDollarSign,
  FileWarning,
  Heart,
  Gift,
  IdCard,
  Images,
  LayoutDashboard,
  Link2,
  Mail,
  MessageCircle,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Tags,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreatorOperations } from "@/components/presentation/CreatorOperations";
import { CreatorMediaLibrary } from "@/components/CreatorMediaLibrary";
import { CreatorLoyaltyOperations } from "@/components/presentation/CreatorLoyaltyOperations";
import { ModeratorOperations } from "@/components/presentation/ModeratorOperations";
import { useAuth, type DemoPreviewRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useUnreadCounts } from "@/lib/use-unread-counts";
import { DEMO_SUBSCRIPTIONS_CHANGED_EVENT, getDemoSubscriptionCreators } from "@/lib/demo-content";
import {
  DEMO_OPERATIONS_CHANGED_EVENT,
  readDemoOperations,
  resetDemoExperience,
} from "@/lib/demo-operations";

export const Route = createFileRoute("/presentation")({
  validateSearch: (search: Record<string, unknown>): { section?: string } => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  component: PresentationIndexPage,
});

function PresentationIndexPage() {
  const { section: searchSection = "overview" } = Route.useSearch();
  const params = useParams({ strict: false }) as { section?: string };
  return <PresentationPage section={params.section ?? searchSection} />;
}

type Section = {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  icon: typeof LayoutDashboard;
  value: string;
};

const CREATOR_SECTIONS: Section[] = [
  {
    id: "overview",
    label: "Visão geral",
    labelEn: "Overview",
    description: "Desempenho consolidado no período selecionado.",
    descriptionEn: "Consolidated performance for the selected period.",
    icon: LayoutDashboard,
    value: "R$ 18.740",
  },
  {
    id: "posts",
    label: "Publicações",
    labelEn: "Posts",
    description: "Conteúdos publicados e agendados.",
    descriptionEn: "Published and scheduled content.",
    icon: BookOpenCheck,
    value: "42",
  },
  {
    id: "media-library",
    label: "Acervo",
    labelEn: "Media library",
    description: "Fotos, vídeos, PPVs reutilizáveis e coleções.",
    descriptionEn: "Photos, videos, reusable PPVs and collections.",
    icon: Images,
    value: "8",
  },
  {
    id: "analytics",
    label: "Métricas",
    labelEn: "Analytics",
    description: "Faturamento, audiência, vendas e conversão por período.",
    descriptionEn: "Revenue, audience, sales, and conversion by period.",
    icon: BarChart3,
    value: "+12,8%",
  },
  {
    id: "wallet",
    label: "Carteira",
    labelEn: "Wallet",
    description: "Saldo disponível e recebimentos previstos.",
    descriptionEn: "Available balance and expected payouts.",
    icon: Wallet,
    value: "R$ 7.480",
  },
  {
    id: "subscriptions",
    label: "Assinaturas",
    labelEn: "Subscriptions",
    description: "Planos e base recorrente ativa.",
    descriptionEn: "Plans and active recurring audience.",
    icon: CreditCard,
    value: "326",
  },
  {
    id: "links",
    label: "Venyx Links",
    labelEn: "Venyx Links",
    description: "Mini perfil e desempenho dos links compartilhados.",
    descriptionEn: "Mini profile and shared-link performance.",
    icon: Link2,
    value: "1.842",
  },
  {
    id: "gifts",
    label: "Lista de Mimos",
    labelEn: "Gift List",
    description: "Catálogo simbólico escolhido pela modelo.",
    descriptionEn: "Symbolic catalog selected by the creator.",
    icon: Gift,
    value: "32",
  },
  {
    id: "mailing",
    label: "Mailing",
    labelEn: "Mailing",
    description: "Campanhas preparadas sem envio externo.",
    descriptionEn: "Prepared campaigns with no external delivery.",
    icon: Mail,
    value: "3",
  },
  {
    id: "coupons",
    label: "Cupons",
    labelEn: "Coupons",
    description: "Ofertas ativas e conversões atribuídas.",
    descriptionEn: "Active offers and attributed conversions.",
    icon: Tags,
    value: "8,4%",
  },
  {
    id: "loyalty",
    label: "Fidelidade",
    labelEn: "Loyalty",
    description: "Níveis, benefícios, fãs e segmentos para PPV.",
    descriptionEn: "Tiers, benefits, fans and PPV segments.",
    icon: Trophy,
    value: "327",
  },
  {
    id: "moderation",
    label: "Moderação própria",
    labelEn: "Creator moderation",
    description: "Comentários e regras sob controle da criadora.",
    descriptionEn: "Comments and rules controlled by the creator.",
    icon: ShieldCheck,
    value: "2",
  },
];

const MODERATOR_SECTIONS: Section[] = [
  {
    id: "overview",
    label: "Visão geral",
    labelEn: "Overview",
    description: "Resumo das filas operacionais.",
    descriptionEn: "Operational queue overview.",
    icon: LayoutDashboard,
    value: "24",
  },
  {
    id: "reports",
    label: "Denúncias",
    labelEn: "Reports",
    description: "Itens aguardando análise inicial.",
    descriptionEn: "Items awaiting initial review.",
    icon: FileWarning,
    value: "7",
  },
  {
    id: "users",
    label: "Usuários",
    labelEn: "Users",
    description: "Contas sob acompanhamento preventivo.",
    descriptionEn: "Accounts under preventive monitoring.",
    icon: Users,
    value: "5",
  },
  {
    id: "kyc",
    label: "KYC",
    labelEn: "KYC",
    description: "Verificações aguardando revisão.",
    descriptionEn: "Identity checks awaiting review.",
    icon: IdCard,
    value: "4",
  },
  {
    id: "dmca",
    label: "DMCA",
    labelEn: "DMCA",
    description: "Solicitações dentro do prazo operacional.",
    descriptionEn: "Requests within the operational deadline.",
    icon: ReceiptText,
    value: "2",
  },
  {
    id: "reconciliation",
    label: "Conciliação PIX",
    labelEn: "PIX reconciliation",
    description: "Cobranças pendentes e divergências financeiras.",
    descriptionEn: "Pending charges and financial mismatches.",
    icon: CircleDollarSign,
    value: "2",
  },
  {
    id: "audit",
    label: "Auditoria",
    labelEn: "Audit",
    description: "Eventos recentes de acesso e ação.",
    descriptionEn: "Recent access and action events.",
    icon: BookOpenCheck,
    value: "186",
  },
  {
    id: "moderation",
    label: "Moderação",
    labelEn: "Moderation",
    description: "Conteúdos em revisão humana.",
    descriptionEn: "Content under human review.",
    icon: ShieldCheck,
    value: "6",
  },
];

function roleLabel(role: DemoPreviewRole, locale: "pt-BR" | "en") {
  if (role === "creator") return locale === "en" ? "Creator" : "Modelo";
  if (role === "admin") return locale === "en" ? "Administrator" : "Administrador";
  return locale === "en" ? "Client" : "Cliente";
}

export function PresentationPage({ section = "overview" }: { section?: string }) {
  const { user, loading, canUseDemoPreview, demoPreviewRole, setDemoPreviewRole } = useAuth();
  const { tr, locale } = useI18n();
  const navigate = useNavigate();
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !canUseDemoPreview || !demoPreviewRole)) {
      navigate({ to: user ? "/feed" : "/login", replace: true });
    }
  }, [canUseDemoPreview, demoPreviewRole, loading, navigate, user]);

  if (loading || !user || !canUseDemoPreview || !demoPreviewRole) return null;

  const activeRole = demoPreviewRole;
  const sections = activeRole === "creator" ? CREATOR_SECTIONS : MODERATOR_SECTIONS;
  const selected = sections.find((item) => item.id === section) ?? sections[0];
  const SelectedIcon = selected.icon;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {tr("Visão ativa", "Active view")}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              {roleLabel(activeRole, locale)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(
                "Os dados desta área ficam somente neste navegador. Operações reais continuam protegidas.",
                "Data in this area stays in this browser. Real operations remain protected.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {tr("Restaurar demonstração", "Reset demo")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDemoPreviewRole(null);
                navigate({ to: "/feed" });
              }}
            >
              {tr("Voltar ao site normal", "Return to regular website")}
            </Button>
          </div>
        </header>

        {activeRole === "subscriber" ? (
          <ClientView userId={user.id} />
        ) : (
          <>
            {selected.id === "overview" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.id} to="/presentation/$section" params={{ section: item.id }}>
                      <Card
                        className={`h-full p-4 transition hover:border-primary/50 ${
                          selected.id === item.id ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <strong className="text-xl text-foreground">{item.value}</strong>
                        </div>
                        <h2 className="mt-3 font-semibold text-foreground">
                          {locale === "en" ? item.labelEn : item.label}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {locale === "en" ? item.descriptionEn : item.description}
                        </p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <SelectedIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {locale === "en" ? selected.labelEn : selected.label}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {locale === "en" ? selected.descriptionEn : selected.description}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {tr("Simulação local ativa", "Local simulation active")}
                </span>
              </div>
              {activeRole === "creator" && selected.id === "media-library" ? (
                <div className="mt-5">
                  <CreatorMediaLibrary userId={user.id} />
                </div>
              ) : activeRole === "creator" && selected.id === "loyalty" ? (
                <CreatorLoyaltyOperations userId={user.id} />
              ) : activeRole === "creator" ? (
                <CreatorOperations section={selected.id} userId={user.id} />
              ) : (
                <ModeratorOperations section={selected.id} userId={user.id} />
              )}
            </section>
          </>
        )}
      </div>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Restaurar demonstração?", "Reset the demo?")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Mensagens, mimos, compras, assinaturas e decisões locais voltarão ao cenário inicial. Seu login e o modo selecionado serão mantidos.",
                "Messages, tips, purchases, subscriptions and local decisions will return to the initial scenario. Your login and selected role will be kept.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetDemoExperience(user.id);
                window.location.assign("/presentation/overview");
              }}
            >
              {tr("Restaurar agora", "Reset now")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ClientView({ userId }: { userId: string }) {
  const { tr } = useI18n();
  const unread = useUnreadCounts();
  const [subscriptions, setSubscriptions] = useState(() => getDemoSubscriptionCreators(userId));
  const [purchases, setPurchases] = useState(() => readDemoOperations(userId).purchases);

  useEffect(() => {
    const load = () => {
      setSubscriptions(getDemoSubscriptionCreators(userId));
      setPurchases(readDemoOperations(userId).purchases);
    };
    load();
    window.addEventListener(DEMO_SUBSCRIPTIONS_CHANGED_EVENT, load);
    window.addEventListener(DEMO_OPERATIONS_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener(DEMO_SUBSCRIPTIONS_CHANGED_EVENT, load);
      window.removeEventListener(DEMO_OPERATIONS_CHANGED_EVENT, load);
    };
  }, [userId]);
  const cards = [
    {
      label: tr("Assinaturas ativas", "Active subscriptions"),
      value: subscriptions.length,
      icon: CreditCard,
      to: "/explore",
    },
    {
      label: tr("Mensagens não lidas", "Unread messages"),
      value: unread.messages,
      icon: MessageCircle,
      to: "/chat",
    },
    {
      label: tr("Notificações", "Notifications"),
      value: unread.notifications,
      icon: Bell,
      to: "/notifications",
    },
    { label: tr("Itens salvos", "Saved items"), value: 4, icon: Heart, to: "/wishlist" },
  ] as const;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} to={item.to}>
              <Card className="h-full p-4 transition hover:border-primary/50">
                <Icon className="h-5 w-5 text-primary" />
                <div className="mt-3 text-2xl font-bold text-foreground">{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </Card>
            </Link>
          );
        })}
      </div>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-bold text-foreground">{tr("Assinaturas", "Subscriptions")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {subscriptions.map((item) => (
            <Link
              key={item.user_id}
              to="/profile/$username"
              params={{ username: item.username }}
              className="flex items-center gap-3 rounded-xl bg-background p-3"
            >
              <img src={item.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">{item.display_name}</div>
                <div className="text-xs text-muted-foreground">@{item.username}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      {purchases.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-bold text-foreground">
            {tr("Compras e comprovantes", "Purchases and receipts")}
          </h2>
          <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-background px-4">
            {purchases.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {item.creator_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.label} · {tr("Pagamento local confirmado", "Local payment confirmed")}
                  </div>
                </div>
                <strong className="shrink-0 text-sm text-primary">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    item.amount_cents / 100,
                  )}
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/feed" icon={BookOpenCheck} label={tr("Abrir feed", "Open feed")} />
        <QuickLink
          to="/explore"
          icon={ShoppingBag}
          label={tr("Explorar perfis", "Explore profiles")}
        />
        <QuickLink to="/chat" icon={MessageCircle} label={tr("Abrir mensagens", "Open messages")} />
        <QuickLink to="/wishlist" icon={Heart} label={tr("Abrir favoritos", "Open favorites")} />
      </div>
    </>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: typeof Heart; label: string }) {
  return (
    <Link
      to={to as never}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 font-medium text-foreground hover:border-primary/50"
    >
      <Icon className="h-5 w-5 text-primary" /> {label}
    </Link>
  );
}

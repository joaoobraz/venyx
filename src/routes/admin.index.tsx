import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  Users,
  FileWarning,
  Banknote,
  Eye,
  UserCog,
  Store,
  Crown,
  Loader2,
  Flag,
  CircleDollarSign,
  Headphones,
  Activity,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import {
  requireAdminServer,
} from "@/_server/admin.functions";
import { adminDashboardStats } from "@/_server/admin-users.functions";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  head: () => ({
    meta: [
      { title: "Painel Admin" },
      { name: "description", content: "Painel administrativo" },
    ],
  }),
  component: AdminHomePage,
});

type Stats = {
  totalUsers: number;
  totalCreators: number;
  totalSellers: number;
  pendingKyc: number;
  pendingDmca: number;
  pendingWithdrawals: number;
};

function AdminHomePage() {
  const { tr } = useI18n();
  const getStats = useServerFn(adminDashboardStats);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then((s) => setStats(s))
      .finally(() => setLoading(false));
  }, [getStats]);

  const cards = [
    {
      title: tr("KYC pendentes", "Pending KYC"),
      value: stats?.pendingKyc ?? 0,
      icon: ShieldCheck,
      link: "/admin/kyc",
      tone: "amber",
    },
    {
      title: tr("Saques pendentes", "Pending payouts"),
      value: stats?.pendingWithdrawals ?? 0,
      icon: Banknote,
      link: "/admin/payouts",
      tone: "amber",
    },
    {
      title: tr("Denúncias DMCA", "DMCA reports"),
      value: stats?.pendingDmca ?? 0,
      icon: FileWarning,
      link: "/admin/dmca",
      tone: "rose",
    },
    {
      title: tr("Moderação", "Moderation"),
      value: "—",
      icon: Eye,
      link: "/admin/moderation",
      tone: "muted",
    },
  ] as const;

  const sections = [
    {
      title: tr("Usuários & Cargos", "Users & Roles"),
      description:
        tr("Gerenciar usuários, atribuir cargos (Seller, Creator, Admin, Embaixadora).", "Manage users and assign Seller, Creator, Admin and Ambassador roles."),
      icon: UserCog,
      link: "/admin/users",
    },
    {
      title: "KYC",
      description: tr("Aprovar ou rejeitar verificações de identidade.", "Approve or reject identity checks."),
      icon: ShieldCheck,
      link: "/admin/kyc",
    },
    {
      title: tr("Saques", "Payouts"),
      description: tr("Aprovar, marcar como pago ou rejeitar saques de criadoras.", "Approve, pay or reject creator payouts."),
      icon: Banknote,
      link: "/admin/payouts",
    },
    {
      title: "DMCA",
      description: tr("Revisar denúncias de conteúdo vazado.", "Review leaked-content reports."),
      icon: FileWarning,
      link: "/admin/dmca",
    },
    {
      title: tr("Denúncias de usuários", "User reports"),
      description: tr("Revisar denúncias de posts, perfis, mensagens e conversas.", "Review reports about posts, profiles, messages and conversations."),
      icon: Flag,
      link: "/admin/reports",
    },
    {
      title: tr("Moderação", "Moderation"),
      description: tr("Revisar mídias sinalizadas pela moderação automática.", "Review media flagged by automated moderation."),
      icon: Eye,
      link: "/admin/moderation",
    },
    {
      title: tr("Auditoria de acessos", "Access audit"),
      description: tr("Tentativas de acesso (negadas e liberadas) às rotas /admin com IP.", "Allowed and denied access attempts to /admin routes, including IP."),
      icon: ShieldCheck,
      link: "/admin/audit",
    },
    {
      title: tr("Auditoria de ações", "Action audit"),
      description: tr("Histórico de aprovações de KYC, atualizações de DMCA e atribuições de cargos.", "History of KYC decisions, DMCA updates and role assignments."),
      icon: ShieldCheck,
      link: "/admin/actions-audit",
    },
    {
      title: tr("Conciliação financeira", "Financial reconciliation"),
      description: tr(
        "Conferir cobranças PIX pendentes, recuperar entregas e tratar divergências da NexusPag.",
        "Check pending PIX charges, recover deliveries, and review NexusPag mismatches.",
      ),
      icon: CircleDollarSign,
      link: "/admin/reconciliation",
    },
    {
      title: tr("Central de atendimento", "Service desk"),
      description: tr(
        "Acompanhar chamados, recuperação de conta e solicitações de privacidade.",
        "Track tickets, account recovery, and privacy requests.",
      ),
      icon: Headphones,
      link: "/admin/support",
    },
    {
      title: tr("Operação & estabilidade", "Operations & reliability"),
      description: tr(
        "Acompanhar funil, erros, alertas, SLA e evidências de restauração.",
        "Track funnel, errors, alerts, SLA, and restore evidence.",
      ),
      icon: Activity,
      link: "/admin/operations",
    },
  ];

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-primary" />
              {tr("Painel Admin", "Admin Dashboard")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {tr("Visão geral e atalhos para todas as áreas administrativas.", "Overview and shortcuts to every administrative area.")}
            </p>
          </div>
        </div>

        {/* Stats top row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label={tr("Usuários", "Users")}
            value={stats?.totalUsers ?? 0}
            icon={Users}
            loading={loading}
          />
          <StatCard
            label={tr("Criadoras", "Creators")}
            value={stats?.totalCreators ?? 0}
            icon={Crown}
            loading={loading}
          />
          <StatCard
            label="Sellers"
            value={stats?.totalSellers ?? 0}
            icon={Store}
            loading={loading}
          />
        </div>

        {/* Pending alerts */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{tr("Pendências", "Pending items")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((c) => (
              <Link key={c.link} to={c.link}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <c.icon className="h-5 w-5 text-muted-foreground" />
                    {typeof c.value === "number" && c.value > 0 && (
                      <Badge variant="destructive">{c.value}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">{c.title}</p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? "…" : c.value}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Sections grid */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{tr("Áreas administrativas", "Administrative areas")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.map((s) => (
              <Link key={s.link} to={s.link}>
                <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <s.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{s.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-bold mt-2">
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : value}
      </p>
    </Card>
  );
}

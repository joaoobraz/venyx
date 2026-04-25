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
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  requireAdminServer,
} from "@/server/admin.functions";
import { adminDashboardStats } from "@/server/admin-users.functions";

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
      title: "KYC pendentes",
      value: stats?.pendingKyc ?? 0,
      icon: ShieldCheck,
      link: "/admin/kyc",
      tone: "amber",
    },
    {
      title: "Saques pendentes",
      value: stats?.pendingWithdrawals ?? 0,
      icon: Banknote,
      link: "/admin/payouts",
      tone: "amber",
    },
    {
      title: "Denúncias DMCA",
      value: stats?.pendingDmca ?? 0,
      icon: FileWarning,
      link: "/admin/dmca",
      tone: "rose",
    },
    {
      title: "Moderação",
      value: "—",
      icon: Eye,
      link: "/admin/moderation",
      tone: "muted",
    },
  ] as const;

  const sections = [
    {
      title: "Usuários & Cargos",
      description:
        "Gerenciar usuários, atribuir cargos (Seller, Creator, Admin, Embaixadora).",
      icon: UserCog,
      link: "/admin/users",
    },
    {
      title: "KYC",
      description: "Aprovar ou rejeitar verificações de identidade.",
      icon: ShieldCheck,
      link: "/admin/kyc",
    },
    {
      title: "Saques",
      description: "Aprovar, marcar como pago ou rejeitar saques de criadoras.",
      icon: Banknote,
      link: "/admin/payouts",
    },
    {
      title: "DMCA",
      description: "Revisar denúncias de conteúdo vazado.",
      icon: FileWarning,
      link: "/admin/dmca",
    },
    {
      title: "Moderação",
      description: "Revisar mídias sinalizadas pela moderação automática.",
      icon: Eye,
      link: "/admin/moderation",
    },
    {
      title: "Auditoria de acessos",
      description: "Tentativas de acesso (negadas e liberadas) às rotas /admin com IP.",
      icon: ShieldCheck,
      link: "/admin/audit",
    },
  ];

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              Painel Admin
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão geral e atalhos para todas as áreas administrativas.
            </p>
          </div>
        </div>

        {/* Stats top row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Usuários"
            value={stats?.totalUsers ?? 0}
            icon={Users}
            loading={loading}
          />
          <StatCard
            label="Criadoras"
            value={stats?.totalCreators ?? 0}
            icon={Sparkles}
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
          <h2 className="text-lg font-semibold mb-3">Pendências</h2>
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
          <h2 className="text-lg font-semibold mb-3">Áreas administrativas</h2>
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

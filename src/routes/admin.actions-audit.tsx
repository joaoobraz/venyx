import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdminServer, listAdminActionsAudit } from "@/_server/admin.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/actions-audit")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/actions-audit" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  head: () => ({
    meta: [
      { title: "Auditoria de ações admin" },
      {
        name: "description",
        content: "Histórico de ações administrativas: KYC, DMCA e atribuição de cargos.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminActionsAuditPage,
});

type Row = {
  id: string;
  admin_id: string;
  admin_username: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  target_user_id: string | null;
  target_username: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const FILTERS: { pt: string; en: string; value: string | null }[] = [
  { pt: "Todas", en: "All", value: null },
  { pt: "KYC aprovados", en: "Approved KYC", value: "kyc_approved" },
  { pt: "KYC rejeitados", en: "Rejected KYC", value: "kyc_rejected" },
  { pt: "Cargos adicionados", en: "Roles added", value: "role_added" },
  { pt: "Cargos removidos", en: "Roles removed", value: "role_removed" },
  { pt: "DMCA notificados", en: "DMCA notices sent", value: "dmca_notified" },
  { pt: "DMCA resolvidos", en: "Resolved DMCA", value: "dmca_resolved" },
  { pt: "DMCA rejeitados", en: "Rejected DMCA", value: "dmca_rejected" },
];

function badgeVariant(action: string): "default" | "destructive" | "secondary" {
  if (action.endsWith("_approved") || action === "role_added") return "default";
  if (action.endsWith("_rejected") || action === "role_removed") return "destructive";
  return "secondary";
}

export function AdminActionsAuditPage() {
  const { locale, tr } = useI18n();
  const list = useServerFn(listAdminActionsAudit);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await list({
        data: filter ? { actionType: filter } : {},
      });
      setRows(Array.isArray(res?.rows) ? (res.rows as Row[]) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-primary" />
            {tr("Auditoria de ações administrativas", "Admin actions audit")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr(
              "Histórico de aprovações de KYC, atualizações de DMCA e atribuições de cargos (últimos 200 registros).",
              "KYC approvals, DMCA updates and role assignments (latest 200 records).",
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value ?? "all"}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {tr(f.pt, f.en)}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {tr(
              "Nenhuma ação registrada para este filtro.",
              "No actions recorded for this filter.",
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{tr("Quando", "When")}</th>
                    <th className="px-4 py-3 font-semibold">{tr("Ação", "Action")}</th>
                    <th className="px-4 py-3 font-semibold">Admin</th>
                    <th className="px-4 py-3 font-semibold">{tr("Alvo", "Target")}</th>
                    <th className="px-4 py-3 font-semibold">{tr("Detalhes", "Details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/40 align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString(locale)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant(r.action_type)}>{r.action_type}</Badge>
                        <div className="text-xs text-muted-foreground mt-1">{r.target_type}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.admin_username ?? "—"}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {r.admin_id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.target_username ?? "—"}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {r.target_user_id ?? r.target_id ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-sm">
                        <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
                          {JSON.stringify(r.metadata, null, 0)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, ShieldOff, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requireAdminServer } from "@/_server/admin.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/audit")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/audit" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  head: () => ({
    meta: [
      { title: "Auditoria de acessos admin" },
      { name: "description", content: "Tentativas de acesso a rotas administrativas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAuditPage,
});

type Row = {
  id: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  path: string | null;
  granted: boolean;
  reason: string | null;
  created_at: string;
};

function AdminAuditPage() {
  const { locale, tr } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "denied" | "granted">("denied");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("admin_access_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "denied") q = q.eq("granted", false);
    if (filter === "granted") q = q.eq("granted", true);
    const { data } = await q;
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            {tr("Auditoria de acessos administrativos", "Admin access audit")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr(
              "Tentativas de acesso às rotas /admin (últimos 200 registros).",
              "Access attempts to /admin routes (latest 200 records).",
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "denied" ? "default" : "outline"}
            onClick={() => setFilter("denied")}
          >
            {tr("Negados", "Denied")}
          </Button>
          <Button
            size="sm"
            variant={filter === "granted" ? "default" : "outline"}
            onClick={() => setFilter("granted")}
          >
            {tr("Liberados", "Granted")}
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            {tr("Todos", "All")}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {tr("Nenhum registro encontrado.", "No records found.")}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">{tr("Quando", "When")}</th>
                    <th className="px-4 py-3 font-semibold">User ID</th>
                    <th className="px-4 py-3 font-semibold">{tr("Rota", "Route")}</th>
                    <th className="px-4 py-3 font-semibold">IP</th>
                    <th className="px-4 py-3 font-semibold">User-Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="px-4 py-3">
                        {r.granted ? (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" /> {tr("liberado", "granted")}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldOff className="h-3 w-3" /> {tr("negado", "denied")}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString(locale)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{r.user_id ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.path ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.ip_address ?? "—"}</td>
                      <td
                        className="px-4 py-3 max-w-xs truncate text-xs text-muted-foreground"
                        title={r.user_agent ?? ""}
                      >
                        {r.user_agent ?? "—"}
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

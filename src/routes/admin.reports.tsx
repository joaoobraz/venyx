import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { requireAdminServer } from "@/_server/admin.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/reports")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/reports" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  component: ReportsAdminPage,
});

type ReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  reported_user_id: string | null;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

function ReportsAdminPage() {
  const { tr, locale } = useI18n();
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setReports((data ?? []) as ReportRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: "reviewing" | "resolved" | "rejected") => {
    setBusy(id);
    const { error } = await supabase
      .from("content_reports")
      .update({
        status,
        reviewed_at: status === "reviewing" ? null : new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", id);
    setBusy(null);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Flag className="h-6 w-6 text-destructive" />
            {tr("Denúncias de usuários", "User reports")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              "Fila de denúncias de posts, perfis, mensagens e conversas.",
              "Report queue for posts, profiles, messages, and conversations.",
            )}
          </p>
        </header>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {tr("Nenhuma denúncia pendente.", "No reports in the queue.")}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {report.target_type} · {report.reason}
                    </div>
                    <div className="mt-1 break-all text-xs text-muted-foreground">
                      {tr("Alvo", "Target")}: {report.target_id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(report.created_at).toLocaleString(locale === "en" ? "en-US" : "pt-BR")}
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">{report.status}</span>
                </div>
                {report.details && (
                  <p data-user-content className="mt-3 rounded-lg bg-background p-3 text-sm">
                    {report.details}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === report.id}
                    onClick={() => updateStatus(report.id, "reviewing")}
                  >
                    {tr("Em análise", "Reviewing")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy === report.id}
                    onClick={() => updateStatus(report.id, "resolved")}
                  >
                    {tr("Resolver", "Resolve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === report.id}
                    onClick={() => updateStatus(report.id, "rejected")}
                  >
                    {tr("Rejeitar", "Reject")}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

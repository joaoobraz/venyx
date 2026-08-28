import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Archive, Check, Flag, Loader2, ShieldCheck, Timer } from "lucide-react";
import { toast } from "sonner";
import { requireAdminServer } from "@/_server/admin.functions";
import { listSafetyReports, reviewSafetyReport } from "@/_server/safety-operations.functions";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useI18n, type Locale } from "@/lib/i18n";

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
  priority: string;
  sla_due_at: string | null;
  assigned_to: string | null;
  escalated_at: string | null;
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  evidence: { preservedAt: string; legalHold: boolean; retentionUntil: string } | null;
};

const reasonLabels: Record<string, string> = {
  spam: "Spam ou fraude",
  harassment: "Assédio ou ameaça",
  impersonation: "Falsa identidade",
  underage: "Possível menor de idade",
  non_consensual: "Conteúdo não consentido",
  illegal: "Conteúdo ilegal",
  other: "Outro",
};

function slaText(report: ReportRow, locale: Locale) {
  if (!report.sla_due_at) return "—";
  const due = new Date(report.sla_due_at).getTime();
  const minutes = Math.round((due - Date.now()) / 60_000);
  if (["resolved", "rejected"].includes(report.status)) {
    return new Date(report.sla_due_at).toLocaleString(locale);
  }
  if (minutes < 0) return `${Math.abs(minutes)} min em atraso`;
  if (minutes < 60) return `${minutes} min restantes`;
  return `${Math.ceil(minutes / 60)} h restantes`;
}

export function ReportsAdminPage() {
  const { tr, locale } = useI18n();
  const listFn = useServerFn(listSafetyReports);
  const reviewFn = useServerFn(reviewSafetyReport);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [decision, setDecision] = useState<"resolved" | "rejected">("resolved");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await listFn();
      setReports(Array.isArray(result?.rows) ? (result.rows as ReportRow[]) : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro ao carregar denúncias.", "Could not load reports."));
    } finally {
      setLoading(false);
    }
  }, [listFn, tr]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (
    report: ReportRow,
    status: "reviewing" | "resolved" | "rejected",
    resolutionNote?: string,
  ) => {
    setBusy(report.id);
    try {
      await reviewFn({ data: { reportId: report.id, status, note: resolutionNote ?? null } });
      toast.success(tr("Denúncia atualizada.", "Report updated."));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro ao atualizar.", "Could not update."));
    } finally {
      setBusy(null);
    }
  };

  const openDecision = (report: ReportRow, next: "resolved" | "rejected") => {
    setSelected(report);
    setDecision(next);
    setNote("");
  };

  const finishDecision = async () => {
    if (!selected || note.trim().length < 5) return;
    await updateStatus(selected, decision, note.trim());
    setSelected(null);
  };

  const openReports = reports.filter((report) => !["resolved", "rejected"].includes(report.status));
  const critical = openReports.filter((report) => report.priority === "critical").length;
  const overdue = openReports.filter(
    (report) => report.sla_due_at && new Date(report.sla_due_at).getTime() < Date.now(),
  ).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Flag className="h-6 w-6 text-destructive" />
            {tr("Central de segurança", "Safety operations")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Fila priorizada com SLA, responsável e preservação automática de evidências.", "Prioritized queue with SLA, ownership, and automatic evidence preservation.")}
          </p>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <Metric label={tr("Abertas", "Open")} value={openReports.length} icon={Flag} />
          <Metric label={tr("Críticas", "Critical")} value={critical} icon={AlertTriangle} danger />
          <Metric label={tr("SLA vencido", "Overdue")} value={overdue} icon={Timer} danger={overdue > 0} />
        </div>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : reports.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {tr("Nenhuma denúncia na fila.", "No reports in the queue.")}
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const closed = ["resolved", "rejected"].includes(report.status);
              const late = !closed && report.sla_due_at && new Date(report.sla_due_at).getTime() < Date.now();
              return (
                <Card key={report.id} className={`p-4 ${report.priority === "critical" && !closed ? "border-destructive/50" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={report.priority} />
                        <p className="font-semibold">{reasonLabels[report.reason] ?? report.reason}</p>
                        <Badge variant="outline">{report.target_type}</Badge>
                      </div>
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        {tr("Alvo", "Target")}: {report.target_id}
                      </p>
                      <p className={`mt-1 text-xs ${late ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                        SLA: {slaText(report, locale)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={closed ? "secondary" : "outline"}>{report.status}</Badge>
                      {report.evidence && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {report.evidence.legalHold ? tr("Evidência sob retenção", "Evidence on legal hold") : tr("Evidência preservada", "Evidence preserved")}
                        </span>
                      )}
                    </div>
                  </div>

                  {report.details && (
                    <p data-user-content className="mt-3 rounded-lg bg-background p-3 text-sm">{report.details}</p>
                  )}
                  {report.resolution_note && (
                    <p className="mt-3 rounded-lg border border-border p-3 text-xs text-muted-foreground">
                      <strong className="text-foreground">{tr("Conclusão", "Resolution")}:</strong> {report.resolution_note}
                    </p>
                  )}

                  {!closed && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {report.status === "pending" && (
                        <Button size="sm" variant="outline" disabled={busy === report.id} onClick={() => updateStatus(report, "reviewing")}>
                          <Timer className="mr-1.5 h-3.5 w-3.5" /> {tr("Assumir análise", "Start review")}
                        </Button>
                      )}
                      <Button size="sm" disabled={busy === report.id} onClick={() => openDecision(report, "resolved")}>
                        <Check className="mr-1.5 h-3.5 w-3.5" /> {tr("Resolver", "Resolve")}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy === report.id} onClick={() => openDecision(report, "rejected")}>
                        <Archive className="mr-1.5 h-3.5 w-3.5" /> {tr("Arquivar", "Dismiss")}
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === "resolved" ? tr("Concluir denúncia", "Resolve report") : tr("Arquivar denúncia", "Dismiss report")}</DialogTitle>
            <DialogDescription>
              {tr("Registre a conclusão da análise. A ação entra na cadeia de custódia da evidência.", "Record the review conclusion. The action is added to the evidence chain of custody.")}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} maxLength={2000} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>{tr("Cancelar", "Cancel")}</Button>
            <Button onClick={finishDecision} disabled={!selected || busy === selected.id || note.trim().length < 5}>
              {busy === selected?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Confirmar", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Metric({ label, value, icon: Icon, danger = false }: { label: string; value: number; icon: typeof Flag; danger?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-2 text-2xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const label = priority === "critical" ? "Crítica" : priority === "high" ? "Alta" : "Normal";
  const style = priority === "critical"
    ? "border-red-500/40 bg-red-500/10 text-red-600"
    : priority === "high"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
      : "border-sky-500/40 bg-sky-500/10 text-sky-600";
  return <Badge className={style}>{label}</Badge>;
}

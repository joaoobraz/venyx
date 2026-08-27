import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
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
import { requireAdminServer } from "@/_server/admin.functions";
import {
  listFinancialReconciliation,
  resolveFinancialReconciliationIssue,
  runFinancialReconciliationNow,
} from "@/_server/financial-reconciliation.functions";
import { useI18n, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/admin/reconciliation")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/reconciliation" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  head: () => ({
    meta: [
      { title: "Conciliação financeira | Fanlira" },
      {
        name: "description",
        content: "Acompanhamento seguro das cobranças PIX pendentes e divergentes.",
      },
    ],
  }),
  component: AdminReconciliationPage,
});

type ChargeMini = {
  id: string;
  external_id: string;
  amount_cents: number;
  purpose: string;
  status: string;
  created_at: string;
};

type ReconciliationIssue = {
  id: string;
  charge_id: string;
  issue_code: string;
  severity: string;
  status: string;
  local_status: string;
  gateway_status: string | null;
  attempt_count: number;
  first_detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  charge: ChargeMini | null;
};

type ReconciliationRun = {
  id: string;
  source: string;
  status: string;
  scanned_count: number;
  recovered_count: number;
  expired_count: number;
  issue_count: number;
  error_code: string | null;
  started_at: string;
  completed_at: string | null;
};

type ReconciliationData = {
  providerConfigured: boolean;
  pendingCharges: number;
  issues: ReconciliationIssue[];
  runs: ReconciliationRun[];
};

const emptyReconciliationData: ReconciliationData = {
  providerConfigured: false,
  pendingCharges: 0,
  issues: [],
  runs: [],
};

function normalizeReconciliationData(value: unknown): ReconciliationData {
  const source =
    value && typeof value === "object" ? (value as Partial<ReconciliationData>) : {};
  return {
    providerConfigured: source.providerConfigured === true,
    pendingCharges:
      typeof source.pendingCharges === "number" && Number.isFinite(source.pendingCharges)
        ? source.pendingCharges
        : 0,
    issues: Array.isArray(source.issues) ? source.issues : [],
    runs: Array.isArray(source.runs) ? source.runs : [],
  };
}

const issueLabels: Record<string, string> = {
  missing_gateway_reference: "Cobrança sem referência da Impulse Pay",
  provider_lookup_failed: "Falha ao consultar a Impulse Pay",
  gateway_data_mismatch: "Dados da cobrança não conferem",
  fulfillment_failed: "Pagamento confirmado, mas entrega falhou",
  status_mismatch: "Status parado ou divergente",
};

const purposeLabels: Record<string, string> = {
  subscription: "Assinatura",
  ppv: "Conteúdo PPV",
  gift: "Mimo",
  tip: "Mimo",
};

const runLabels: Record<string, string> = {
  success: "Concluída",
  partial: "Concluída com pendências",
  failed: "Falhou",
  running: "Em andamento",
};

const fmtMoney = (cents: number, locale: Locale) =>
  `R$ ${(cents / 100).toLocaleString(locale, { minimumFractionDigits: 2 })}`;

export function AdminReconciliationPage() {
  const { locale, tr } = useI18n();
  const listFn = useServerFn(listFinancialReconciliation);
  const runFn = useServerFn(runFinancialReconciliationNow);
  const resolveFn = useServerFn(resolveFinancialReconciliationIssue);
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<ReconciliationIssue | null>(null);
  const [resolution, setResolution] = useState<"resolved" | "ignored">("resolved");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setData(normalizeReconciliationData(await listFn()));
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : tr("Não foi possível carregar o painel.", "The dashboard could not be loaded."),
      );
    } finally {
      setLoading(false);
    }
  }, [listFn, tr]);

  useEffect(() => {
    load();
  }, [load]);

  const dataView = data ?? emptyReconciliationData;
  const openIssues = useMemo(
    () => dataView.issues.filter((issue) => issue.status === "open"),
    [dataView.issues],
  );
  const highIssues = openIssues.filter((issue) => issue.severity === "high").length;
  const latestRun = dataView.runs[0] ?? null;

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runFn({ data: { limit: 100 } });
      const scanned =
        typeof result?.scanned === "number" && Number.isFinite(result.scanned)
          ? result.scanned
          : 0;
      toast.success(
        tr(
          `Varredura concluída: ${scanned} cobrança(s) analisada(s).`,
          `Sweep completed: ${scanned} charge(s) checked.`,
        ),
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Falha na varredura.", "Sweep failed."));
      await load();
    } finally {
      setRunning(false);
    }
  };

  const openResolution = (issue: ReconciliationIssue, status: "resolved" | "ignored") => {
    setSelected(issue);
    setResolution(status);
    setNote("");
  };

  const handleResolve = async () => {
    if (!selected || note.trim().length < 3) return;
    setSaving(true);
    try {
      await resolveFn({
        data: { issueId: selected.id, status: resolution, note: note.trim() },
      });
      toast.success(
        resolution === "resolved"
          ? tr("Pendência resolvida.", "Issue resolved.")
          : tr("Pendência ignorada com justificativa.", "Issue ignored with a note."),
      );
      setSelected(null);
      setNote("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Não foi possível salvar.", "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl space-y-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <CircleDollarSign className="h-7 w-7 text-primary" />
              {tr("Conciliação financeira", "Financial reconciliation")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {tr(
                "Confere cobranças PIX que não foram concluídas pelo fluxo normal e separa divergências para revisão.",
                "Checks PIX charges that did not finish through the normal flow and queues mismatches for review.",
              )}
            </p>
          </div>
          <Button
            onClick={handleRun}
            disabled={running || loading || !dataView.providerConfigured}
            className="gap-2"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {tr("Executar varredura", "Run sweep")}
          </Button>
        </div>

        {data && !dataView.providerConfigured && (
          <Card className="border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">
                  {tr("Aguardando credenciais da Impulse Pay", "Waiting for Impulse Pay credentials")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tr(
                    "A fila, o histórico e a proteção já estão prontos. A consulta real ficará disponível assim que as chaves da Impulse Pay forem configuradas no servidor.",
                    "The queue, history, and safeguards are ready. Live checks will become available when the Impulse Pay keys are configured on the server.",
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}

        {loadError && (
          <Card className="border-destructive/40 p-4 text-sm text-destructive">
            {loadError}
            <Button variant="link" onClick={load} className="ml-2 h-auto p-0">
              {tr("Tentar novamente", "Try again")}
            </Button>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label={tr("PIX em análise", "PIX under review")}
            value={dataView.pendingCharges}
            icon={Clock3}
            loading={loading}
          />
          <SummaryCard
            label={tr("Pendências abertas", "Open issues")}
            value={openIssues.length}
            icon={AlertTriangle}
            loading={loading}
          />
          <SummaryCard
            label={tr("Alta prioridade", "High priority")}
            value={highIssues}
            icon={ShieldAlert}
            loading={loading}
          />
          <SummaryCard
            label={tr("Recuperadas na última", "Recovered in latest")}
            value={latestRun?.recovered_count ?? 0}
            icon={CheckCircle2}
            loading={loading}
          />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{tr("Pendências", "Issues")}</h2>
            <Badge variant="outline">{openIssues.length} {tr("abertas", "open")}</Badge>
          </div>

          {!loading && openIssues.length === 0 && (
            <Card className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 font-semibold">{tr("Nenhuma divergência aberta", "No open mismatches")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tr("As cobranças analisadas estão conciliadas.", "Reviewed charges are reconciled.")}
              </p>
            </Card>
          )}

          {openIssues.map((issue) => (
            <Card key={issue.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={issue.severity} />
                    <p className="font-semibold">{issueLabels[issue.issue_code] ?? issue.issue_code}</p>
                  </div>
                  <div className="grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>
                      {tr("Cobrança", "Charge")}: <span className="font-mono text-xs text-foreground">{issue.charge?.external_id ?? issue.charge_id}</span>
                    </p>
                    <p>
                      {tr("Valor", "Amount")}: <span className="text-foreground">{issue.charge ? fmtMoney(issue.charge.amount_cents, locale) : "—"}</span>
                    </p>
                    <p>
                      {tr("Tipo", "Type")}: <span className="text-foreground">{issue.charge ? purposeLabels[issue.charge.purpose] ?? issue.charge.purpose : "—"}</span>
                    </p>
                    <p>
                      {tr("Tentativas", "Attempts")}: <span className="text-foreground">{issue.attempt_count}</span>
                    </p>
                    <p>
                      {tr("Status Fanlira", "Fanlira status")}: <span className="text-foreground">{issue.local_status}</span>
                    </p>
                    <p>
                      {tr("Status Impulse Pay", "Impulse Pay status")}: <span className="text-foreground">{issue.gateway_status ?? tr("não disponível", "unavailable")}</span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr("Última detecção", "Last detected")}: {new Date(issue.last_detected_at).toLocaleString(locale)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openResolution(issue, "resolved")}>
                    {tr("Resolver", "Resolve")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openResolution(issue, "ignored")}>
                    {tr("Ignorar", "Ignore")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{tr("Histórico de varreduras", "Sweep history")}</h2>
          <Card className="overflow-hidden">
            {dataView.runs.length ? (
              <div className="divide-y">
                {dataView.runs.map((run) => (
                  <div key={run.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[1.3fr_repeat(4,0.7fr)] sm:items-center">
                    <div>
                      <p className="font-medium">{runLabels[run.status] ?? run.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {run.source === "admin" ? tr("Manual", "Manual") : tr("Automática", "Automatic")} · {new Date(run.started_at).toLocaleString(locale)}
                      </p>
                    </div>
                    <RunMetric label={tr("Analisadas", "Checked")} value={run.scanned_count} />
                    <RunMetric label={tr("Recuperadas", "Recovered")} value={run.recovered_count} />
                    <RunMetric label={tr("Encerradas", "Closed")} value={run.expired_count} />
                    <RunMetric label={tr("Pendências", "Issues")} value={run.issue_count} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                {tr("Nenhuma varredura executada ainda.", "No sweeps have run yet.")}
              </p>
            )}
          </Card>
        </section>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolution === "resolved"
                ? tr("Resolver pendência", "Resolve issue")
                : tr("Ignorar pendência", "Ignore issue")}
            </DialogTitle>
            <DialogDescription>
              {tr(
                "Registre o que foi conferido. A ação ficará no histórico administrativo.",
                "Record what was checked. This action will remain in the administrative history.",
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={5}
            placeholder={tr("Ex.: cobrança conferida diretamente no painel do provedor", "E.g. charge checked directly in the provider dashboard")}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={handleResolve} disabled={saving || note.trim().length < 3}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Confirmar", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: typeof Clock3;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
      </p>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles =
    severity === "high"
      ? "border-red-500/40 bg-red-500/10 text-red-600"
      : severity === "medium"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
        : "border-sky-500/40 bg-sky-500/10 text-sky-600";
  const label = severity === "high" ? "Alta" : severity === "medium" ? "Média" : "Baixa";
  return <Badge className={styles}>{label}</Badge>;
}

function RunMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

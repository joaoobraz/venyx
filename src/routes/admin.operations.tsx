import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, DatabaseBackup, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminServer } from "@/_server/admin.functions";
import {
  listOperationsDashboard,
  recordBackupVerification,
  runOperationalReadinessCheck,
  updateOperationalAlert,
} from "@/_server/operations.functions";

export const Route = createFileRoute("/admin/operations")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/operations" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  component: AdminOperationsPage,
});

type EventRow = {
  id: string;
  event_name: string;
  severity: string;
  route: string | null;
  fingerprint: string | null;
  created_at: string;
};

type Dashboard = {
  days: number;
  funnel: Array<{ name: string; count: number; conversion: number | null }>;
  devices: Array<{ name: string; count: number }>;
  recentErrors: EventRow[];
  alerts: Array<{
    id: string;
    status: string;
    created_at: string;
    resolution_note: string | null;
    event: EventRow | null;
  }>;
  backups: Array<{
    id: string;
    backup_provider: string;
    backup_reference: string;
    source_environment: string;
    restore_environment: string;
    status: string;
    completed_at: string;
    note: string;
  }>;
  health: { errors24h: number; openAlerts: number; overdueSafety: number; criticalSupport: number };
};

const emptyHealth: Dashboard["health"] = {
  errors24h: 0,
  openAlerts: 0,
  overdueSafety: 0,
  criticalSupport: 0,
};

const emptyDashboard: Dashboard = {
  days: 30,
  funnel: [],
  devices: [],
  recentErrors: [],
  alerts: [],
  backups: [],
  health: emptyHealth,
};

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeDashboard(value: unknown): Dashboard {
  const source =
    value && typeof value === "object" ? (value as Partial<Dashboard>) : emptyDashboard;
  return {
    days: safeNumber(source.days) || 30,
    funnel: Array.isArray(source.funnel) ? source.funnel : [],
    devices: Array.isArray(source.devices) ? source.devices : [],
    recentErrors: Array.isArray(source.recentErrors) ? source.recentErrors : [],
    alerts: Array.isArray(source.alerts) ? source.alerts : [],
    backups: Array.isArray(source.backups) ? source.backups : [],
    health: {
      errors24h: safeNumber(source.health?.errors24h),
      openAlerts: safeNumber(source.health?.openAlerts),
      overdueSafety: safeNumber(source.health?.overdueSafety),
      criticalSupport: safeNumber(source.health?.criticalSupport),
    },
  };
}

const funnelLabels: Record<string, string> = {
  page_view: "Visita",
  signup_completed: "Cadastro",
  profile_completed: "Perfil completo",
  checkout_started: "Checkout",
  payment_completed: "Pagamento",
};

function localDateTime(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AdminOperationsPage() {
  const getDashboard = useServerFn(listOperationsDashboard);
  const updateAlert = useServerFn(updateOperationalAlert);
  const recordBackup = useServerFn(recordBackupVerification);
  const readiness = useServerFn(runOperationalReadinessCheck);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [alertNote, setAlertNote] = useState("");
  const [backupOpen, setBackupOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDashboard(normalizeDashboard(await getDashboard({ data: { days: 30 } })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a operação.");
    } finally {
      setLoading(false);
    }
  }, [getDashboard]);

  useEffect(() => { void load(); }, [load]);

  const resolveAlert = async (status: "acknowledged" | "resolved") => {
    if (!selectedAlert) return;
    setSaving(true);
    try {
      await updateAlert({ data: { alertId: selectedAlert, status, note: alertNote } });
      toast.success(status === "resolved" ? "Alerta resolvido." : "Alerta assumido.");
      setSelectedAlert(null);
      setAlertNote("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar o alerta.");
    } finally {
      setSaving(false);
    }
  };

  const runCheck = async () => {
    setSaving(true);
    try {
      const result = await readiness();
      const checks = Array.isArray(result?.checks) ? result.checks : [];
      const failed = checks.filter((item) => !item.ok);
      if (failed.length) toast.error(`${failed.length} verificação(ões) falharam.`);
      else toast.success("Banco e armazenamento responderam corretamente.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na verificação.");
    } finally {
      setSaving(false);
    }
  };

  const dashboardData = normalizeDashboard(dashboard);
  const health = dashboardData.health;
  const openAlerts = dashboardData.alerts.filter((alert) => alert.status !== "resolved");

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl space-y-7 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><Activity className="h-7 w-7 text-primary" /> Operação & estabilidade</h1>
            <p className="mt-1 text-sm text-muted-foreground">Funil, erros, alertas e evidências dos últimos 30 dias.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void runCheck()} disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4" />Verificar ambiente</Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Erros nas últimas 24h" value={health.errors24h} danger={health.errors24h > 0} />
          <Metric title="Alertas abertos" value={health.openAlerts} danger={health.openAlerts > 0} />
          <Metric title="Denúncias fora do SLA" value={health.overdueSafety} danger={health.overdueSafety > 0} />
          <Metric title="Suportes críticos" value={health.criticalSupport} danger={health.criticalSupport > 0} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Card className="p-5">
            <h2 className="font-semibold">Funil do MVP</h2>
            <p className="mt-1 text-xs text-muted-foreground">Pessoas únicas por etapa, sem armazenar e-mail, documento ou IP bruto.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-5">
              {dashboardData.funnel.map((step) => (
                <div key={step.name} className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">{funnelLabels[step.name] ?? step.name}</p>
                  <p className="mt-1 text-2xl font-bold">{step.count}</p>
                  <p className="text-xs text-muted-foreground">{step.conversion === null ? "início" : `${step.conversion}% da etapa anterior`}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Dispositivos</h2>
            <div className="mt-4 space-y-3">
              {dashboardData.devices.map((device) => (
                <div key={device.name} className="flex items-center justify-between text-sm"><span className="capitalize">{device.name}</span><Badge variant="secondary">{device.count}</Badge></div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Alertas que exigem ação</h2><p className="text-xs text-muted-foreground">Erros de severidade alta ou crítica abrem alerta automaticamente.</p></div></div>
          <div className="mt-4 space-y-3">
            {openAlerts.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nenhum alerta aberto.</p>}
            {openAlerts.map((alert) => (
              <button key={alert.id} type="button" onClick={() => setSelectedAlert(alert.id)} className="flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left hover:bg-muted/40">
                <div><p className="font-medium">{alert.event?.event_name ?? "Evento indisponível"}</p><p className="text-xs text-muted-foreground">{alert.event?.route ?? "sem rota"} · {new Date(alert.created_at).toLocaleString("pt-BR")}</p></div>
                <Badge variant={alert.event?.severity === "critical" ? "destructive" : "secondary"}>{alert.event?.severity ?? alert.status}</Badge>
              </button>
            ))}
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">Erros recentes</h2>
            <div className="mt-4 max-h-80 space-y-3 overflow-auto">
              {dashboardData.recentErrors.length === 0 && <p className="text-sm text-muted-foreground">Nenhum erro registrado no período.</p>}
              {dashboardData.recentErrors.map((event) => (
                <div key={event.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{event.event_name}</p><Badge variant={event.severity === "critical" ? "destructive" : "outline"}>{event.severity}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{event.route ?? "sem rota"} · {new Date(event.created_at).toLocaleString("pt-BR")}</p></div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><DatabaseBackup className="h-4 w-4" />Restauração de backup</h2><p className="mt-1 text-xs text-muted-foreground">Só registre após restaurar um backup real em ambiente isolado.</p></div><Button size="sm" onClick={() => setBackupOpen(true)}>Registrar evidência</Button></div>
            <div className="mt-4 space-y-3">
              {dashboardData.backups.length === 0 && <div className="rounded-xl border border-amber-300/50 bg-amber-500/10 p-4 text-sm"><p className="font-medium">Ainda não validado</p><p className="mt-1 text-muted-foreground">O checklist continua aberto até existir uma restauração real aprovada.</p></div>}
              {dashboardData.backups.map((run) => (
                <div key={run.id} className="rounded-xl border p-3"><div className="flex justify-between"><p className="text-sm font-medium">{run.backup_provider} → {run.restore_environment}</p><Badge variant={run.status === "passed" ? "secondary" : "destructive"}>{run.status === "passed" ? "aprovado" : "falhou"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{run.backup_reference} · {new Date(run.completed_at).toLocaleString("pt-BR")}</p></div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent><DialogHeader><DialogTitle>Tratar alerta</DialogTitle><DialogDescription>Registre o que foi verificado antes de assumir ou resolver.</DialogDescription></DialogHeader><Label htmlFor="alert-note">Anotação obrigatória</Label><Textarea id="alert-note" value={alertNote} onChange={(event) => setAlertNote(event.target.value)} rows={5} /><div className="flex justify-end gap-2"><Button variant="outline" disabled={saving || alertNote.trim().length < 5} onClick={() => void resolveAlert("acknowledged")}>Assumir</Button><Button disabled={saving || alertNote.trim().length < 5} onClick={() => void resolveAlert("resolved")}>Resolver</Button></div></DialogContent>
      </Dialog>

      <BackupDialog open={backupOpen} onOpenChange={setBackupOpen} saving={saving} onSave={async (value) => {
        setSaving(true);
        try { await recordBackup({ data: value }); toast.success("Evidência de restauração registrada."); setBackupOpen(false); await load(); }
        catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao registrar a restauração."); }
        finally { setSaving(false); }
      }} />
    </AppShell>
  );
}

function Metric({ title, value, danger }: { title: string; value: number; danger: boolean }) {
  return <Card className="p-4"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{title}</p>{danger ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</div><p className="mt-2 text-3xl font-bold">{value}</p></Card>;
}

type BackupInput = {
  provider: string;
  reference: string;
  sourceEnvironment: string;
  restoreEnvironment: string;
  status: "passed" | "failed";
  startedAt: string;
  completedAt: string;
  note: string;
};

function BackupDialog({ open, onOpenChange, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; saving: boolean; onSave: (value: BackupInput) => Promise<void> }) {
  const [value, setValue] = useState<BackupInput>({ provider: "Supabase", reference: "", sourceEnvironment: "staging", restoreEnvironment: "restore-test", status: "passed", startedAt: localDateTime(new Date(Date.now() - 3_600_000)), completedAt: localDateTime(), note: "" });
  const field = (key: keyof BackupInput, next: string) => setValue((current) => ({ ...current, [key]: next }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Evidência de restauração real</DialogTitle><DialogDescription>Não use esta tela para uma checagem comum. Informe o identificador fornecido pelo provedor e o ambiente isolado restaurado.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Provedor"><Input value={value.provider} onChange={(event) => field("provider", event.target.value)} /></Field><Field label="Referência do backup"><Input value={value.reference} onChange={(event) => field("reference", event.target.value)} /></Field><Field label="Ambiente de origem"><Input value={value.sourceEnvironment} onChange={(event) => field("sourceEnvironment", event.target.value)} /></Field><Field label="Ambiente restaurado"><Input value={value.restoreEnvironment} onChange={(event) => field("restoreEnvironment", event.target.value)} /></Field><Field label="Início"><Input type="datetime-local" value={value.startedAt} onChange={(event) => field("startedAt", event.target.value)} /></Field><Field label="Conclusão"><Input type="datetime-local" value={value.completedAt} onChange={(event) => field("completedAt", event.target.value)} /></Field></div><Field label="Resultado"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value.status} onChange={(event) => field("status", event.target.value)}><option value="passed">Aprovado</option><option value="failed">Falhou</option></select></Field><Field label="Verificações executadas"><Textarea value={value.note} onChange={(event) => field("note", event.target.value)} rows={5} placeholder="Ex.: contagens conferidas, arquivos abertos, autenticação e consultas validadas…" /></Field><Button disabled={saving || value.reference.trim().length < 3 || value.note.trim().length < 10} onClick={() => void onSave({ ...value, startedAt: new Date(value.startedAt).toISOString(), completedAt: new Date(value.completedAt).toISOString() })}>Registrar evidência</Button></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

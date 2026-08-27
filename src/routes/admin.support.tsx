import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { requireAdminServer } from "@/_server/admin.functions";
import { listAdminServiceRequests, updateAdminServiceRequest } from "@/_server/support.functions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/support")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/support" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  component: AdminSupportPage,
});

type AnyRow = Record<string, unknown> & { id: string; protocol: string; status: string; created_at: string };
type Selection = { kind: "support" | "recovery" | "privacy"; row: AnyRow; status: string };

export function AdminSupportPage() {
  const { tr, locale } = useI18n();
  const listFn = useServerFn(listAdminServiceRequests);
  const updateFn = useServerFn(updateAdminServiceRequest);
  const [data, setData] = useState<{ support: AnyRow[]; recovery: AnyRow[]; privacy: AnyRow[] }>({ support: [], recovery: [], privacy: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await listFn();
      setData({
        support: Array.isArray(result?.support) ? (result.support as unknown as AnyRow[]) : [],
        recovery: Array.isArray(result?.recovery) ? (result.recovery as unknown as AnyRow[]) : [],
        privacy: Array.isArray(result?.privacy) ? (result.privacy as unknown as AnyRow[]) : [],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro ao carregar a central.", "Could not load service desk."));
    } finally {
      setLoading(false);
    }
  }, [listFn, tr]);

  useEffect(() => { load(); }, [load]);

  const openUpdate = (kind: Selection["kind"], row: AnyRow, status: string) => {
    setSelected({ kind, row, status });
    setNote("");
  };

  const submit = async () => {
    if (!selected || note.trim().length < 3) return;
    setBusy(true);
    try {
      await updateFn({ data: { requestKind: selected.kind, requestId: selected.row.id, status: selected.status, note: note.trim() } });
      toast.success(tr("Solicitação atualizada.", "Request updated."));
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Não foi possível atualizar.", "Could not update."));
    } finally {
      setBusy(false);
    }
  };

  const openSupport = data.support.filter((row) => !["resolved", "closed"].includes(row.status)).length;
  const openRecovery = data.recovery.filter((row) => !["approved", "rejected", "closed"].includes(row.status)).length;
  const openPrivacy = data.privacy.filter((row) => !["completed", "rejected", "canceled"].includes(row.status)).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Headphones className="h-6 w-6 text-primary" /> {tr("Central de atendimento", "Service desk")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Chamados, recuperação de conta e solicitações LGPD com protocolo e auditoria.", "Tickets, account recovery, and LGPD requests with tracking and audit.")}</p>
        </header>

        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <Tabs defaultValue="support">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="support">{tr("Chamados", "Tickets")} ({openSupport})</TabsTrigger>
              <TabsTrigger value="recovery">{tr("Recuperação", "Recovery")} ({openRecovery})</TabsTrigger>
              <TabsTrigger value="privacy">LGPD ({openPrivacy})</TabsTrigger>
            </TabsList>
            <TabsContent value="support" className="space-y-3">
              {data.support.map((row) => <RequestCard key={row.id} row={row} locale={locale} title={String(row.subject ?? row.protocol)} description={`${String(row.category ?? "")} · ${String(row.message ?? "")}`} actions={supportActions(row.status).map((action) => ({ ...action, onClick: () => openUpdate("support", row, action.status) }))} />)}
            </TabsContent>
            <TabsContent value="recovery" className="space-y-3">
              {data.recovery.map((row) => <RequestCard key={row.id} row={row} locale={locale} title={`${String(row.issue_type)} · ${String(row.login_email)}`} description={`${tr("Contato", "Contact")}: ${String(row.contact_email)} · ${String(row.details)}`} icon={KeyRound} actions={recoveryActions(row.status).map((action) => ({ ...action, onClick: () => openUpdate("recovery", row, action.status) }))} />)}
            </TabsContent>
            <TabsContent value="privacy" className="space-y-3">
              {data.privacy.map((row) => <RequestCard key={row.id} row={row} locale={locale} title={`${String(row.request_type)} · ${row.protocol}`} description={`${tr("Usuário", "User")}: ${String(row.user_id)}${row.user_note ? ` · ${String(row.user_note)}` : ""}`} icon={ShieldCheck} actions={privacyActions(row.status).map((action) => ({ ...action, onClick: () => openUpdate("privacy", row, action.status) }))} />)}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Atualizar solicitação", "Update request")}</DialogTitle>
            <DialogDescription>{selected?.row.protocol} · {selected?.status}</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} maxLength={4000} placeholder={tr("Registre a providência tomada", "Record the action taken")} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>{tr("Cancelar", "Cancel")}</Button>
            <Button onClick={submit} disabled={busy || note.trim().length < 3}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tr("Confirmar", "Confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

type Action = { label: string; status: string; onClick?: () => void };

function supportActions(status: string): Action[] {
  if (["resolved", "closed"].includes(status)) return [];
  return [{ label: "Em atendimento", status: "in_progress" }, { label: "Aguardando usuário", status: "waiting_user" }, { label: "Resolver", status: "resolved" }];
}
function recoveryActions(status: string): Action[] {
  if (["approved", "rejected", "closed"].includes(status)) return [];
  return [{ label: "Verificar identidade", status: "verifying" }, { label: "Aprovar", status: "approved" }, { label: "Rejeitar", status: "rejected" }];
}
function privacyActions(status: string): Action[] {
  if (["completed", "rejected", "canceled"].includes(status)) return [];
  return [{ label: "Verificar", status: "verified" }, { label: "Processar", status: "processing" }, { label: "Concluir", status: "completed" }, { label: "Rejeitar", status: "rejected" }];
}

function RequestCard({ row, title, description, actions, locale, icon: Icon = Headphones }: { row: AnyRow; title: string; description: string; actions: Action[]; locale: string; icon?: typeof Headphones }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><p className="font-semibold">{title}</p></div>
          <p data-user-content className="mt-2 line-clamp-3 text-sm text-muted-foreground">{description}</p>
          <p className="mt-2 text-xs text-muted-foreground">{row.protocol} · {new Date(row.created_at).toLocaleString(locale)}</p>
        </div>
        <Badge variant="outline">{row.status}</Badge>
      </div>
      {actions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{actions.map((action) => <Button key={action.status} size="sm" variant="outline" onClick={action.onClick}>{action.label}</Button>)}</div>}
    </Card>
  );
}

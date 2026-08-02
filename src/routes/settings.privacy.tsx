import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Database, Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPrivacyRequest, listMyPrivacyRequests } from "@/_server/support.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/settings/privacy")({
  component: PrivacySettingsPage,
  head: () => ({ meta: [{ title: "Privacidade e dados | Venyx" }] }),
});

type PrivacyRow = {
  id: string;
  protocol: string;
  request_type: string;
  status: string;
  retention_exceptions: unknown;
  created_at: string;
  completed_at: string | null;
};

function PrivacySettingsPage() {
  const { tr, locale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const createFn = useServerFn(createPrivacyRequest);
  const listFn = useServerFn(listMyPrivacyRequests);
  const [rows, setRows] = useState<PrivacyRow[]>([]);
  const [selected, setSelected] = useState<"export" | "deletion" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, navigate, user]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const result = await listFn();
      setRows(result.rows as PrivacyRow[]);
    } catch {
      // The request actions remain available.
    }
  }, [listFn, user]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (type: "export" | "deletion") => {
    setSelected(type);
    setConfirmation("");
    setNote("");
  };

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await createFn({
        data: { requestType: selected, note: note.trim() || null, confirmation },
      });
      toast.success(tr(`Solicitação ${result.protocol} registrada.`, `Request ${result.protocol} recorded.`));
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Não foi possível registrar.", "Could not submit."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Database className="h-6 w-6 text-primary" /> {tr("Privacidade e seus dados", "Privacy and your data")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Solicitações autenticadas, protegidas por 2FA e acompanhadas por protocolo.", "Authenticated requests protected by 2FA and tracked by protocol.")}</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <Download className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-semibold">{tr("Exportar meus dados", "Export my data")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tr("Solicite uma cópia estruturada dos dados ligados à sua conta.", "Request a structured copy of data linked to your account.")}</p>
            <Button className="mt-4" variant="outline" onClick={() => open("export")}>{tr("Solicitar exportação", "Request export")}</Button>
          </Card>
          <Card className="border-destructive/30 p-5">
            <Trash2 className="h-6 w-6 text-destructive" />
            <h2 className="mt-3 font-semibold">{tr("Excluir minha conta", "Delete my account")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tr("Inicia a análise de exclusão e informa os dados que precisam ser retidos por obrigação legal.", "Starts deletion review and identifies data that must be retained by law.")}</p>
            <Button className="mt-4" variant="destructive" onClick={() => open("deletion")}>{tr("Solicitar exclusão", "Request deletion")}</Button>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold">{tr("Histórico de solicitações", "Request history")}</h2></div>
          {rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{tr("Nenhuma solicitação registrada.", "No requests recorded.")}</p> : (
            <div className="mt-3 divide-y divide-border">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div><p className="text-sm font-medium">{row.request_type === "export" ? tr("Exportação", "Export") : tr("Exclusão", "Deletion")}</p><p className="text-xs text-muted-foreground">{row.protocol} · {new Date(row.created_at).toLocaleString(locale)}</p></div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected === "deletion" ? tr("Confirmar solicitação de exclusão", "Confirm deletion request") : tr("Confirmar exportação", "Confirm export")}</DialogTitle>
            <DialogDescription>
              {selected === "deletion"
                ? tr("Pagamentos, prevenção a fraude, segurança e obrigações legais podem exigir retenção limitada mesmo após a exclusão.", "Payments, fraud prevention, safety, and legal duties may require limited retention after deletion.")
                : tr("A equipe validará o pedido e disponibilizará o arquivo por tempo limitado.", "The team will verify the request and provide a time-limited file.")}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} placeholder={tr("Observação opcional", "Optional note")} />
          <div>
            <p className="mb-1.5 text-sm text-muted-foreground">{tr("Digite", "Type")} <strong>{selected === "deletion" ? "EXCLUIR" : "EXPORTAR"}</strong>:</p>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>{tr("Cancelar", "Cancel")}</Button>
            <Button variant={selected === "deletion" ? "destructive" : "default"} onClick={submit} disabled={busy || confirmation.toUpperCase() !== (selected === "deletion" ? "EXCLUIR" : "EXPORTAR")}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tr("Confirmar", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  Clock3,
  Database,
  Download,
  EyeOff,
  Loader2,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPrivacyRequest, listMyPrivacyRequests } from "@/_server/support.functions";
import { setMyAccountPause } from "@/_server/account-pause.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { DEMO_MODE } from "@/lib/demo-creators";
import { setDemoAccountPaused } from "@/lib/account-pause";

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
  const {
    user,
    session,
    loading: authLoading,
    accountPaused,
    accountPausedAt,
    refresh,
  } = useAuth();
  const navigate = useNavigate();
  const createFn = useServerFn(createPrivacyRequest);
  const listFn = useServerFn(listMyPrivacyRequests);
  const setPauseFn = useServerFn(setMyAccountPause);
  const [rows, setRows] = useState<PrivacyRow[]>([]);
  const [selected, setSelected] = useState<"export" | "deletion" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);

  const changePause = async (paused: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      if (DEMO_MODE) {
        setDemoAccountPaused(user.id, paused);
      } else {
        const headers = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined;
        await setPauseFn({ data: { paused }, headers });
      }
      await refresh();
      setPauseDialogOpen(false);
      toast.success(
        paused
          ? tr("Conta pausada. Seu perfil já não aparece publicamente.", "Account paused. Your profile is no longer public.")
          : tr("Conta reativada com sucesso.", "Account reactivated successfully."),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível alterar o estado da conta.", "Couldn't change the account status."),
      );
    } finally {
      setBusy(false);
    }
  };

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
      toast.success(
        tr(`Solicitação ${result.protocol} registrada.`, `Request ${result.protocol} recorded.`),
      );
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível registrar.", "Could not submit."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Database className="h-6 w-6 text-primary" />{" "}
            {tr("Privacidade e seus dados", "Privacy and your data")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              "Solicitações autenticadas, protegidas por 2FA e acompanhadas por protocolo.",
              "Authenticated requests protected by 2FA and tracked by protocol.",
            )}
          </p>
        </header>

        {accountPaused && (
          <Card className="border-amber-500/40 bg-amber-500/5 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <PauseCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
                <div>
                  <h2 className="font-semibold">{tr("Sua conta está pausada", "Your account is paused")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tr(
                      "O perfil está oculto, novas compras estão bloqueadas e suas conversas estão somente para leitura.",
                      "Your profile is hidden, new purchases are blocked, and conversations are read-only.",
                    )}
                  </p>
                  {accountPausedAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {tr("Pausada em", "Paused on")} {new Date(accountPausedAt).toLocaleString(locale)}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={() => changePause(false)} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                {tr("Reativar agora", "Reactivate now")}
              </Button>
            </div>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-amber-500/30 p-5">
            <PauseCircle className="h-6 w-6 text-amber-600" />
            <h2 className="mt-3 font-semibold">
              {tr("Pausar minha conta temporariamente", "Pause my account temporarily")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(
                "Uma pausa reversível: seus dados e seu histórico permanecem guardados.",
                "A reversible pause: your data and history remain preserved.",
              )}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><EyeOff className="mt-0.5 h-4 w-4 shrink-0" />{tr("O perfil some da área pública imediatamente.", "The profile leaves public areas immediately.")}</li>
              <li className="flex gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />{tr("Assinaturas ativas continuam contando os dias normalmente.", "Active subscriptions keep counting down normally.")}</li>
              <li className="flex gap-2"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />{tr("Mensagens antigas ficam preservadas; novas ficam bloqueadas.", "Past messages are preserved; new messages are blocked.")}</li>
            </ul>
            {!accountPaused && (
              <Button className="mt-4" variant="outline" onClick={() => setPauseDialogOpen(true)}>
                {tr("Pausar temporariamente", "Pause temporarily")}
              </Button>
            )}
          </Card>

          <Card className="border-destructive/30 p-5">
          <Trash2 className="h-6 w-6 text-destructive" />
          <h2 className="mt-3 font-semibold">{tr("Excluir minha conta", "Delete my account")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              "Inicia a análise de exclusão e informa os dados que precisam ser retidos por obrigação legal.",
              "Starts deletion review and identifies data that must be retained by law.",
            )}
          </p>
          <Button className="mt-4" variant="destructive" onClick={() => open("deletion")}>
            {tr("Solicitar exclusão", "Request deletion")}
          </Button>
        </Card>

        </div>

        <Card className="bg-muted/30 p-4 text-sm">
          <span className="font-semibold">{tr("Diferença importante:", "Important difference:")}</span>{" "}
          <span className="text-muted-foreground">
            {tr(
              "pausar não apaga nada e não tem prazo máximo; você pode voltar quando quiser. Excluir é um pedido permanente, sujeito apenas às retenções legais obrigatórias.",
              "pausing deletes nothing and has no maximum duration; you may return anytime. Deletion is a permanent request, subject only to mandatory legal retention.",
            )}
          </span>
        </Card>

        <details className="group overflow-hidden rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <Database className="h-5 w-5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">
                {tr("Gerenciar meus dados", "Manage my data")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {tr(
                  "Acesso, portabilidade e solicitações de privacidade",
                  "Access, portability, and privacy requests",
                )}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-start gap-3">
              <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">{tr("Exportar meus dados", "Export my data")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tr(
                    "Solicite uma cópia dos seus dados cadastrais e de perfil, assinaturas, pagamentos, interações e consentimentos. Dados de terceiros e registros sujeitos a retenção legal não são incluídos.",
                    "Request a copy of your account and profile data, subscriptions, payments, interactions, and consents. Third-party data and records subject to legal retention are not included.",
                  )}
                </p>
                <Button className="mt-4" size="sm" variant="outline" onClick={() => open("export")}>
                  {tr("Solicitar exportação", "Request export")}
                </Button>
              </div>
            </div>
          </div>
        </details>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{tr("Histórico de solicitações", "Request history")}</h2>
          </div>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {tr("Nenhuma solicitação registrada.", "No requests recorded.")}
            </p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {row.request_type === "export"
                        ? tr("Exportação", "Export")
                        : tr("Exclusão", "Deletion")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.protocol} · {new Date(row.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Pausar conta agora?", "Pause account now?")}</DialogTitle>
            <DialogDescription>
              {tr(
                "A pausa começa imediatamente e não altera a data final das assinaturas que já estão ativas.",
                "The pause starts immediately and does not change the end date of active subscriptions.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <p><strong>{tr("Perfil:", "Profile:")}</strong> {tr("fica oculto para novos visitantes.", "hidden from new visitors.")}</p>
            <p><strong>{tr("Assinaturas:", "Subscriptions:")}</strong> {tr("não aceitam novas compras; as atuais seguem contando os dias.", "no new purchases; current subscriptions keep counting down.")}</p>
            <p><strong>{tr("Mensagens:", "Messages:")}</strong> {tr("o histórico continua visível, mas o envio fica bloqueado.", "history stays visible, but sending is blocked.")}</p>
            <p><strong>{tr("Retorno:", "Return:")}</strong> {tr("sem prazo máximo e com reativação a qualquer momento.", "no maximum duration and reactivation anytime.")}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPauseDialogOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button variant="outline" onClick={() => changePause(true)} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Confirmar pausa", "Confirm pause")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected === "deletion"
                ? tr("Confirmar solicitação de exclusão", "Confirm deletion request")
                : tr("Confirmar exportação", "Confirm export")}
            </DialogTitle>
            <DialogDescription>
              {selected === "deletion"
                ? tr(
                    "Pagamentos, prevenção a fraude, segurança e obrigações legais podem exigir retenção limitada mesmo após a exclusão.",
                    "Payments, fraud prevention, safety, and legal duties may require limited retention after deletion.",
                  )
                : tr(
                    "A equipe validará o pedido e disponibilizará o arquivo por tempo limitado.",
                    "The team will verify the request and provide a time-limited file.",
                  )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={tr("Observação opcional", "Optional note")}
          />
          <div>
            <p className="mb-1.5 text-sm text-muted-foreground">
              {tr("Digite", "Type")}{" "}
              <strong>{selected === "deletion" ? "EXCLUIR" : "EXPORTAR"}</strong>:
            </p>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button
              variant={selected === "deletion" ? "destructive" : "default"}
              onClick={submit}
              disabled={
                busy ||
                confirmation.toUpperCase() !== (selected === "deletion" ? "EXCLUIR" : "EXPORTAR")
              }
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
              {tr("Confirmar", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

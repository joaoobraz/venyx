import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock3, Headphones, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useI18n, type Locale } from "@/lib/i18n";
import {
  createAccountRecoveryRequest,
  createSupportRequest,
  listMySupportRequests,
} from "@/_server/support.functions";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({ meta: [{ title: "Preciso de ajuda | Fanlira" }] }),
});

type Ticket = {
  id: string;
  protocol: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
};

export function HelpPage() {
  const { tr, locale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const createTicket = useServerFn(createSupportRequest);
  const listTickets = useServerFn(listMySupportRequests);
  const createRecovery = useServerFn(createAccountRecoveryRequest);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [category, setCategory] = useState("account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [issueType, setIssueType] = useState("lost_2fa");
  const [recoveryDetails, setRecoveryDetails] = useState("");
  const [recoveryProtocol, setRecoveryProtocol] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const result = await listTickets();
      setTickets(result.rows as Ticket[]);
    } catch {
      // The form remains usable even if history is temporarily unavailable.
    }
  }, [listTickets, user]);

  useEffect(() => {
    load();
  }, [load]);

  const submitTicket = async () => {
    setBusy(true);
    try {
      const created = await createTicket({ data: { category: category as "account", subject, message } });
      toast.success(tr(`Chamado ${created.protocol} aberto.`, `Ticket ${created.protocol} opened.`));
      setSubject("");
      setMessage("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Não foi possível abrir o chamado.", "Could not open ticket."));
    } finally {
      setBusy(false);
    }
  };

  const submitRecovery = async () => {
    setBusy(true);
    try {
      const result = await createRecovery({
        data: {
          loginEmail,
          contactEmail,
          issueType: issueType as "lost_2fa",
          details: recoveryDetails,
        },
      });
      setRecoveryProtocol(result.protocol);
      setRecoveryDetails("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Não foi possível enviar.", "Could not submit."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Headphones className="h-6 w-6 text-primary" /> {tr("Preciso de ajuda", "I need help")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Todo pedido recebe um protocolo para acompanhamento.", "Every request receives a tracking protocol.")}
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <Clock3 className="h-5 w-5 text-primary" />
            <p className="mt-2 font-semibold">{tr("Atendimento geral", "General support")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr("Segunda a sexta, 9h–18h. Primeira resposta em até 1 dia útil.", "Monday–Friday, 9am–6pm. First reply within one business day.")}
            </p>
          </Card>
          <Card className="border-destructive/30 p-4">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <p className="mt-2 font-semibold">{tr("Risco ou conteúdo não consentido", "Safety or non-consensual content")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(
                "O envio fica disponível 24 horas e entra com prioridade máxima. Em uma emergência imediata, procure também as autoridades competentes.",
                "Submissions are available 24 hours a day and receive the highest priority. In an immediate emergency, also contact the appropriate authorities.",
              )}
            </p>
          </Card>
        </div>

        {!authLoading && user ? (
          <>
            <Card className="space-y-4 p-5">
              <h2 className="font-semibold">{tr("Abrir chamado", "Open a ticket")}</h2>
              <div>
                <Label>{tr("Categoria", "Category")}</Label>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="account">{tr("Conta e acesso", "Account and access")}</option>
                  <option value="billing">{tr("Pagamentos", "Payments")}</option>
                  <option value="creator">{tr("Conta de criadora", "Creator account")}</option>
                  <option value="safety">{tr("Segurança urgente", "Urgent safety")}</option>
                  <option value="technical">{tr("Problema técnico", "Technical issue")}</option>
                  <option value="privacy">LGPD / {tr("Privacidade", "Privacy")}</option>
                  <option value="other">{tr("Outro", "Other")}</option>
                </select>
              </div>
              <div><Label>{tr("Assunto", "Subject")}</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={140} className="mt-1.5" /></div>
              <div><Label>{tr("Explique o que aconteceu", "Describe what happened")}</Label><Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} maxLength={4000} className="mt-1.5" /></div>
              <Button onClick={submitTicket} disabled={busy || subject.trim().length < 5 || message.trim().length < 10}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tr("Enviar e gerar protocolo", "Submit and generate protocol")}
              </Button>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold">{tr("Meus chamados", "My tickets")}</h2>
              {tickets.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{tr("Nenhum chamado aberto.", "No tickets yet.")}</p> : (
                <div className="mt-3 divide-y divide-border">
                  {tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} locale={locale} />)}
                </div>
              )}
            </Card>
          </>
        ) : !authLoading ? (
          <Card className="p-5 text-center">
            <p className="text-sm text-muted-foreground">{tr("Entre para abrir e acompanhar chamados comuns.", "Sign in to open and track regular tickets.")}</p>
            <Button asChild className="mt-4"><Link to="/login">{tr("Entrar", "Sign in")}</Link></Button>
          </Card>
        ) : null}

        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">{tr("Perdeu o e-mail ou o 2FA?", "Lost your email or 2FA?")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr("A recuperação nunca é automática: nossa equipe confirma a identidade antes de qualquer alteração.", "Recovery is never automatic: our team verifies identity before any account change.")}
            </p>
          </div>
          {recoveryProtocol ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="mt-2 font-semibold">{tr("Solicitação registrada", "Request recorded")}</p>
              <p className="mt-1 text-sm">{tr("Guarde o protocolo", "Save this protocol")}: <strong>{recoveryProtocol}</strong></p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>{tr("E-mail usado na conta", "Email used on the account")}</Label><Input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="mt-1.5" /></div>
                <div><Label>{tr("E-mail atual para contato", "Current contact email")}</Label><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="mt-1.5" /></div>
              </div>
              <div>
                <Label>{tr("Problema", "Issue")}</Label>
                <select value={issueType} onChange={(event) => setIssueType(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="lost_2fa">{tr("Perdi acesso ao 2FA", "Lost access to 2FA")}</option>
                  <option value="lost_email">{tr("Perdi acesso ao e-mail", "Lost access to email")}</option>
                  <option value="locked_out">{tr("Minha conta está bloqueada", "My account is locked")}</option>
                </select>
              </div>
              <div><Label>{tr("Informações para conferência", "Information for verification")}</Label><Textarea value={recoveryDetails} onChange={(event) => setRecoveryDetails(event.target.value)} rows={5} maxLength={4000} className="mt-1.5" /></div>
              <Button onClick={submitRecovery} disabled={busy || !loginEmail.includes("@") || !contactEmail.includes("@") || recoveryDetails.trim().length < 20}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tr("Solicitar recuperação", "Request recovery")}
              </Button>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function TicketRow({ ticket, locale }: { ticket: Ticket; locale: Locale }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">{ticket.subject}</p>
        <p className="text-xs text-muted-foreground">{ticket.protocol} · {new Date(ticket.created_at).toLocaleString(locale)}</p>
      </div>
      <Badge variant="outline">{ticket.status}</Badge>
    </div>
  );
}

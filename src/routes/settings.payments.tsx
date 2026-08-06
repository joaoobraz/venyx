import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
  WalletCards,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  listMyBilling,
  scheduleSubscriptionCancellation,
  undoSubscriptionCancellation,
} from "@/_server/billing.functions";
import { AppShell } from "@/components/AppShell";
import { SubscribeModal } from "@/components/SubscribeModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useI18n, type Locale } from "@/lib/i18n";
import { shouldOfferManualRenewal } from "@/lib/subscription-lifecycle";

export const Route = createFileRoute("/settings/payments")({
  component: PaymentsPage,
});

type ChargeStatus = "pending" | "processing" | "paid" | "expired" | "cancelled" | "refunded";
type ChargePurpose = "subscription" | "ppv" | "tip" | "goal" | "chat_ppv" | "upsell";

interface CreatorLabel {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface BillingCharge {
  id: string;
  amount_cents: number;
  purpose: ChargePurpose;
  status: ChargeStatus;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  external_id: string;
  gateway_transaction_id: string | null;
  payee_id: string;
  creator: CreatorLabel | null;
}

interface BillingSubscription {
  id: string;
  creator_id: string;
  status: "active" | "canceled" | "expired";
  cancel_at_period_end: boolean;
  cancel_requested_at: string | null;
  cancellation_reason: string | null;
  price_cents: number;
  current_period_start: string | null;
  current_period_end: string | null;
  is_trial: boolean;
  months: number | null;
  created_at: string;
  creator: CreatorLabel | null;
}

function money(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}

function dateTime(value: string | null, locale: Locale) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function purposeLabel(purpose: ChargePurpose, locale: Locale) {
  const labels: Record<ChargePurpose, [string, string]> = {
    subscription: ["Assinatura", "Subscription"],
    ppv: ["Conteúdo PPV", "PPV content"],
    tip: ["Mimo", "Tip"],
    goal: ["Contribuição para meta", "Goal contribution"],
    chat_ppv: ["PPV no chat", "Chat PPV"],
    upsell: ["Oferta adicional", "Additional offer"],
  };
  return labels[purpose]?.[locale === "en" ? 1 : 0] ?? purpose;
}

function StatusPill({ status, locale }: { status: ChargeStatus; locale: Locale }) {
  const config: Record<ChargeStatus, { pt: string; en: string; className: string }> = {
    pending: { pt: "Aguardando", en: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    processing: { pt: "Processando", en: "Processing", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
    paid: { pt: "Pago", en: "Paid", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    expired: { pt: "Expirado", en: "Expired", className: "bg-muted text-muted-foreground" },
    cancelled: { pt: "Cancelado", en: "Cancelled", className: "bg-muted text-muted-foreground" },
    refunded: { pt: "Estornado", en: "Refunded", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  };
  const item = config[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.className}`}>
      {locale === "en" ? item.en : item.pt}
    </span>
  );
}

export function PaymentsPage() {
  const { user, session, loading: authLoading } = useAuth();
  const { locale, tr } = useI18n();
  const navigate = useNavigate();
  const listBilling = useServerFn(listMyBilling);
  const scheduleCancellation = useServerFn(scheduleSubscriptionCancellation);
  const undoCancellation = useServerFn(undoSubscriptionCancellation);
  const [charges, setCharges] = useState<BillingCharge[]>([]);
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [lifecycleAvailable, setLifecycleAvailable] = useState(false);
  const [selected, setSelected] = useState<BillingCharge | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BillingSubscription | null>(null);
  const [renewTarget, setRenewTarget] = useState<BillingSubscription | null>(null);
  const [cancelReason, setCancelReason] = useState("Não quero renovar agora");
  const [actionSubscriptionId, setActionSubscriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const result = await listBilling({
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setCharges(result.charges as BillingCharge[]);
      setSubscriptions(result.subscriptions as BillingSubscription[]);
      setLifecycleAvailable(result.lifecycleAvailable);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível carregar seus pagamentos.", "Could not load your payments."),
      );
    } finally {
      setLoading(false);
    }
  }, [listBilling, session?.access_token, tr]);

  const confirmCancellation = async () => {
    if (!cancelTarget || !session?.access_token) return;
    setActionSubscriptionId(cancelTarget.id);
    try {
      await scheduleCancellation({
        data: { subscriptionId: cancelTarget.id, reason: cancelReason },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success(
        tr(
          "Cancelamento agendado. Seu acesso continua até o fim do período pago.",
          "Cancellation scheduled. Your access continues until the paid period ends.",
        ),
      );
      setCancelTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Não foi possível cancelar.", "Could not cancel."));
    } finally {
      setActionSubscriptionId(null);
    }
  };

  const keepSubscription = async (subscription: BillingSubscription) => {
    if (!session?.access_token) return;
    setActionSubscriptionId(subscription.id);
    try {
      await undoCancellation({
        data: { subscriptionId: subscription.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success(tr("Cancelamento desfeito.", "Cancellation undone."));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Não foi possível desfazer.", "Could not undo."));
    } finally {
      setActionSubscriptionId(null);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(
    () => ({
      paid: charges.filter((charge) => charge.status === "paid").reduce((sum, charge) => sum + charge.amount_cents, 0),
      pending: charges.filter((charge) => ["pending", "processing"].includes(charge.status)).length,
    }),
    [charges],
  );

  if (!user) return null;

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <WalletCards className="h-6 w-6 text-primary" />
              {tr("Pagamentos e assinaturas", "Payments and subscriptions")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(
                "Somente operações financeiras reais aparecem aqui. A demonstração local não movimenta dinheiro.",
                "Only real financial operations appear here. The local demo never moves money.",
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {tr("Atualizar", "Refresh")}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryCard icon={CheckCircle2} label={tr("Total pago", "Total paid")} value={money(summary.paid, locale)} />
          <SummaryCard icon={Clock3} label={tr("Em processamento", "Processing")} value={String(summary.pending)} />
        </div>

        {!lifecycleAvailable && !loading && (
          <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-foreground">
                {tr("Atualização financeira aguardando ativação", "Financial update awaiting activation")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr(
                  "Seu histórico continua disponível. Os botões de cancelamento serão liberados após aplicar a atualização no Supabase.",
                  "Your history remains available. Cancellation controls will be enabled after the Supabase update is applied.",
                )}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold text-foreground">
            <CalendarClock className="h-5 w-5 text-primary" />
            {tr("Minhas assinaturas", "My subscriptions")}
          </h2>
          {subscriptions.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {tr("Você ainda não possui assinaturas reais.", "You do not have real subscriptions yet.")}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {subscriptions.map((subscription) => {
                const creatorName = subscription.creator?.display_name || subscription.creator?.username || tr("Criadora", "Creator");
                return (
                  <div key={subscription.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-semibold text-foreground">{creatorName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {subscription.is_trial ? tr("Período gratuito", "Free trial") : money(subscription.price_cents, locale)}
                        {" · "}
                        {tr("acesso até", "access until")} {dateTime(subscription.current_period_end, locale)}
                      </p>
                      {subscription.cancel_at_period_end && (
                        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {tr(
                            "Encerramento agendado; nenhum período já pago será perdido.",
                            "Cancellation scheduled; no paid access will be lost.",
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SubscriptionStatus status={subscription.status} locale={locale} />
                      {lifecycleAvailable && subscription.status === "active" && (
                        subscription.cancel_at_period_end ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionSubscriptionId === subscription.id}
                            onClick={() => void keepSubscription(subscription)}
                          >
                            {actionSubscriptionId === subscription.id && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                            {tr("Manter assinatura", "Keep subscription")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCancelReason("Não quero renovar agora");
                              setCancelTarget(subscription);
                            }}
                          >
                            {tr("Encerrar no vencimento", "End at expiration")}
                          </Button>
                        )
                      )}
                      {(subscription.status !== "active" || subscription.cancel_at_period_end || shouldOfferManualRenewal(subscription.current_period_end)) && (
                        <Button size="sm" onClick={() => setRenewTarget(subscription)}>
                          {tr("Renovar com PIX", "Renew with PIX")}
                        </Button>
                      )}
                      {subscription.creator?.username && (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/profile/$username" params={{ username: subscription.creator.username }}>
                            {tr("Ver perfil", "View profile")} <ExternalLink className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold text-foreground">
            <ReceiptText className="h-5 w-5 text-primary" />
            {tr("Histórico de cobranças", "Charge history")}
          </h2>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {tr("Carregando…", "Loading…")}
            </div>
          ) : charges.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              {tr("Nenhuma cobrança real foi registrada nesta conta.", "No real charge was recorded for this account.")}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {charges.map((charge) => {
                const creatorName = charge.creator?.display_name || charge.creator?.username || tr("Criadora", "Creator");
                return (
                  <button
                    type="button"
                    key={charge.id}
                    onClick={() => setSelected(charge)}
                    className="flex w-full flex-col justify-between gap-3 py-4 text-left transition hover:bg-muted/30 sm:flex-row sm:items-center sm:px-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{purposeLabel(charge.purpose, locale)}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {creatorName} · {dateTime(charge.created_at, locale)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <StatusPill status={charge.status} locale={locale} />
                      <span className="min-w-24 text-right font-bold text-foreground">{money(charge.amount_cents, locale)}</span>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("Comprovante da cobrança", "Charge receipt")}</DialogTitle>
            <DialogDescription>
              {tr("Referência registrada pela Fanlira e pela NexusPag.", "Reference recorded by Fanlira and NexusPag.")}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <ReceiptRow label={tr("Finalidade", "Purpose")} value={purposeLabel(selected.purpose, locale)} />
              <ReceiptRow label={tr("Valor", "Amount")} value={money(selected.amount_cents, locale)} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <StatusPill status={selected.status} locale={locale} />
              </div>
              <ReceiptRow label={tr("Criado em", "Created at")} value={dateTime(selected.created_at, locale)} />
              {selected.paid_at && <ReceiptRow label={tr("Pago em", "Paid at")} value={dateTime(selected.paid_at, locale)} />}
              <ReceiptRow label={tr("Referência Fanlira", "Fanlira reference")} value={selected.external_id} mono />
              <ReceiptRow
                label={tr("Referência NexusPag", "NexusPag reference")}
                value={selected.gateway_transaction_id || tr("Ainda não disponível", "Not available yet")}
                mono={!!selected.gateway_transaction_id}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                if (!selected) return;
                await navigator.clipboard.writeText(selected.external_id);
                toast.success(tr("Referência copiada.", "Reference copied."));
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> {tr("Copiar referência", "Copy reference")}
            </Button>
            <Button onClick={() => window.print()}>
              <FileText className="mr-2 h-4 w-4" /> {tr("Imprimir", "Print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Encerrar assinatura no vencimento?", "End subscription at expiration?")}</DialogTitle>
            <DialogDescription>
              {tr(
                `Você continuará com acesso até ${dateTime(cancelTarget?.current_period_end ?? null, locale)}.`,
                `You will keep access until ${dateTime(cancelTarget?.current_period_end ?? null, locale)}.`,
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {tr("Motivo do cancelamento", "Cancellation reason")}
            </label>
            <Select value={cancelReason} onValueChange={setCancelReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Não quero renovar agora">{tr("Não quero renovar agora", "I do not want to renew now")}</SelectItem>
                <SelectItem value="O preço não cabe no meu orçamento">{tr("O preço não cabe no orçamento", "The price does not fit my budget")}</SelectItem>
                <SelectItem value="Não encontrei o conteúdo que esperava">{tr("Não encontrei o conteúdo esperado", "I did not find the content I expected")}</SelectItem>
                <SelectItem value="Tive um problema técnico">{tr("Tive um problema técnico", "I had a technical problem")}</SelectItem>
                <SelectItem value="Outro motivo">{tr("Outro motivo", "Another reason")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              {tr("Voltar", "Go back")}
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason || actionSubscriptionId === cancelTarget?.id}
              onClick={() => void confirmCancellation()}
            >
              {actionSubscriptionId === cancelTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Confirmar encerramento", "Confirm cancellation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renewTarget && (
        <SubscribeModal
          open={!!renewTarget}
          onOpenChange={(open) => !open && setRenewTarget(null)}
          creatorId={renewTarget.creator_id}
          creatorName={renewTarget.creator?.display_name || renewTarget.creator?.username || tr("Criadora", "Creator")}
          basePriceCents={renewTarget.price_cents}
          onSubscribed={() => {
            setRenewTarget(null);
            void load();
          }}
        />
      )}
    </AppShell>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-primary" /> {label}</div>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function SubscriptionStatus({ status, locale }: { status: BillingSubscription["status"]; locale: Locale }) {
  const item = {
    active: ["Ativa", "Active", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
    canceled: ["Cancelada", "Cancelled", "bg-muted text-muted-foreground"],
    expired: ["Expirada", "Expired", "bg-muted text-muted-foreground"],
  }[status];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item[2]}`}>{item[locale === "en" ? 1 : 0]}</span>;
}

function ReceiptRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`break-all text-right font-medium text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

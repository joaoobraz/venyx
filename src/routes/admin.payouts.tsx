import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { requireAdminServer } from "@/_server/admin.functions";
import { useEffect, useState, useCallback } from "react";
import { ArrowDownToLine, Copy, ExternalLink, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approveWithdrawal,
  getImpulsePayOperationalBalance,
  rejectWithdrawal,
} from "@/_server/withdrawals.functions";
import { useI18n, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/admin/payouts")({
  beforeLoad: async () => {
    try {
      await requireAdminServer({ data: { path: "/admin/payouts" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  component: AdminPayoutsPage,
});

interface WithdrawalRow {
  id: string;
  creator_id: string;
  amount_cents: number;
  fanlira_withdrawal_fee_cents: number;
  pix_key: string;
  pix_key_type: string;
  holder_name: string;
  holder_document: string;
  status: "pending" | "approved" | "processing" | "paid" | "rejected" | "canceled";
  rejection_reason: string | null;
  receipt_url: string | null;
  created_at: string;
  paid_at: string | null;
  reviewed_at: string | null;
  gateway_transfer_id: string | null;
  gateway_status: string | null;
  gateway_fee_cents: number | null;
  gateway_net_amount_cents: number | null;
  gateway_end_to_end: string | null;
}

interface CreatorMini {
  user_id: string;
  username: string;
  display_name: string | null;
}

interface ProviderBalance {
  configured: boolean;
  available: number;
  reserved: number;
}

const fmt = (cents: number, locale: Locale) =>
  `R$ ${(cents / 100).toLocaleString(locale, { minimumFractionDigits: 2 })}`;

export function AdminPayoutsPage() {
  const { locale, tr } = useI18n();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [items, setItems] = useState<WithdrawalRow[]>([]);
  const [creators, setCreators] = useState<Record<string, CreatorMini>>({});
  const [providerBalance, setProviderBalance] = useState<ProviderBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [tab, setTab] = useState<"pending" | "approved" | "paid" | "rejected">("pending");

  const [rejecting, setRejecting] = useState<WithdrawalRow | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const approveFn = useServerFn(approveWithdrawal);
  const getBalanceFn = useServerFn(getImpulsePayOperationalBalance);
  const rejectFn = useServerFn(rejectWithdrawal);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/login" });
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const ok = (data ?? []).some((r) => r.role === "admin");
        setIsAdmin(ok);
        if (!ok) nav({ to: "/" });
      });
  }, [user, loading, nav]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data ?? []) as WithdrawalRow[];
    setItems(list);
    const ids = [...new Set(list.map((w) => w.creator_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", ids);
      const map: Record<string, CreatorMini> = {};
      (profs ?? []).forEach((p) => {
        map[p.user_id] = p as CreatorMini;
      });
      setCreators(map);
    }
  }, []);

  const loadProviderBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      setProviderBalance(await getBalanceFn());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr(
              "Não foi possível consultar o saldo da Impulse Pay.",
              "Could not load Impulse Pay balance.",
            ),
      );
    } finally {
      setBalanceLoading(false);
    }
  }, [getBalanceFn, tr]);

  useEffect(() => {
    if (isAdmin) {
      load();
      loadProviderBalance();
    }
  }, [isAdmin, load, loadProviderBalance]);

  if (!isAdmin) return null;

  const filtered = items.filter((w) => {
    if (tab === "pending") return w.status === "pending";
    if (tab === "approved") return w.status === "approved" || w.status === "processing";
    if (tab === "paid") return w.status === "paid";
    return w.status === "rejected" || w.status === "canceled";
  });

  const handleApprove = async (id: string) => {
    try {
      await approveFn({ data: { withdrawal_id: id, notes: null } });
      toast.success(
        tr(
          "Saque aprovado e enviado à Impulse Pay.",
          "Withdrawal approved and submitted to Impulse Pay.",
        ),
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro", "Error"));
    }
  };

  const handleReject = async () => {
    if (!rejecting || reason.trim().length < 3) return;
    setSubmitting(true);
    try {
      await rejectFn({ data: { withdrawal_id: rejecting.id, reason: reason.trim() } });
      toast.success(tr("Saque rejeitado", "Withdrawal rejected"));
      setRejecting(null);
      setReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro", "Error"));
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(tr("Copiado", "Copied"));
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{tr("Saques (Admin)", "Withdrawals (Admin)")}</h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4">
          <div className="flex items-center gap-3">
            <WalletCards className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">
                {tr("Saldo Impulse Pay", "Impulse Pay balance")}
              </div>
              {providerBalance?.configured ? (
                <div className="text-xs text-muted-foreground">
                  {tr("Disponível", "Available")}: {fmt(providerBalance.available, locale)} ·{" "}
                  {tr("Reservado", "Reserved")}: {fmt(providerBalance.reserved, locale)}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {providerBalance
                    ? tr(
                        "Credenciais ainda não configuradas.",
                        "Credentials are not configured yet.",
                      )
                    : tr("Consultando saldo...", "Loading balance...")}
                </div>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadProviderBalance}
            disabled={balanceLoading}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${balanceLoading ? "animate-spin" : ""}`} />
            {tr("Atualizar", "Refresh")}
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pending">
              {tr("Pendentes", "Pending")} ({items.filter((w) => w.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              {tr("Em pagamento", "Processing")} (
              {items.filter((w) => w.status === "approved" || w.status === "processing").length})
            </TabsTrigger>
            <TabsTrigger value="paid">{tr("Pagos", "Paid")}</TabsTrigger>
            <TabsTrigger value="rejected">
              {tr("Rejeitados/Cancelados", "Rejected/Canceled")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-3">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {tr("Nenhum item nesta lista.", "No items in this list.")}
              </p>
            )}
            {filtered.map((w) => {
              const c = creators[w.creator_id];
              return (
                <div key={w.id} className="rounded-xl bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-bold text-foreground">
                        {tr("Solicitado", "Requested")}: {fmt(w.amount_cents, locale)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c ? `@${c.username}` : w.creator_id} ·{" "}
                        {new Date(w.created_at).toLocaleString(locale)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {w.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(w.id)}>
                            {tr("Aprovar", "Approve")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejecting(w)}>
                            {tr("Rejeitar", "Reject")}
                          </Button>
                        </>
                      )}
                      {(w.status === "approved" || w.status === "processing") && (
                        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                          {w.gateway_status ?? tr("Enviado à Impulse Pay", "Sent to Impulse Pay")}
                        </span>
                      )}
                      {w.status === "paid" && w.receipt_url && (
                        <a
                          href={w.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline flex items-center gap-1"
                        >
                          {tr("Comprovante", "Receipt")} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 rounded-lg bg-background p-3 text-xs sm:grid-cols-2">
                    <Field
                      label={tr("Taxa Fanlira", "Fanlira fee")}
                      value={fmt(w.fanlira_withdrawal_fee_cents, locale)}
                    />
                    <Field
                      label={tr("Pix a transferir/transferido", "Pix to transfer/transferred")}
                      value={fmt(w.gateway_net_amount_cents ?? w.amount_cents, locale)}
                    />
                    {w.gateway_fee_cents !== null && (
                      <Field
                        label={tr("Taxa Impulse Pay absorvida", "Absorbed Impulse Pay fee")}
                        value={fmt(w.gateway_fee_cents, locale)}
                      />
                    )}
                    <Field label={tr("Tipo", "Type")} value={w.pix_key_type.toUpperCase()} />
                    <Field
                      label={tr("Chave Pix", "Pix key")}
                      value={w.pix_key}
                      onCopy={() => copy(w.pix_key)}
                    />
                    <Field label={tr("Titular", "Account holder")} value={w.holder_name} />
                    <Field
                      label="CPF/CNPJ"
                      value={w.holder_document}
                      onCopy={() => copy(w.holder_document)}
                    />
                    {w.gateway_transfer_id && (
                      <Field
                        label={tr("ID Impulse Pay", "Impulse Pay ID")}
                        value={w.gateway_transfer_id}
                        onCopy={() => copy(w.gateway_transfer_id ?? "")}
                      />
                    )}
                    {w.gateway_end_to_end && (
                      <Field
                        label="End-to-end"
                        value={w.gateway_end_to_end}
                        onCopy={() => copy(w.gateway_end_to_end ?? "")}
                      />
                    )}
                  </div>

                  {w.rejection_reason && (
                    <div className="mt-2 text-xs text-destructive">
                      {tr("Rejeição", "Rejection")}: {w.rejection_reason}
                    </div>
                  )}
                  {w.paid_at && (
                    <div className="mt-2 text-xs text-green-600">
                      {tr("Pago em", "Paid on")} {new Date(w.paid_at).toLocaleString(locale)}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal rejeitar */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Rejeitar saque", "Reject withdrawal")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Informe o motivo. A criadora verá esse texto no histórico.",
                "Enter a reason. The creator will see it in their history.",
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr(
              "Ex.: a chave Pix não corresponde ao nome do KYC",
              "E.g. Pix key does not match the KYC name",
            )}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting || reason.trim().length < 3}
            >
              {tr("Rejeitar", "Reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate font-medium text-foreground">{value}</div>
      </div>
      {onCopy && (
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

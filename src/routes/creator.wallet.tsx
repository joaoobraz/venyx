import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Wallet as WalletIcon,
  ArrowDownToLine,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Pencil,
  Receipt,
  Lock,
  Heart,
  Crown,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  upsertPayoutKey,
  requestWithdrawal,
  cancelWithdrawal,
} from "@/_server/withdrawals.functions";
import { useI18n, type Locale } from "@/lib/i18n";
import {
  DAILY_WITHDRAWAL_LIMIT,
  MIN_WITHDRAWAL_CENTS,
  countDailyWithdrawals,
  maximumWithdrawalAmount,
  withdrawalFeeForDailyCount,
} from "@/lib/withdrawal-policy";

export const Route = createFileRoute("/creator/wallet")({
  component: WalletPage,
});

interface Balance {
  gross_lifetime_cents: number;
  net_lifetime_cents: number;
  pending_cents: number;
  available_cents: number;
  total_withdrawn_cents: number;
  in_flight_cents: number;
}

interface PayoutKey {
  pix_key: string;
  pix_key_type: "cpf" | "cnpj" | "email" | "phone" | "random";
  holder_name: string;
  holder_document: string;
  key_changed_at?: string;
  withdrawal_eligible_at?: string;
}

interface VerifiedIdentity {
  cpf: string;
  full_name: string;
}

interface Withdrawal {
  id: string;
  amount_cents: number;
  status: "pending" | "approved" | "processing" | "paid" | "rejected" | "canceled";
  created_at: string;
  paid_at: string | null;
  rejection_reason: string | null;
  pix_key: string;
  fanlira_withdrawal_fee_cents: number;
  gateway_fee_cents: number | null;
  gateway_net_amount_cents: number | null;
}

interface KycRow {
  status: string;
}

interface TxRow {
  id: string;
  type: "subscription" | "ppv" | "tip" | "withdrawal" | "affiliate_commission" | string;
  amount_cents: number;
  created_at: string;
  payer_id: string | null;
  reference_id: string | null;
  gateway: string | null;
}

interface PlatformSettings {
  platform_fee_pct: number;
  hold_days: number;
}

const fmt = (cents: number, locale: Locale) =>
  `R$ ${(cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function WalletPage() {
  const { locale, tr } = useI18n();
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();

  const [balance, setBalance] = useState<Balance | null>(null);
  const [key, setKey] = useState<PayoutKey | null>(null);
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [kycApproved, setKycApproved] = useState(false);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [payerNames, setPayerNames] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<PlatformSettings>({
    platform_fee_pct: 15,
    hold_days: 1,
  });

  const [keyOpen, setKeyOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Formulário de chave PIX
  const [keyForm, setKeyForm] = useState<PayoutKey>({
    pix_key: "",
    pix_key_type: "cpf",
    holder_name: "",
    holder_document: "",
  });

  // Formulário de saque
  const [amountStr, setAmountStr] = useState("");

  const upsertKeyFn = useServerFn(upsertPayoutKey);
  const requestFn = useServerFn(requestWithdrawal);
  const cancelFn = useServerFn(cancelWithdrawal);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [
      { data: bal },
      { data: k },
      { data: ws },
      { data: kyc },
      { data: txList },
      { data: ps },
      { data: verifiedIdentity },
    ] = await Promise.all([
      supabase.from("creator_balances").select("*").eq("creator_id", user.id).maybeSingle(),
      supabase.from("creator_payout_keys").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("withdrawal_requests")
        .select(
          "id, amount_cents, status, created_at, paid_at, rejection_reason, pix_key, fanlira_withdrawal_fee_cents, gateway_fee_cents, gateway_net_amount_cents",
        )
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("kyc_requests")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("id, type, amount_cents, created_at, payer_id, reference_id, gateway")
        .eq("payee_id", user.id)
        .eq("status", "paid")
        .in("type", ["subscription", "ppv", "tip", "affiliate_commission"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.rpc("get_platform_fee_pct"),
      supabase
        .from("identity_verifications")
        .select("cpf, full_name")
        .eq("user_id", user.id)
        .eq("status", "verified")
        .maybeSingle(),
    ]);
    setBalance(
      (bal as Balance | null) ?? {
        gross_lifetime_cents: 0,
        net_lifetime_cents: 0,
        pending_cents: 0,
        available_cents: 0,
        total_withdrawn_cents: 0,
        in_flight_cents: 0,
      },
    );
    if (k) {
      const kk = k as PayoutKey;
      setKey(kk);
      setKeyForm(kk);
    }
    const verified = (verifiedIdentity as VerifiedIdentity | null) ?? null;
    setIdentity(verified);
    if (!k && verified) {
      setKeyForm((current) => ({
        ...current,
        holder_name: verified.full_name,
        holder_document: verified.cpf,
      }));
    }
    setWithdrawals((ws ?? []) as Withdrawal[]);
    setKycApproved(!!(kyc as KycRow | null));
    const txArr = (txList ?? []) as TxRow[];
    setTxs(txArr);
    if (typeof ps === "number") setSettings((s) => ({ ...s, platform_fee_pct: ps }));

    // Buscar nomes dos pagadores
    const payerIds = Array.from(new Set(txArr.map((t) => t.payer_id).filter(Boolean))) as string[];
    if (payerIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", payerIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach(
        (p: { user_id: string; username: string; display_name: string | null }) => {
          map[p.user_id] = p.display_name || p.username;
        },
      );
      setPayerNames(map);
    } else {
      setPayerNames({});
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!isCreator) return null;

  const dailyWithdrawalCount = countDailyWithdrawals(withdrawals);
  const nextWithdrawalFee = withdrawalFeeForDailyCount(dailyWithdrawalCount);
  const maximumRequestCents = maximumWithdrawalAmount(
    balance?.available_cents ?? 0,
    dailyWithdrawalCount,
  );
  const dailyLimitReached = dailyWithdrawalCount >= DAILY_WITHDRAWAL_LIMIT;

  const handleSaveKey = async () => {
    setSubmitting(true);
    try {
      const result = await upsertKeyFn({ data: keyForm });
      const eligibleAt = new Date(result.withdrawal_eligible_at).getTime();
      toast.success(
        eligibleAt > Date.now() + 60_000
          ? tr(
              "Chave Pix alterada. Saques para a nova chave serão liberados em 48 horas.",
              "Pix key changed. Withdrawals to the new key will be available in 48 hours.",
            )
          : tr("Chave Pix salva", "Pix key saved"),
      );
      setKeyOpen(false);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro ao salvar", "Could not save"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequest = async () => {
    const amount = Math.round(parseFloat(amountStr.replace(",", ".")) * 100);
    if (dailyLimitReached) {
      toast.error(
        tr(
          "Limite diário de 5 saques atingido. Tente novamente amanhã.",
          "Daily limit of 5 withdrawals reached. Try again tomorrow.",
        ),
      );
      return;
    }
    if (isNaN(amount) || amount < MIN_WITHDRAWAL_CENTS) {
      toast.error(tr("Valor mínimo: R$ 30,00", "Minimum amount: R$ 30.00"));
      return;
    }
    if (amount + nextWithdrawalFee > (balance?.available_cents ?? 0)) {
      toast.error(
        tr(
          `Saldo insuficiente: reserve ${fmt(nextWithdrawalFee, locale)} para a taxa deste saque.`,
          `Insufficient balance: reserve ${fmt(nextWithdrawalFee, locale)} for this withdrawal fee.`,
        ),
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestFn({ data: { amount_cents: amount } });
      toast.success(
        tr(
          `Saque solicitado. Taxa Fanlira: ${fmt(result.fanlira_withdrawal_fee_cents, locale)}.`,
          `Withdrawal requested. Fanlira fee: ${fmt(result.fanlira_withdrawal_fee_cents, locale)}.`,
        ),
      );
      setWithdrawOpen(false);
      setAmountStr("");
      await loadAll();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : tr("Erro ao solicitar", "Could not submit request"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(tr("Cancelar este saque?", "Cancel this withdrawal?"))) return;
    try {
      await cancelFn({ data: { withdrawal_id: id } });
      toast.success(tr("Saque cancelado", "Withdrawal canceled"));
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro ao cancelar", "Could not cancel"));
    }
  };

  const cooldownUntil = key?.withdrawal_eligible_at ? new Date(key.withdrawal_eligible_at) : null;
  const keyCooldownActive = !!cooldownUntil && cooldownUntil.getTime() > Date.now();
  const canRequest =
    kycApproved &&
    !!key &&
    !keyCooldownActive &&
    !dailyLimitReached &&
    maximumRequestCents >= MIN_WITHDRAWAL_CENTS;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Saldo principal */}
        <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <WalletIcon className="h-4 w-4" /> {tr("Saldo disponível", "Available balance")}
          </div>
          <div className="mt-2 text-4xl font-bold">
            {fmt(balance?.available_cents ?? 0, locale)}
          </div>
          <div className="mt-1 text-xs opacity-80">
            {tr(
              "Taxa da plataforma já descontada · Liberação após D+1",
              "Platform fee already deducted · Released after D+1",
            )}
          </div>
          <div className="mt-2 text-xs opacity-90">
            {tr("Saques hoje", "Withdrawals today")}: {dailyWithdrawalCount}/
            {DAILY_WITHDRAWAL_LIMIT} · {tr("Próxima taxa", "Next fee")}:{" "}
            {fmt(nextWithdrawalFee, locale)}
          </div>
          <Button
            onClick={() => setWithdrawOpen(true)}
            disabled={!canRequest}
            className="mt-4 bg-black/20 backdrop-blur-sm hover:bg-black/30 disabled:opacity-50"
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />{" "}
            {tr("Solicitar saque Pix", "Request Pix withdrawal")}
          </Button>
          {!kycApproved && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                {tr("KYC obrigatório para sacar.", "KYC is required for withdrawals.")}{" "}
                <Link to="/settings/security" className="underline">
                  {tr("Enviar documentos", "Submit documents")}
                </Link>
              </span>
            </div>
          )}
          {kycApproved && !key && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                {tr(
                  "Cadastre sua chave Pix abaixo para habilitar saques.",
                  "Add your Pix key below to enable withdrawals.",
                )}
              </span>
            </div>
          )}
          {keyCooldownActive && cooldownUntil && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-xs">
              <Lock className="h-3.5 w-3.5" />
              <span>
                {tr(
                  "Chave Pix alterada. Saques bloqueados por segurança até",
                  "Pix key changed. Withdrawals are locked for security until",
                )}{" "}
                <strong>{cooldownUntil.toLocaleString(locale)}</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Mini-cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniCard
            label={tr("Pendente (D+1)", "Pending (D+1)")}
            value={fmt(balance?.pending_cents ?? 0, locale)}
            icon={Clock}
          />
          <MiniCard
            label={tr("Em saque", "In withdrawal")}
            value={fmt(balance?.in_flight_cents ?? 0, locale)}
            icon={ArrowDownToLine}
          />
          <MiniCard
            label={tr("Total sacado", "Total withdrawn")}
            value={fmt(balance?.total_withdrawn_cents ?? 0, locale)}
            icon={CheckCircle2}
          />
          <MiniCard
            label={tr("Ganhos líquidos", "Net earnings")}
            value={fmt(balance?.net_lifetime_cents ?? 0, locale)}
            icon={TrendingUp}
          />
        </div>

        {/* Chave PIX */}
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <WalletIcon className="h-4 w-4 text-primary" />{" "}
              {tr("Chave Pix para saque", "Withdrawal Pix key")}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setKeyOpen(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />{" "}
              {key ? tr("Editar", "Edit") : tr("Cadastrar", "Add")}
            </Button>
          </div>
          {key ? (
            <div className="mt-3 space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">{tr("Tipo", "Type")}:</span>{" "}
                <span className="font-medium uppercase">{key.pix_key_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{tr("Chave", "Key")}:</span>{" "}
                <span className="font-medium">{key.pix_key}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{tr("Titular", "Account holder")}:</span>{" "}
                <span className="font-medium">{key.holder_name}</span>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-xs text-muted-foreground">
                {tr(
                  "A chave só pode pertencer ao CPF verificado nesta conta. Se ela for alterada, novos saques ficam bloqueados por 48 horas.",
                  "The key must belong to the CPF verified on this account. If changed, new withdrawals are locked for 48 hours.",
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {tr("Nenhuma chave cadastrada.", "No key registered.")}
            </p>
          )}
        </div>

        {/* Histórico de saques */}
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ArrowDownToLine className="h-4 w-4 text-primary" />{" "}
            {tr("Meus saques", "My withdrawals")}
          </div>
          {withdrawals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {tr("Nenhum saque ainda.", "No withdrawals yet.")}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg bg-background p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{fmt(w.amount_cents, locale)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(w.created_at).toLocaleString(locale)} · {w.pix_key}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {tr("Taxa Fanlira", "Fanlira fee")}:{" "}
                      {fmt(w.fanlira_withdrawal_fee_cents, locale)}
                      {w.gateway_net_amount_cents !== null && (
                        <>
                          {" "}
                          · {tr("Pix transferido", "Pix transferred")}:{" "}
                          {fmt(w.gateway_net_amount_cents, locale)}
                        </>
                      )}
                      {(w.gateway_fee_cents ?? 0) > 0 && (
                        <>
                          {" "}
                          · {tr("Taxa da adquirente absorvida", "Provider fee absorbed")}:{" "}
                          {fmt(w.gateway_fee_cents ?? 0, locale)}
                        </>
                      )}
                    </div>
                    {w.rejection_reason && (
                      <div className="mt-1 text-[11px] text-destructive">
                        {tr("Motivo", "Reason")}: {w.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={w.status} />
                    {w.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleCancel(w.id)}
                      >
                        {tr("Cancelar", "Cancel")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histórico detalhado de transações */}
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-primary" />{" "}
            {tr("Histórico de transações", "Transaction history")}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr(
              "Cada venda paga, com a taxa da plataforma descontada e o status da retenção",
              "Every paid sale, with the platform fee deducted and hold status",
            )}{" "}
            ({settings.platform_fee_pct}% · D+{settings.hold_days}).
          </p>
          {txs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {tr("Nenhuma venda registrada ainda.", "No sales recorded yet.")}
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {txs.map((t) => {
                const fee = Math.floor((t.amount_cents * settings.platform_fee_pct) / 100);
                const net = t.amount_cents - fee;
                const ageMs = Date.now() - new Date(t.created_at).getTime();
                const isAvailable = ageMs >= settings.hold_days * 24 * 60 * 60 * 1000;
                const releaseAt = new Date(
                  new Date(t.created_at).getTime() + settings.hold_days * 24 * 60 * 60 * 1000,
                );
                return (
                  <div key={t.id} className="rounded-lg bg-background p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <TxIcon type={t.type} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-foreground">
                              {txLabel(t.type, tr)}
                            </span>
                            {t.payer_id && payerNames[t.payer_id] && (
                              <span className="text-xs text-muted-foreground">
                                {tr("de", "from")} @{payerNames[t.payer_id]}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {new Date(t.created_at).toLocaleString(locale)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-foreground">+{fmt(net, locale)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {tr("bruto", "gross")} {fmt(t.amount_cents, locale)} − {tr("taxa", "fee")}{" "}
                          {fmt(fee, locale)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
                      {isAvailable ? (
                        <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-600">
                          <CheckCircle2 className="h-3 w-3" />{" "}
                          {tr("Liberado no saldo disponível", "Released to available balance")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-600">
                          <Lock className="h-3 w-3" />{" "}
                          {tr("Pendente · libera", "Pending · releases")}{" "}
                          {releaseAt.toLocaleString(locale, {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Chave PIX */}
      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Chave Pix para saque", "Withdrawal Pix key")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Esta chave receberá os pagamentos dos seus saques. Os dados do titular devem corresponder ao KYC aprovado.",
                "Withdrawal payments will be sent to this key. The account-holder details must match the approved KYC.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr("Tipo de chave", "Key type")}</Label>
              <Select
                value={keyForm.pix_key_type}
                onValueChange={(v) =>
                  setKeyForm((f) => ({ ...f, pix_key_type: v as PayoutKey["pix_key_type"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">{tr("Telefone", "Phone")}</SelectItem>
                  <SelectItem value="random">{tr("Chave aleatória", "Random key")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr("Chave Pix", "Pix key")}</Label>
              <Input
                value={keyForm.pix_key}
                onChange={(e) => setKeyForm((f) => ({ ...f, pix_key: e.target.value }))}
                placeholder={tr("Digite a chave", "Enter the key")}
              />
            </div>
            <div>
              <Label>{tr("Nome do titular", "Account-holder name")}</Label>
              <Input
                value={keyForm.holder_name}
                placeholder={tr("Nome completo", "Full name")}
                disabled
              />
            </div>
            <div>
              <Label>{tr("CPF/CNPJ do titular", "Account-holder CPF/CNPJ")}</Label>
              <Input
                value={keyForm.holder_document}
                placeholder={tr("Apenas números", "Numbers only")}
                disabled
              />
              {!identity && (
                <p className="mt-1 text-xs text-destructive">
                  {tr(
                    "Confirme sua identidade e seu CPF antes de cadastrar a chave Pix.",
                    "Verify your identity and CPF before adding a Pix key.",
                  )}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKeyOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={handleSaveKey} disabled={submitting || !identity}>
              {submitting ? tr("Salvando...", "Saving...") : tr("Salvar", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Solicitar saque */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Solicitar saque", "Request withdrawal")}</DialogTitle>
            <DialogDescription>
              {tr("Saque mínimo", "Minimum withdrawal")}: R$ 30,00 · {tr("Disponível", "Available")}
              : {fmt(balance?.available_cents ?? 0, locale)} ·{" "}
              {tr("Será enviado para", "Will be sent to")}: <strong>{key?.pix_key}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr("Valor (R$)", "Amount (R$)")}</Label>
              <Input
                type="number"
                step="0.01"
                min="30"
                max={(maximumRequestCents / 100).toFixed(2)}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmountStr((maximumRequestCents / 100).toFixed(2))}
              >
                {tr("Sacar tudo", "Withdraw all")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr(
                `Hoje: ${dailyWithdrawalCount} de ${DAILY_WITHDRAWAL_LIMIT}. O primeiro saque do dia é grátis; do segundo ao quinto, a taxa é R$ 3,00. A taxa cobrada pela Impulse Pay é absorvida pela Fanlira e não reduz seu saldo.`,
                `Today: ${dailyWithdrawalCount} of ${DAILY_WITHDRAWAL_LIMIT}. The first withdrawal of the day is free; the second through fifth cost R$ 3.00. Fanlira absorbs the Impulse Pay fee, so it does not reduce your balance.`,
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={handleRequest} disabled={submitting || dailyLimitReached}>
              {submitting ? tr("Enviando...", "Submitting...") : tr("Solicitar", "Request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function MiniCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
}) {
  return (
    <div className="rounded-xl bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: Withdrawal["status"] }) {
  const { tr } = useI18n();
  const map = {
    pending: {
      label: tr("Pendente", "Pending"),
      cls: "bg-yellow-500/15 text-yellow-600",
      Icon: Clock,
    },
    approved: {
      label: tr("Aprovado", "Approved"),
      cls: "bg-blue-500/15 text-blue-600",
      Icon: CheckCircle2,
    },
    processing: {
      label: tr("Processando", "Processing"),
      cls: "bg-blue-500/15 text-blue-600",
      Icon: Clock,
    },
    paid: { label: tr("Pago", "Paid"), cls: "bg-green-500/15 text-green-600", Icon: CheckCircle2 },
    rejected: {
      label: tr("Rejeitado", "Rejected"),
      cls: "bg-destructive/15 text-destructive",
      Icon: XCircle,
    },
    canceled: {
      label: tr("Cancelado", "Canceled"),
      cls: "bg-muted text-muted-foreground",
      Icon: XCircle,
    },
  } as const;
  const m = map[status];
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}
    >
      <m.Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function txLabel(type: string, tr: (pt: string, en: string) => string): string {
  switch (type) {
    case "subscription":
      return tr("Assinatura", "Subscription");
    case "ppv":
      return "Pay-per-view";
    case "tip":
      return tr("Mimo recebido", "Tip received");
    case "affiliate_commission":
      return tr("Comissão de afiliado", "Affiliate commission");
    default:
      return type;
  }
}

function TxIcon({ type }: { type: string }) {
  const map: Record<string, { Icon: typeof Crown; cls: string }> = {
    subscription: { Icon: Crown, cls: "bg-primary/15 text-primary" },
    ppv: { Icon: Lock, cls: "bg-blue-500/15 text-blue-600" },
    tip: { Icon: Heart, cls: "bg-pink-500/15 text-pink-600" },
    affiliate_commission: { Icon: Gift, cls: "bg-purple-500/15 text-purple-600" },
  };
  const m = map[type] ?? { Icon: Receipt, cls: "bg-muted text-muted-foreground" };
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.cls}`}>
      <m.Icon className="h-3.5 w-3.5" />
    </div>
  );
}

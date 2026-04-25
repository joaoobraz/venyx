import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Wallet as WalletIcon, ArrowDownToLine, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle, Pencil } from "lucide-react";
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
} from "@/server/withdrawals.functions";

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
}

interface Withdrawal {
  id: string;
  amount_cents: number;
  status: "pending" | "approved" | "processing" | "paid" | "rejected" | "canceled";
  created_at: string;
  paid_at: string | null;
  rejection_reason: string | null;
  pix_key: string;
}

interface KycRow {
  status: string;
}

const fmt = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function WalletPage() {
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();

  const [balance, setBalance] = useState<Balance | null>(null);
  const [key, setKey] = useState<PayoutKey | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [kycApproved, setKycApproved] = useState(false);

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
    const [{ data: bal }, { data: k }, { data: ws }, { data: kyc }] = await Promise.all([
      supabase.from("creator_balances").select("*").eq("creator_id", user.id).maybeSingle(),
      supabase.from("creator_payout_keys").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("withdrawal_requests")
        .select("id, amount_cents, status, created_at, paid_at, rejection_reason, pix_key")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("kyc_requests")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "approved")
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
    setWithdrawals((ws ?? []) as Withdrawal[]);
    setKycApproved(!!(kyc as KycRow | null));
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!isCreator) return null;

  const handleSaveKey = async () => {
    setSubmitting(true);
    try {
      await upsertKeyFn({ data: keyForm });
      toast.success("Chave PIX salva");
      setKeyOpen(false);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequest = async () => {
    const amount = Math.round(parseFloat(amountStr.replace(",", ".")) * 100);
    if (isNaN(amount) || amount < 3000) {
      toast.error("Valor mínimo: R$ 30,00");
      return;
    }
    setSubmitting(true);
    try {
      await requestFn({ data: { amount_cents: amount } });
      toast.success("Saque solicitado! Aguarde aprovação do administrador.");
      setWithdrawOpen(false);
      setAmountStr("");
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao solicitar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancelar este saque?")) return;
    try {
      await cancelFn({ data: { withdrawal_id: id } });
      toast.success("Saque cancelado");
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar");
    }
  };

  const canRequest = kycApproved && !!key && (balance?.available_cents ?? 0) >= 3000;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Saldo principal */}
        <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <WalletIcon className="h-4 w-4" /> Saldo disponível
          </div>
          <div className="mt-2 text-4xl font-bold">{fmt(balance?.available_cents ?? 0)}</div>
          <div className="mt-1 text-xs opacity-80">
            Já com taxa da plataforma (15%) descontada · Liberado após D+1
          </div>
          <Button
            onClick={() => setWithdrawOpen(true)}
            disabled={!canRequest}
            className="mt-4 bg-black/20 backdrop-blur-sm hover:bg-black/30 disabled:opacity-50"
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" /> Solicitar saque PIX
          </Button>
          {!kycApproved && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                KYC obrigatório para sacar.{" "}
                <Link to="/settings/security" className="underline">
                  Enviar documentos
                </Link>
              </span>
            </div>
          )}
          {kycApproved && !key && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Cadastre sua chave PIX abaixo para habilitar saques.</span>
            </div>
          )}
        </div>

        {/* Mini-cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniCard label="Pendente (D+1)" value={fmt(balance?.pending_cents ?? 0)} icon={Clock} />
          <MiniCard label="Em saque" value={fmt(balance?.in_flight_cents ?? 0)} icon={ArrowDownToLine} />
          <MiniCard label="Total sacado" value={fmt(balance?.total_withdrawn_cents ?? 0)} icon={CheckCircle2} />
          <MiniCard label="Ganhos líquidos" value={fmt(balance?.net_lifetime_cents ?? 0)} icon={TrendingUp} />
        </div>

        {/* Chave PIX */}
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <WalletIcon className="h-4 w-4 text-primary" /> Chave PIX para saque
            </div>
            <Button size="sm" variant="ghost" onClick={() => setKeyOpen(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> {key ? "Editar" : "Cadastrar"}
            </Button>
          </div>
          {key ? (
            <div className="mt-3 space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                <span className="font-medium uppercase">{key.pix_key_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Chave:</span>{" "}
                <span className="font-medium">{key.pix_key}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Titular:</span>{" "}
                <span className="font-medium">{key.holder_name}</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma chave cadastrada.</p>
          )}
        </div>

        {/* Histórico de saques */}
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ArrowDownToLine className="h-4 w-4 text-primary" /> Meus saques
          </div>
          {withdrawals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum saque ainda.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg bg-background p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{fmt(w.amount_cents)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(w.created_at).toLocaleString("pt-BR")} · {w.pix_key}
                    </div>
                    {w.rejection_reason && (
                      <div className="mt-1 text-[11px] text-destructive">
                        Motivo: {w.rejection_reason}
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
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Chave PIX */}
      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave PIX para saque</DialogTitle>
            <DialogDescription>
              Esta chave receberá os pagamentos quando você solicitar saque. Os dados do titular
              precisam bater com o KYC aprovado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de chave</Label>
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
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input
                value={keyForm.pix_key}
                onChange={(e) => setKeyForm((f) => ({ ...f, pix_key: e.target.value }))}
                placeholder="Digite a chave"
              />
            </div>
            <div>
              <Label>Nome do titular</Label>
              <Input
                value={keyForm.holder_name}
                onChange={(e) => setKeyForm((f) => ({ ...f, holder_name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>CPF/CNPJ do titular</Label>
              <Input
                value={keyForm.holder_document}
                onChange={(e) => setKeyForm((f) => ({ ...f, holder_document: e.target.value }))}
                placeholder="Apenas números"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKeyOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveKey} disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Solicitar saque */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar saque</DialogTitle>
            <DialogDescription>
              Saque mínimo: R$ 30,00 · Disponível: {fmt(balance?.available_cents ?? 0)} · Será
              enviado para: <strong>{key?.pix_key}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="30"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setAmountStr(((balance?.available_cents ?? 0) / 100).toFixed(2))
                }
              >
                Sacar tudo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Após solicitar, o admin aprova e o PIX é enviado em até 1 dia útil.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRequest} disabled={submitting}>
              {submitting ? "Enviando..." : "Solicitar"}
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
  const map = {
    pending: { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-600", Icon: Clock },
    approved: { label: "Aprovado", cls: "bg-blue-500/15 text-blue-600", Icon: CheckCircle2 },
    processing: { label: "Processando", cls: "bg-blue-500/15 text-blue-600", Icon: Clock },
    paid: { label: "Pago", cls: "bg-green-500/15 text-green-600", Icon: CheckCircle2 },
    rejected: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive", Icon: XCircle },
    canceled: { label: "Cancelado", cls: "bg-muted text-muted-foreground", Icon: XCircle },
  } as const;
  const m = map[status];
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>
      <m.Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

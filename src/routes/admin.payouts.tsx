import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { requireAdminServer } from "@/server/admin.functions";
import { useEffect, useState, useCallback } from "react";
import { ArrowDownToLine, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  markWithdrawalPaid,
  rejectWithdrawal,
} from "@/server/withdrawals.functions";

export const Route = createFileRoute("/admin/payouts")({
  component: AdminPayoutsPage,
});

interface WithdrawalRow {
  id: string;
  creator_id: string;
  amount_cents: number;
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
}

interface CreatorMini {
  user_id: string;
  username: string;
  display_name: string | null;
}

const fmt = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function AdminPayoutsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [items, setItems] = useState<WithdrawalRow[]>([]);
  const [creators, setCreators] = useState<Record<string, CreatorMini>>({});
  const [tab, setTab] = useState<"pending" | "approved" | "paid" | "rejected">("pending");

  const [paying, setPaying] = useState<WithdrawalRow | null>(null);
  const [rejecting, setRejecting] = useState<WithdrawalRow | null>(null);
  const [reason, setReason] = useState("");
  const [receipt, setReceipt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const approveFn = useServerFn(approveWithdrawal);
  const payFn = useServerFn(markWithdrawalPaid);
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

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

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
      toast.success("Aprovado. Agora pague o PIX e marque como pago.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handlePay = async () => {
    if (!paying) return;
    setSubmitting(true);
    try {
      await payFn({
        data: {
          withdrawal_id: paying.id,
          receipt_url: receipt || null,
          notes: null,
        },
      });
      toast.success("Saque marcado como pago");
      setPaying(null);
      setReceipt("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejecting || reason.trim().length < 3) return;
    setSubmitting(true);
    try {
      await rejectFn({ data: { withdrawal_id: rejecting.id, reason: reason.trim() } });
      toast.success("Saque rejeitado");
      setRejecting(null);
      setReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Saques (Admin)</h1>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pending">
              Pendentes ({items.filter((w) => w.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Em pagamento (
              {items.filter((w) => w.status === "approved" || w.status === "processing").length})
            </TabsTrigger>
            <TabsTrigger value="paid">Pagos</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados/Cancelados</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-3">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum item nesta lista.</p>
            )}
            {filtered.map((w) => {
              const c = creators[w.creator_id];
              return (
                <div key={w.id} className="rounded-xl bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-bold text-foreground">{fmt(w.amount_cents)}</div>
                      <div className="text-xs text-muted-foreground">
                        {c ? `@${c.username}` : w.creator_id} ·{" "}
                        {new Date(w.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {w.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(w.id)}>
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRejecting(w)}
                          >
                            Rejeitar
                          </Button>
                        </>
                      )}
                      {(w.status === "approved" || w.status === "processing") && (
                        <Button size="sm" onClick={() => setPaying(w)}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Marcar como pago
                        </Button>
                      )}
                      {w.status === "paid" && w.receipt_url && (
                        <a
                          href={w.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline flex items-center gap-1"
                        >
                          Comprovante <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 rounded-lg bg-background p-3 text-xs sm:grid-cols-2">
                    <Field label="Tipo" value={w.pix_key_type.toUpperCase()} />
                    <Field label="Chave PIX" value={w.pix_key} onCopy={() => copy(w.pix_key)} />
                    <Field label="Titular" value={w.holder_name} />
                    <Field
                      label="CPF/CNPJ"
                      value={w.holder_document}
                      onCopy={() => copy(w.holder_document)}
                    />
                  </div>

                  {w.rejection_reason && (
                    <div className="mt-2 text-xs text-destructive">
                      Rejeição: {w.rejection_reason}
                    </div>
                  )}
                  {w.paid_at && (
                    <div className="mt-2 text-xs text-green-600">
                      Pago em {new Date(w.paid_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal pagar */}
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
            <DialogDescription>
              Confirme que você enviou o PIX de {paying && fmt(paying.amount_cents)} para{" "}
              <strong>{paying?.pix_key}</strong>. Isso debita o saldo da criadora.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Link do comprovante (opcional)</Label>
            <Input
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaying(null)}>
              Cancelar
            </Button>
            <Button onClick={handlePay} disabled={submitting}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal rejeitar */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar saque</DialogTitle>
            <DialogDescription>
              Informe o motivo. A criadora verá esse texto no histórico.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: chave PIX não bate com o nome do KYC"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting || reason.trim().length < 3}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
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

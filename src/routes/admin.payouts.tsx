import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { requireAdminServer } from "@/_server/admin.functions";
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
  markWithdrawalPaid,
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

const fmt = (cents: number, locale: Locale) =>
  `R$ ${(cents / 100).toLocaleString(locale, { minimumFractionDigits: 2 })}`;

function AdminPayoutsPage() {
  const { locale, tr } = useI18n();
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
      toast.success(
        tr(
          "Aprovado. Agora pague o Pix e marque como pago.",
          "Approved. Send the Pix payment, then mark it as paid.",
        ),
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro", "Error"));
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
      toast.success(tr("Saque marcado como pago", "Withdrawal marked as paid"));
      setPaying(null);
      setReceipt("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro", "Error"));
    } finally {
      setSubmitting(false);
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
                        {fmt(w.amount_cents, locale)}
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
                        <Button size="sm" onClick={() => setPaying(w)}>
                          <Check className="mr-1 h-3.5 w-3.5" />{" "}
                          {tr("Marcar como pago", "Mark as paid")}
                        </Button>
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

      {/* Modal pagar */}
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Marcar como pago", "Mark as paid")}</DialogTitle>
            <DialogDescription>
              {tr("Confirme que você enviou o Pix de", "Confirm that you sent the Pix payment of")}{" "}
              {paying && fmt(paying.amount_cents, locale)} {tr("para", "to")}{" "}
              <strong>{paying?.pix_key}</strong>.{" "}
              {tr("Isso debita o saldo da criadora.", "This deducts the creator's balance.")}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>{tr("Link do comprovante (opcional)", "Receipt link (optional)")}</Label>
            <Input
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaying(null)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={handlePay} disabled={submitting}>
              {tr("Confirmar pagamento", "Confirm payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

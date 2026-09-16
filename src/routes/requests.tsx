import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PixCheckoutModal, type PixCharge } from "@/components/PixCheckoutModal";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  cancelCustomRequest,
  createCustomRequestPixCharge,
  listMyCustomRequests,
} from "@/_server/custom-requests.functions";

export const Route = createFileRoute("/requests")({
  head: () => ({ meta: [{ title: "Meus pedidos" }] }),
  component: MyRequestsPage,
});

type Row = Awaited<ReturnType<typeof listMyCustomRequests>>["requests"][number];

const fmt = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const STATUS: Record<Row["status"], { pt: string; en: string; tone: string }> = {
  pending: { pt: "Aguardando resposta", en: "Awaiting reply", tone: "bg-muted text-muted-foreground" },
  accepted: { pt: "Aceito — pague para começar", en: "Accepted — pay to start", tone: "bg-primary/15 text-primary" },
  paid: { pt: "Pago — em produção", en: "Paid — in progress", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  delivered: { pt: "Entregue", en: "Delivered", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  declined: { pt: "Recusado", en: "Declined", tone: "bg-destructive/10 text-destructive" },
  cancelled: { pt: "Cancelado", en: "Cancelled", tone: "bg-muted text-muted-foreground" },
};

export function MyRequestsPage() {
  const { tr } = useI18n();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const listFn = useServerFn(listMyCustomRequests);
  const payFn = useServerFn(createCustomRequestPixCharge);
  const cancelFn = useServerFn(cancelCustomRequest);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const load = useCallback(async () => {
    try {
      const r = await listFn();
      setRows(r.requests);
    } catch {
      toast.error(tr("Não foi possível carregar seus pedidos.", "Couldn't load your requests."));
    } finally {
      setLoaded(true);
    }
  }, [listFn, tr]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const pay = async (row: Row) => {
    setBusy(row.id);
    try {
      const res = await payFn({ data: { requestId: row.id } });
      if (!("ok" in res) || !res.ok) {
        toast.error((res as { error?: string }).error ?? tr("Não foi possível gerar o Pix.", "Couldn't create the Pix charge."));
        return;
      }
      setPayingId(row.id);
      setCharge({ chargeId: res.chargeId, qrCode: res.qrCode, qrCodeBase64: res.qrCodeBase64, amountCents: res.amountCents });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Não foi possível gerar o Pix.", "Couldn't create the Pix charge."));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (row: Row) => {
    if (!confirm(tr("Cancelar este pedido?", "Cancel this request?"))) return;
    setBusy(row.id);
    try {
      const res = await cancelFn({ data: { requestId: row.id } });
      if (!res.ok) toast.error(res.error);
      else toast.success(tr("Pedido cancelado.", "Request cancelled."));
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{tr("Meus pedidos personalizados", "My custom requests")}</h1>
        </div>

        {!loaded ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Carregando...", "Loading...")}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
            {tr(
              "Você ainda não fez nenhum pedido. No perfil de uma criadora que aceita pedidos, toque em “Pedido personalizado”.",
              "You haven't made any requests yet. On a creator's profile that accepts requests, tap “Custom request”.",
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const st = STATUS[r.status];
              const name = r.counterpart?.display_name || r.counterpart?.username || tr("Criadora", "Creator");
              return (
                <div key={r.id} className="space-y-3 rounded-2xl bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {name} · <span className="text-primary">{fmt(r.amount_cents)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <Badge className={`${st.tone} border-0`}>{tr(st.pt, st.en)}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{r.description}</p>
                  {r.creator_note && (
                    <p className="rounded-xl bg-background p-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{tr("Resposta da criadora:", "Creator's reply:")}</span> {r.creator_note}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {r.status === "accepted" && (
                      <Button size="sm" onClick={() => pay(r)} disabled={busy === r.id} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : tr(`Pagar ${fmt(r.amount_cents)} via Pix`, `Pay ${fmt(r.amount_cents)} via Pix`)}
                      </Button>
                    )}
                    {(r.status === "pending" || r.status === "accepted") && (
                      <Button size="sm" variant="outline" onClick={() => cancel(r)} disabled={busy === r.id}>
                        {tr("Cancelar pedido", "Cancel request")}
                      </Button>
                    )}
                    {(r.status === "paid" || r.status === "delivered") && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/chat" search={{ with: r.creator_id } as never}>
                          <MessageCircle className="mr-1.5 h-4 w-4" /> {tr("Abrir chat", "Open chat")}
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

      <PixCheckoutModal
        open={!!charge}
        onOpenChange={(v) => {
          if (!v) {
            setCharge(null);
            setPayingId(null);
          }
        }}
        title={tr("Pagar pedido personalizado", "Pay custom request")}
        charge={charge}
        onPaid={() => {
          toast.success(tr("Pagamento confirmado! A criadora já foi avisada.", "Payment confirmed! The creator has been notified."));
          setCharge(null);
          setPayingId(null);
          void load();
        }}
      />
      {payingId && null}
    </AppShell>
  );
}

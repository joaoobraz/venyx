import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, MessageCircle, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  getCreatorRequestSettings,
  listCreatorCustomRequests,
  markCustomRequestDelivered,
  respondCustomRequest,
  upsertMyRequestSettings,
} from "@/_server/custom-requests.functions";

export const Route = createFileRoute("/creator/requests")({
  head: () => ({ meta: [{ title: "Pedidos personalizados" }] }),
  component: CreatorRequestsPage,
});

type Row = Awaited<ReturnType<typeof listCreatorCustomRequests>>["requests"][number];
type Tab = "pending" | "accepted" | "paid" | "done";

const fmt = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const toCents = (s: string) => Math.round(Number.parseFloat(s.replace(",", ".")) * 100);

const STATUS: Record<Row["status"], { pt: string; en: string; tone: string }> = {
  pending: { pt: "Aguardando sua resposta", en: "Awaiting your reply", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  accepted: { pt: "Aceito — aguardando pagamento", en: "Accepted — awaiting payment", tone: "bg-primary/15 text-primary" },
  paid: { pt: "Pago — entregar no chat", en: "Paid — deliver in chat", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  delivered: { pt: "Entregue", en: "Delivered", tone: "bg-muted text-muted-foreground" },
  declined: { pt: "Recusado", en: "Declined", tone: "bg-muted text-muted-foreground" },
  cancelled: { pt: "Cancelado pelo fã", en: "Cancelled by fan", tone: "bg-muted text-muted-foreground" },
};

function CreatorRequestsPage() {
  const { tr } = useI18n();
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();
  const settingsFn = useServerFn(getCreatorRequestSettings);
  const saveSettingsFn = useServerFn(upsertMyRequestSettings);
  const listFn = useServerFn(listCreatorCustomRequests);
  const respondFn = useServerFn(respondCustomRequest);
  const deliverFn = useServerFn(markCustomRequestDelivered);

  const [enabled, setEnabled] = useState(false);
  const [minStr, setMinStr] = useState("50,00");
  const [instructions, setInstructions] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [replying, setReplying] = useState<{ id: string; action: "accept" | "decline" } | null>(null);
  const [note, setNote] = useState("");
  const [priceStr, setPriceStr] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  const load = useCallback(async () => {
    if (!user) return;
    const [s, l] = await Promise.all([settingsFn({ data: { creatorId: user.id } }), listFn()]);
    setEnabled(s.enabled);
    setMinStr((s.min_price_cents / 100).toFixed(2).replace(".", ","));
    setInstructions(s.instructions);
    setRows(l.requests);
  }, [user, settingsFn, listFn]);

  useEffect(() => {
    if (user && isCreator) void load().catch(() => toast.error(tr("Não foi possível carregar.", "Couldn't load.")));
  }, [user, isCreator, load, tr]);

  const saveSettings = async () => {
    const min = toCents(minStr);
    if (Number.isNaN(min) || min < 100) {
      toast.error(tr("Valor mínimo deve ser de pelo menos R$ 1,00.", "Minimum must be at least R$ 1.00."));
      return;
    }
    setSavingSettings(true);
    try {
      const r = await saveSettingsFn({ data: { enabled, min_price_cents: min, instructions } });
      if (!r.ok) toast.error(r.error);
      else
        toast.success(
          enabled
            ? tr("Pedidos personalizados ATIVADOS. O botão já aparece no seu perfil.", "Custom requests ON. The button is live on your profile.")
            : tr("Pedidos personalizados desativados.", "Custom requests off."),
        );
    } finally {
      setSavingSettings(false);
    }
  };

  const openReply = (row: Row, action: "accept" | "decline") => {
    setReplying({ id: row.id, action });
    setNote("");
    setPriceStr((row.amount_cents / 100).toFixed(2).replace(".", ","));
  };

  const sendReply = async () => {
    if (!replying) return;
    const price = replying.action === "accept" ? toCents(priceStr) : undefined;
    if (replying.action === "accept" && (Number.isNaN(price!) || price! < 100)) {
      toast.error(tr("Valor inválido.", "Invalid amount."));
      return;
    }
    setBusy(replying.id);
    try {
      const r = await respondFn({
        data: { requestId: replying.id, action: replying.action, note: note.trim() || undefined, amountCents: price },
      });
      if (!r.ok) toast.error(r.error);
      else
        toast.success(
          replying.action === "accept"
            ? tr("Pedido aceito. O fã foi avisado para pagar.", "Request accepted. The fan was asked to pay.")
            : tr("Pedido recusado.", "Request declined."),
        );
      setReplying(null);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const deliver = async (row: Row) => {
    if (!confirm(tr("Confirmar que você já entregou o conteúdo no chat?", "Confirm you already delivered the content in the chat?"))) return;
    setBusy(row.id);
    try {
      const r = await deliverFn({ data: { requestId: row.id } });
      if (!r.ok) toast.error(r.error);
      else toast.success(tr("Marcado como entregue.", "Marked as delivered."));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const filtered = rows.filter((r) => {
    if (tab === "pending") return r.status === "pending";
    if (tab === "accepted") return r.status === "accepted";
    if (tab === "paid") return r.status === "paid";
    return r.status === "delivered" || r.status === "declined" || r.status === "cancelled";
  });
  const count = (t: Tab) =>
    rows.filter((r) =>
      t === "pending" ? r.status === "pending" : t === "accepted" ? r.status === "accepted" : t === "paid" ? r.status === "paid" : ["delivered", "declined", "cancelled"].includes(r.status),
    ).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{tr("Pedidos personalizados", "Custom requests")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {tr(
            "Conteúdo sob encomenda: o fã descreve o que quer e oferece um valor. Você aceita (podendo ajustar o preço) ou recusa; ele paga via Pix e você entrega no chat. Ticket alto, zero risco — o pagamento vem antes de produzir.",
            "Made-to-order content: the fan describes what they want and offers a price. You accept (optionally adjusting the price) or decline; they pay via Pix and you deliver in the chat.",
          )}
        </p>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">{tr("Aceitar pedidos personalizados", "Accept custom requests")}</p>
              <p className="text-xs text-muted-foreground">{tr("Mostra o botão “Pedido personalizado” no seu perfil.", "Shows the “Custom request” button on your profile.")}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div>
              <Label htmlFor="req-min">{tr("Valor mínimo (R$)", "Minimum price (R$)")}</Label>
              <Input id="req-min" inputMode="decimal" value={minStr} onChange={(e) => setMinStr(e.target.value.replace(/[^\d,.]/g, ""))} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="req-rules">{tr("Regras / o que você faz e não faz (opcional)", "Rules / what you do and don't do (optional)")}</Label>
              <Textarea
                id="req-rules"
                rows={3}
                maxLength={600}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={tr("Ex.: vídeos de até 3 min, entrega em 48h, não faço conteúdo com terceiros.", "E.g. videos up to 3 min, delivery in 48h.")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Salvar configurações", "Save settings")}
            </Button>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          {(["pending", "accepted", "paid", "done"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${tab === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t === "pending" ? tr("Novos", "New") : t === "accepted" ? tr("Aguardando pagamento", "Awaiting payment") : t === "paid" ? tr("Para entregar", "To deliver") : tr("Finalizados", "Finished")} ({count(t)})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">{tr("Nada por aqui.", "Nothing here.")}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const st = STATUS[r.status];
              const name = r.counterpart?.display_name || r.counterpart?.username || tr("Fã", "Fan");
              const isReplying = replying?.id === r.id;
              return (
                <div key={r.id} className="space-y-3 rounded-2xl bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {name}
                        {r.counterpart?.username && <span className="text-muted-foreground"> @{r.counterpart.username}</span>} ·{" "}
                        <span className="text-primary">{fmt(r.amount_cents)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <Badge className={`${st.tone} border-0`}>{tr(st.pt, st.en)}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{r.description}</p>
                  {r.creator_note && <p className="text-xs text-muted-foreground">{tr("Sua resposta:", "Your reply:")} {r.creator_note}</p>}

                  {isReplying ? (
                    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                      {replying.action === "accept" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Label htmlFor={`price-${r.id}`} className="text-xs">{tr("Valor final (R$)", "Final price (R$)")}</Label>
                          <Input id={`price-${r.id}`} inputMode="decimal" value={priceStr} onChange={(e) => setPriceStr(e.target.value.replace(/[^\d,.]/g, ""))} className="h-8 w-32" />
                          <span className="text-[11px] text-muted-foreground">{tr("Pode ajustar; o fã vê o valor antes de pagar.", "You may adjust; the fan sees it before paying.")}</span>
                        </div>
                      )}
                      <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={replying.action === "accept" ? tr("Mensagem para o fã (opcional): prazo, detalhes…", "Message to the fan (optional)") : tr("Motivo (opcional)", "Reason (optional)")} />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setReplying(null)} disabled={busy === r.id}>{tr("Voltar", "Back")}</Button>
                        <Button size="sm" onClick={sendReply} disabled={busy === r.id} className={replying.action === "accept" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""} variant={replying.action === "accept" ? "default" : "destructive"}>
                          {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : replying.action === "accept" ? tr("Confirmar aceite", "Confirm accept") : tr("Confirmar recusa", "Confirm decline")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => openReply(r, "accept")} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <Check className="mr-1.5 h-4 w-4" /> {tr("Aceitar", "Accept")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openReply(r, "decline")}>
                            <X className="mr-1.5 h-4 w-4" /> {tr("Recusar", "Decline")}
                          </Button>
                        </>
                      )}
                      {(r.status === "paid" || r.status === "accepted" || r.status === "delivered") && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/chat" search={{ with: r.fan_id } as never}>
                            <MessageCircle className="mr-1.5 h-4 w-4" /> {tr("Abrir chat", "Open chat")}
                          </Link>
                        </Button>
                      )}
                      {r.status === "paid" && (
                        <Button size="sm" onClick={() => deliver(r)} disabled={busy === r.id} className="bg-primary text-primary-foreground hover:bg-primary/90">
                          {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Marcar como entregue", "Mark as delivered")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

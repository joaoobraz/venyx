import { useEffect, useRef, useState } from "react";
import { Heart, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth";
import { createTipPixCharge, getChargeStatus } from "@/_server/checkout.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { DEMO_MODE } from "@/lib/demo-creators";
import { recordDemoTip } from "@/lib/demo-tips";
import { addDemoNotification } from "@/lib/demo-notifications";

const QUICK = [500, 1000, 2500, 5000];

type Step = "form" | "pix";

export function TipModal({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  postId,
  giftItem,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  postId?: string;
  giftItem?: { id: string; title: string; amountCents: number; emoji?: string };
}) {
  const { user, session } = useAuth();
  const { tr } = useI18n();
  const createChargeFn = useServerFn(createTipPixCharge);
  const getStatusFn = useServerFn(getChargeStatus);

  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [pix, setPix] = useState<{
    chargeId: string;
    qrCode: string | null;
    qrCodeBase64: string | null;
    amountCents: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [understoodGift, setUnderstoodGift] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLocalTip = DEMO_MODE && creatorId.startsWith("demo-");

  useEffect(() => {
    if (!open) {
      setStep("form");
      setPix(null);
      setMsg("");
      setCustom("");
      setCopied(false);
      setUnderstoodGift(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const send = async () => {
    if (!user) {
      toast.error(tr("Faça login para enviar mimo.", "Sign in to send a tip."));
      return;
    }
    const finalCents =
      giftItem?.amountCents ?? (custom ? Math.round(parseFloat(custom) * 100) : amount);
    if (!finalCents || finalCents < 100) {
      toast.error(tr("Valor mínimo: R$ 1,00", "Minimum amount: R$ 1.00"));
      return;
    }
    if (giftItem && !understoodGift) {
      toast.error(
        tr(
          "Confirme que entendeu como o mimo simbólico funciona.",
          "Confirm that you understand how the symbolic gift works.",
        ),
      );
      return;
    }
    if (isLocalTip) {
      setBusy(true);
      recordDemoTip({
        userId: user.id,
        creatorId,
        creatorName,
        postId,
        amountCents: finalCents,
        message: giftItem ? `${giftItem.title}${msg.trim() ? ` — ${msg.trim()}` : ""}` : msg,
      });
      addDemoNotification(user.id, {
        type: "sale",
        title: `Mimo enviado para ${creatorName}`,
        title_en: `Tip sent to ${creatorName}`,
        body: `A carteira da Modelo recebeu R$ ${(finalCents / 100).toFixed(2)} na demonstração.`,
        body_en: `The Creator wallet received BRL ${(finalCents / 100).toFixed(2)} in the demo.`,
        link: "/presentation/wallet",
      });
      toast.success(
        tr(
          `Mimo de R$ ${(finalCents / 100).toFixed(2)} enviado para ${creatorName}!`,
          `R$ ${(finalCents / 100).toFixed(2)} tip sent to ${creatorName}!`,
        ),
      );
      setBusy(false);
      onOpenChange(false);
      return;
    }
    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
    if (!authHeaders) {
      toast.error(tr("Faça login para enviar mimo.", "Sign in to send a tip."));
      return;
    }
    setBusy(true);
    try {
      const res = await createChargeFn({
        data: {
          creatorId,
          amountCents: finalCents,
          postId: postId ?? null,
          message: msg || null,
          giftItemId: giftItem?.id,
        },
        headers: authHeaders,
      });

      if ("ok" in res && res.ok === false) {
        toast.error(
          res.error || tr("Não foi possível gerar o Pix.", "We couldn't create the Pix charge."),
        );
        return;
      }

      if ("chargeId" in res) {
        setPix({
          chargeId: res.chargeId,
          qrCode: res.qrCode,
          qrCodeBase64: res.qrCodeBase64,
          amountCents: res.amountCents,
        });
        setStep("pix");
        pollRef.current = setInterval(async () => {
          try {
            const s = await getStatusFn({ data: { chargeId: res.chargeId }, headers: authHeaders });
            if (s.status === "paid") {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.success(
                tr(
                  giftItem
                    ? `${giftItem.title} enviado para ${creatorName}!`
                    : `Mimo de R$ ${(finalCents / 100).toFixed(2)} enviado para ${creatorName}!`,
                  giftItem
                    ? `${giftItem.title} sent to ${creatorName}!`
                    : `R$ ${(finalCents / 100).toFixed(2)} tip sent to ${creatorName}!`,
                ),
              );
              onOpenChange(false);
            } else if (s.status === "expired" || s.status === "cancelled") {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.error(
                tr("Pix expirou. Gere uma nova cobrança.", "Pix expired. Create a new charge."),
              );
              setStep("form");
              setPix(null);
            }
          } catch (err) {
            console.error(err);
          }
        }, 4000);
      }
    } catch (e) {
      console.error("[TipModal] error", e);
      if (e instanceof Response) {
        if (e.status === 401)
          toast.error(tr("Faça login para enviar mimo.", "Sign in to send a tip."));
        else {
          const txt = await e.text().catch(() => "");
          toast.error(txt || `Erro ${e.status}`);
        }
      } else {
        toast.error(
          e instanceof Error ? e.message : tr("Erro ao enviar mimo", "Could not send tip"),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const copyPix = () => {
    if (!pix?.qrCode) return;
    navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            {step === "pix"
              ? tr("Pague com Pix", "Pay with Pix")
              : giftItem
                ? tr(`Enviar mimo para ${creatorName}`, `Send a gift to ${creatorName}`)
                : tr(`Enviar mimo para ${creatorName}`, `Send a tip to ${creatorName}`)}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            {giftItem ? (
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-2xl">
                    {giftItem.emoji || "🎁"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground">{giftItem.title}</div>
                    <div className="text-xl font-bold text-primary">
                      R$ {(giftItem.amountCents / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setAmount(v);
                        setCustom("");
                      }}
                      className={`rounded-xl border-2 p-3 text-sm font-bold transition-all ${
                        amount === v && !custom
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/50"
                      }`}
                    >
                      R$ {(v / 100).toFixed(0)}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {tr("Valor personalizado (R$)", "Custom amount (R$)")}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="0.50"
                    placeholder={tr("Outro valor...", "Other amount...")}
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {tr("Mensagem (opcional)", "Message (optional)")}
              </label>
              <Textarea
                placeholder={tr("Você é incrível! 💜", "You're amazing! 💜")}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                maxLength={200}
                className="resize-none"
              />
            </div>
            {giftItem && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-foreground">
                <Checkbox
                  className="mt-0.5"
                  checked={understoodGift}
                  onCheckedChange={(value) => setUnderstoodGift(value === true)}
                />
                <span>
                  {tr(
                    "Entendi que este é um mimo simbólico: nenhum produto físico será comprado ou enviado, e a criadora receberá o valor líquido na carteira após as taxas.",
                    "I understand this is a symbolic gift: no physical product is purchased or shipped, and the creator receives the net amount in her wallet after fees.",
                  )}
                </span>
              </label>
            )}
            <Button
              onClick={send}
              disabled={busy || (!!giftItem && !understoodGift)}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLocalTip ? (
                giftItem ? (
                  tr("🎁 Enviar mimo simbólico", "🎁 Send symbolic gift")
                ) : (
                  tr("💝 Enviar mimo", "💝 Send tip")
                )
              ) : giftItem ? (
                tr("🎁 Enviar este mimo com Pix", "🎁 Send this gift with Pix")
              ) : (
                tr("💝 Pagar com Pix", "💝 Pay with Pix")
              )}
            </Button>
          </div>
        )}

        {step === "pix" && pix && (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted p-3 text-center text-sm">
              <div className="text-xs text-muted-foreground">{tr("Total", "Total")}</div>
              <div className="text-2xl font-bold text-foreground">
                R$ {(pix.amountCents / 100).toFixed(2)}
              </div>
            </div>

            {pix.qrCode ? (
              <div className="flex justify-center">
                <div className="rounded-lg border bg-white p-3">
                  <QRCodeSVG value={pix.qrCode} size={208} level="M" />
                </div>
              </div>
            ) : pix.qrCodeBase64 ? (
              <div className="flex justify-center">
                <img
                  src={
                    pix.qrCodeBase64.startsWith("data:") || pix.qrCodeBase64.startsWith("http")
                      ? pix.qrCodeBase64
                      : `data:image/png;base64,${pix.qrCodeBase64}`
                  }
                  alt="QR Code Pix"
                  className="h-56 w-56 rounded-lg border bg-white p-2"
                />
              </div>
            ) : null}

            {pix.qrCode && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {tr("Ou copie o código Pix:", "Or copy the Pix code:")}
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={pix.qrCode}
                    className="flex-1 rounded-lg border bg-muted px-2 py-1.5 text-xs font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={copyPix}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {tr("Aguardando pagamento…", "Waiting for payment…")}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

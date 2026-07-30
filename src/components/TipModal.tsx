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

const QUICK = [500, 1000, 2500, 5000];

type Step = "form" | "pix";

export function TipModal({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  postId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  postId?: string;
}) {
  const { user, session } = useAuth();
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setPix(null);
      setMsg("");
      setCustom("");
      setCopied(false);
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
      toast.error("Faça login para enviar mimo.");
      return;
    }
    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
    if (!authHeaders) {
      toast.error("Faça login para enviar mimo.");
      return;
    }
    const finalCents = custom ? Math.round(parseFloat(custom) * 100) : amount;
    if (!finalCents || finalCents < 100) {
      toast.error("Valor mínimo: R$ 1,00");
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
        },
        headers: authHeaders,
      });

      if ("ok" in res && res.ok === false) {
        toast.error(res.error || "Não foi possível gerar o Pix.");
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
              toast.success(`Mimo de R$ ${(finalCents / 100).toFixed(2)} enviado para ${creatorName}!`);
              onOpenChange(false);
            } else if (s.status === "expired" || s.status === "cancelled") {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.error("Pix expirou. Gere uma nova cobrança.");
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
        if (e.status === 401) toast.error("Faça login para enviar mimo.");
        else {
          const txt = await e.text().catch(() => "");
          toast.error(txt || `Erro ${e.status}`);
        }
      } else {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar mimo");
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
            {step === "pix" ? "Pague com Pix" : `Enviar mimo para ${creatorName}`}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
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
              <label className="mb-1 block text-xs text-muted-foreground">Valor personalizado (R$)</label>
              <Input
                type="number"
                min="1"
                step="0.50"
                placeholder="Outro valor..."
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Mensagem (opcional)</label>
              <Textarea
                placeholder="Você é incrível! 💜"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                maxLength={200}
                className="resize-none"
              />
            </div>
            <Button
              onClick={send}
              disabled={busy}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "💝 Pagar com Pix"}
            </Button>
          </div>
        )}

        {step === "pix" && pix && (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted p-3 text-center text-sm">
              <div className="text-xs text-muted-foreground">Total</div>
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
                <p className="text-xs text-muted-foreground">Ou copie o código Pix:</p>
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
              Aguardando pagamento…
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

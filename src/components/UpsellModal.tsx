import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getEligiblePostPurchaseUpsell } from "@/server/upsells.functions";
import { createUpsellPixCharge, getChargeStatus } from "@/server/checkout.functions";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Offer {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
}

type Step = "offer" | "pix";

export function UpsellModal({
  open,
  onOpenChange,
  creatorId,
  creatorName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
}) {
  const { session } = useAuth();
  const getEligibleFn = useServerFn(getEligiblePostPurchaseUpsell);
  const createUpsellFn = useServerFn(createUpsellPixCharge);
  const getStatusFn = useServerFn(getChargeStatus);

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("offer");
  const [pix, setPix] = useState<{
    chargeId: string;
    qrCode: string | null;
    qrCodeBase64: string | null;
    amountCents: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setOffer(null);
      setStep("offer");
      setPix(null);
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
    if (!authHeaders) {
      onOpenChange(false);
      return;
    }
    setLoading(true);
    getEligibleFn({ data: { creatorId }, headers: authHeaders })
      .then((res) => {
        if (res.offer) setOffer(res.offer as Offer);
        else onOpenChange(false); // sem oferta → não abre
      })
      .catch(() => onOpenChange(false))
      .finally(() => setLoading(false));
  }, [open, creatorId, session?.access_token, getEligibleFn, onOpenChange]);

  const accept = async () => {
    if (!offer) return;
    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
    if (!authHeaders) {
      toast.error("Faça login para continuar.");
      return;
    }
    setBusy(true);
    try {
      const res = await createUpsellFn({ data: { offerId: offer.id }, headers: authHeaders });
      if (!("chargeId" in res)) {
        toast.error("error" in res ? res.error : "Não foi possível gerar o Pix. Tente novamente.");
        return;
      }
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
            toast.success("Upsell desbloqueado! Aproveite 🔥");
            onOpenChange(false);
          } else if (s.status === "expired" || s.status === "cancelled") {
            if (pollRef.current) clearInterval(pollRef.current);
            toast.error("Este Pix expirou. Gere uma nova cobrança.");
            setStep("offer");
            setPix(null);
          }
        } catch (e) { console.error(e); }
      }, 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
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

  if (loading || !offer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0 overflow-hidden">
        {step === "offer" && (
          <div className="bg-gradient-to-br from-accent/20 via-card to-primary/10 p-6">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
              <Sparkles className="h-4 w-4" /> Oferta única — só agora
            </div>

            <h2 className="mt-3 text-2xl font-extrabold leading-tight text-foreground">
              {offer.title}
            </h2>
            {offer.description && (
              <p className="mt-2 text-sm text-muted-foreground">{offer.description}</p>
            )}

            <div className="mt-5 rounded-2xl bg-card p-4 text-center shadow-elegant">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Preço especial</div>
              <div className="mt-1 text-3xl font-extrabold text-primary">
                R$ {(offer.price_cents / 100).toFixed(2)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Exclusivo para quem acabou de assinar {creatorName}
              </div>
            </div>

            <Button
              onClick={accept}
              disabled={busy}
              className="mt-5 h-12 w-full bg-gradient-primary text-primary-foreground text-base font-bold shadow-glow hover:opacity-95"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "🔥 Sim, eu quero!"}
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              className="mt-2 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Não, obrigado
            </button>
          </div>
        )}

        {step === "pix" && pix && (
          <div className="space-y-3 p-6">
            <h2 className="text-lg font-bold text-foreground">Pague com Pix</h2>
            <div className="rounded-xl bg-muted p-3 text-center">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-bold text-foreground">
                R$ {(pix.amountCents / 100).toFixed(2)}
              </div>
            </div>
            {pix.qrCodeBase64 ? (
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${pix.qrCodeBase64}`}
                  alt="QR Code Pix"
                  className="h-56 w-56 rounded-lg border bg-white p-2"
                />
              </div>
            ) : pix.qrCode ? (
              <div className="flex justify-center">
                <div className="rounded-lg border bg-white p-3">
                  <QRCodeSVG value={pix.qrCode} size={208} level="M" />
                </div>
              </div>
            ) : null}
            {pix.qrCode && (
              <div className="space-y-1">
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando pagamento…
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

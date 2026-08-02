import { useEffect, useRef, useState } from "react";
import { Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth";
import { getChargeStatus } from "@/_server/checkout.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { trackClientError, trackProductEvent } from "@/lib/telemetry";

export interface PixCharge {
  chargeId: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  amountCents: number;
}

/**
 * Modal genérico que exibe QR Code Pix + faz polling até pagamento confirmar.
 * Reutilizado por PPV de post, contribuição de meta e PPV no chat.
 */
export function PixCheckoutModal({
  open,
  onOpenChange,
  title,
  charge,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  charge: PixCharge | null;
  onPaid: () => void;
}) {
  const { session } = useAuth();
  const { tr } = useI18n();
  const getStatusFn = useServerFn(getChargeStatus);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || !charge) return;
    trackProductEvent("checkout_started", {
      amountRange: charge.amountCents < 5_000
        ? "under_50"
        : charge.amountCents < 20_000
          ? "50_to_199"
          : "200_plus",
    });
    const authHeaders = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
    if (!authHeaders) return;

    pollRef.current = setInterval(async () => {
      try {
        const s = await getStatusFn({ data: { chargeId: charge.chargeId }, headers: authHeaders });
        if (s.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          toast.success(tr("Pagamento confirmado!", "Payment confirmed!"));
          onPaid();
          onOpenChange(false);
        } else if (s.status === "expired" || s.status === "cancelled") {
          if (pollRef.current) clearInterval(pollRef.current);
          toast.error(tr("Pix expirou. Tente novamente.", "Pix expired. Please try again."));
          onOpenChange(false);
        }
      } catch (err) {
        console.error("[PixCheckoutModal] poll", err);
        trackClientError("client_error", err, { flow: "pix_status_poll" });
      }
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, charge, session, getStatusFn, onOpenChange, onPaid, tr]);

  const copyPix = () => {
    if (!charge?.qrCode) return;
    navigator.clipboard.writeText(charge.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {charge && (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted p-3 text-center text-sm">
              <div className="text-xs text-muted-foreground">{tr("Total", "Total")}</div>
              <div className="text-2xl font-bold text-foreground">
                R$ {(charge.amountCents / 100).toFixed(2)}
              </div>
            </div>

            {charge.qrCode ? (
              <div className="flex justify-center">
                <div className="rounded-lg border bg-white p-3">
                  <QRCodeSVG value={charge.qrCode} size={208} level="M" />
                </div>
              </div>
            ) : charge.qrCodeBase64 ? (
              <div className="flex justify-center">
                <img
                  src={
                    charge.qrCodeBase64.startsWith("data:") || charge.qrCodeBase64.startsWith("http")
                      ? charge.qrCodeBase64
                      : `data:image/png;base64,${charge.qrCodeBase64}`
                  }
                  alt="QR Code Pix"
                  className="h-56 w-56 rounded-lg border bg-white p-2"
                />
              </div>
            ) : null}

            {charge.qrCode && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {tr("Ou copie o código Pix:", "Or copy the Pix code:")}
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={charge.qrCode}
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

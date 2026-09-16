import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { createCustomRequest } from "@/_server/custom-requests.functions";
import { describeError } from "@/lib/error-message";

const fmt = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

/**
 * Fã descreve o que quer e oferece um valor. A criadora aceita ou recusa;
 * o pagamento só acontece depois do aceite (em /requests).
 */
export function CustomRequestModal({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  minPriceCents,
  instructions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  minPriceCents: number;
  instructions: string;
}) {
  const { tr } = useI18n();
  const { user, accountPaused } = useAuth();
  const createFn = useServerFn(createCustomRequest);
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setAmountStr((minPriceCents / 100).toFixed(2).replace(".", ","));
    else {
      setDescription("");
      setAmountStr("");
    }
  }, [open, minPriceCents]);

  const submit = async () => {
    if (!user) {
      toast.error(tr("Faça login para enviar um pedido.", "Sign in to send a request."));
      return;
    }
    if (accountPaused) {
      toast.info(tr("Reative sua conta antes de fazer pedidos.", "Reactivate your account first."));
      return;
    }
    const text = description.trim();
    if (text.length < 10) {
      toast.error(tr("Descreva o pedido com pelo menos 10 caracteres.", "Describe the request with at least 10 characters."));
      return;
    }
    const cents = Math.round(Number.parseFloat(amountStr.replace(",", ".")) * 100);
    if (Number.isNaN(cents) || cents < minPriceCents) {
      toast.error(tr(`Valor mínimo: ${fmt(minPriceCents)}.`, `Minimum: ${fmt(minPriceCents)}.`));
      return;
    }
    if (cents > 1_000_000) {
      toast.error(tr("Valor máximo por pedido: R$ 10.000,00.", "Maximum per request: R$ 10,000.00."));
      return;
    }
    setBusy(true);
    try {
      const res = await createFn({ data: { creatorId, description: text, amountCents: cents } });
      if (!("ok" in res) || !res.ok) {
        toast.error((res as { error?: string }).error ?? tr("Não foi possível enviar o pedido.", "Couldn't send the request."));
        return;
      }
      toast.success(
        tr(
          `Pedido enviado para ${creatorName}! Você será avisado quando ela responder — o pagamento só acontece depois do aceite.`,
          `Request sent to ${creatorName}! You'll be notified when they respond — payment happens only after acceptance.`,
        ),
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(describeError(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {tr("Pedido personalizado", "Custom request")}
          </DialogTitle>
          <DialogDescription>
            {tr(
              `Conte para ${creatorName} exatamente o que você quer. Ela responde e, se aceitar, você paga via Pix e recebe no chat.`,
              `Tell ${creatorName} exactly what you want. If they accept, you pay via Pix and receive it in the chat.`,
            )}
          </DialogDescription>
        </DialogHeader>

        {instructions && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs text-foreground">
            <p className="mb-1 font-semibold">{tr("Regras da criadora", "Creator's rules")}</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{instructions}</p>
          </div>
        )}

        <div>
          <Label htmlFor="req-desc">{tr("O que você quer?", "What do you want?")}</Label>
          <Textarea
            id="req-desc"
            rows={4}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr("Ex.: um vídeo de 2 minutos falando meu nome, com a roupa da foto de capa…", "E.g. a 2-minute video saying my name, wearing the outfit from the cover photo…")}
            className="mt-1.5"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">{description.length}/1000</p>
        </div>

        <div>
          <Label htmlFor="req-amount">{tr("Quanto você oferece (R$)", "Your offer (R$)")}</Label>
          <Input
            id="req-amount"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^\d,.]/g, ""))}
            className="mt-1.5"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tr(`Mínimo ${fmt(minPriceCents)}. A criadora pode propor outro valor ao aceitar.`, `Minimum ${fmt(minPriceCents)}. The creator may propose a different amount.`)}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tr("Cancelar", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Enviar pedido", "Send request")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

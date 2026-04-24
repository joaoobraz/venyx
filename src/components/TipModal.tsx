import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const QUICK = [500, 1000, 2500, 5000];

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
  const { user } = useAuth();
  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!user) return;
    const finalCents = custom ? Math.round(parseFloat(custom) * 100) : amount;
    if (!finalCents || finalCents < 100) {
      toast.error("Valor mínimo: R$ 1,00");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("transactions").insert({
        payer_id: user.id,
        payee_id: creatorId,
        type: "tip",
        status: "paid",
        amount_cents: finalCents,
        reference_id: postId ?? null,
        gateway: "mock",
        metadata: { message: msg || null },
      });
      if (error) throw error;
      toast.success(`Gorjeta de R$ ${(finalCents / 100).toFixed(2)} enviada para ${creatorName}!`);
      onOpenChange(false);
      setMsg("");
      setCustom("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Enviar gorjeta para {creatorName}
          </DialogTitle>
        </DialogHeader>
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "💝 Enviar gorjeta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

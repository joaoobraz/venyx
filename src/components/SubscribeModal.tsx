import { useEffect, useState } from "react";
import { Crown, Loader2, Gift, Tag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Plan {
  id: string;
  months: number;
  price_cents: number;
  discount_pct: number;
}

interface CouponInfo {
  id: string;
  code: string;
  trial_days: number | null;
  discount_pct: number | null;
  duration_months: number;
  max_uses: number;
  uses_count: number;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function SubscribeModal({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  basePriceCents,
  onSubscribed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName: string;
  basePriceCents: number;
  onSubscribed?: () => void;
}) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<number>(1);
  const [coupon, setCoupon] = useState<CouponInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("creator_id", creatorId)
      .eq("is_active", true)
      .order("months", { ascending: true })
      .then(({ data }) => {
        const list = (data as Plan[]) ?? [];
        if (list.length === 0 && basePriceCents > 0) {
          // fallback: 1 mês ao preço do perfil
          setPlans([{ id: "default", months: 1, price_cents: basePriceCents, discount_pct: 0 }]);
        } else {
          setPlans(list);
        }
        setSelected(list[0]?.months ?? 1);
      });

    const code = readCookie("venyx_coupon");
    if (code) {
      supabase
        .from("subscription_coupons")
        .select("*")
        .eq("code", code)
        .eq("creator_id", creatorId)
        .eq("is_active", true)
        .maybeSingle()
        .then(({ data }) => {
          if (data && (data as CouponInfo).uses_count < (data as CouponInfo).max_uses) {
            setCoupon(data as CouponInfo);
          }
        });
    }
  }, [open, creatorId, basePriceCents]);

  const plan = plans.find((p) => p.months === selected) ?? plans[0];
  const subtotalCents = plan ? plan.price_cents * plan.months : 0;
  const discountedCents = coupon?.discount_pct
    ? Math.round(subtotalCents * (1 - coupon.discount_pct / 100))
    : subtotalCents;
  const isTrial = !!coupon?.trial_days;

  const subscribe = async () => {
    if (!user || !plan) return;
    setBusy(true);
    try {
      const charged = isTrial ? 0 : discountedCents;
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + plan.months);
      if (isTrial && coupon?.trial_days) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + coupon.trial_days);
        if (trialEnd > periodEnd) periodEnd.setTime(trialEnd.getTime());
      }

      const { data: sub, error: se } = await supabase
        .from("subscriptions")
        .insert({
          subscriber_id: user.id,
          creator_id: creatorId,
          price_cents: plan.price_cents,
          status: "active",
          current_period_end: periodEnd.toISOString(),
        })
        .select()
        .single();
      if (se) throw se;

      if (charged > 0) {
        const { error: te } = await supabase.from("transactions").insert({
          payer_id: user.id,
          payee_id: creatorId,
          type: "subscription",
          status: "paid",
          amount_cents: charged,
          reference_id: sub.id,
          gateway: "mock",
          metadata: { months: plan.months, coupon: coupon?.code ?? null },
        });
        if (te) throw te;
      }

      if (coupon) {
        await supabase.from("coupon_redemptions").insert({ coupon_id: coupon.id, user_id: user.id });
        await supabase
          .from("subscription_coupons")
          .update({ uses_count: coupon.uses_count + 1 })
          .eq("id", coupon.id);
        document.cookie = "venyx_coupon=; path=/; max-age=0";
      }

      toast.success(isTrial ? `Trial de ${coupon?.trial_days} dias ativado!` : "Assinatura ativada!");
      onSubscribed?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg.includes("duplicate")) {
        toast.info("Você já assina esta criadora");
        onOpenChange(false);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-accent" />
            Assinar {creatorName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {coupon && (
            <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs text-accent-foreground">
              {isTrial ? <Gift className="h-4 w-4 text-accent" /> : <Tag className="h-4 w-4 text-accent" />}
              <span className="text-foreground">
                {isTrial
                  ? `🎁 Trial de ${coupon.trial_days} dias grátis aplicado!`
                  : `🏷️ ${coupon.discount_pct}% de desconto aplicado!`}
              </span>
            </div>
          )}
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta criadora ainda não definiu planos.</p>
          ) : (
            <div className="space-y-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.months)}
                  className={`flex w-full items-center justify-between rounded-xl border-2 p-3 text-left transition-all ${
                    selected === p.months
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {p.months} {p.months === 1 ? "mês" : "meses"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      R$ {(p.price_cents / 100).toFixed(2)}/mês
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-primary">
                      R$ {((p.price_cents * p.months) / 100).toFixed(2)}
                    </div>
                    {p.discount_pct > 0 && (
                      <div className="text-[10px] font-semibold text-accent">-{p.discount_pct}%</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {plan && (
            <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Total a pagar agora</span>
              <span className="text-lg font-bold text-foreground">
                {isTrial ? "GRÁTIS" : `R$ ${(discountedCents / 100).toFixed(2)}`}
              </span>
            </div>
          )}

          <Button
            onClick={subscribe}
            disabled={busy || !plan}
            className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isTrial ? "Iniciar trial grátis" : "Confirmar assinatura"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

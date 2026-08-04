import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/creator/subscription-plans")({
  component: PlansPage,
});

interface Plan {
  id: string;
  months: number;
  price_cents: number;
  discount_pct: number;
  is_active: boolean;
}

const PRESETS = [1, 3, 6, 12] as const;
type PlanMonths = (typeof PRESETS)[number];
type Discounts = Record<PlanMonths, number>;

const DEFAULT_DISCOUNTS: Discounts = { 1: 0, 3: 10, 6: 20, 12: 30 };

function PlansPage() {
  const { tr } = useI18n();
  const { user, isCreator, profile, loading } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [basePrice, setBasePrice] = useState("19.90");
  const [discounts, setDiscounts] = useState<Discounts>(DEFAULT_DISCOUNTS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("creator_id", user.id)
      .order("months");
    if (error) throw error;
    const list = (data as Plan[]) ?? [];
    setPlans(list);
    setDiscounts((current) => {
      const next = { ...current };
      for (const plan of list) {
        if (PRESETS.includes(plan.months as PlanMonths)) {
          next[plan.months as PlanMonths] = plan.discount_pct;
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (user) load().catch(() => undefined);
    if (profile?.subscription_price_cents) {
      setBasePrice((profile.subscription_price_cents / 100).toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  if (!user || !isCreator) return null;

  const planLabel = (months: PlanMonths) => {
    if (months === 1) return tr("Mensal", "Monthly");
    if (months === 3) return tr("Trimestral", "Quarterly");
    if (months === 6) return tr("Semestral", "Semiannual");
    return tr("Anual", "Annual");
  };

  const saveAll = async () => {
    setBusy(true);
    try {
      const base = Math.round(parseFloat(basePrice) * 100);
      if (!Number.isFinite(base) || base < 100) {
        toast.error(tr("Preço base mínimo: R$ 1,00", "Minimum base price: R$ 1.00"));
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ subscription_price_cents: base })
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      const rows = PRESETS.map((months) => {
        const discount = Math.min(90, Math.max(0, Math.round(discounts[months])));
        return {
          creator_id: user.id,
          months,
          price_cents: Math.round(base * (1 - discount / 100)),
          discount_pct: discount,
          is_active: true,
        };
      });
      const { error: plansError } = await supabase
        .from("subscription_plans")
        .upsert(rows, { onConflict: "creator_id,months" });
      if (plansError) throw plansError;

      toast.success(tr("Planos atualizados!", "Plans updated!"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const baseCents = Math.max(0, Math.round((parseFloat(basePrice) || 0) * 100));

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {tr("Planos de assinatura", "Subscription plans")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              "Uma única tabela: o valor mensal é a base e os demais períodos recebem o desconto que você escolher.",
              "One pricing table: the monthly price is the base and longer periods receive the discount you choose.",
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PRESETS.map((months) => {
            const unitPrice = Math.round(baseCents * (1 - discounts[months] / 100));
            const saved = plans.find((plan) => plan.months === months);
            return (
              <div key={months} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-accent" />
                  <div className="text-sm font-bold text-foreground">{planLabel(months)}</div>
                  {saved && (
                    <span className="ml-auto text-[10px] font-medium text-emerald-500">
                      {tr("Salvo", "Saved")}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  {months === 1 ? (
                    <label className="block text-xs text-muted-foreground">
                      {tr("Valor mensal", "Monthly price")}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.10"
                          min="1"
                          value={basePrice}
                          onChange={(event) => setBasePrice(event.target.value)}
                          aria-label={tr("Preço mensal base", "Base monthly price")}
                        />
                      </div>
                    </label>
                  ) : (
                    <label className="block text-xs text-muted-foreground">
                      {tr("Desconto opcional", "Optional discount")}
                      <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="90"
                      step="1"
                      value={discounts[months]}
                      onChange={(event) =>
                        setDiscounts((current) => ({
                          ...current,
                          [months]: Math.min(90, Math.max(0, Number(event.target.value) || 0)),
                        }))
                      }
                      aria-label={tr(
                        `Desconto do plano ${planLabel(months)}`,
                        `${planLabel(months)} plan discount`,
                      )}
                      className="text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </label>
                  )}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <div className="text-lg font-bold text-foreground">
                    R$ {((unitPrice * months) / 100).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {months === 1
                      ? tr("por mês", "per month")
                      : `R$ ${(unitPrice / 100).toFixed(2)}/${tr("mês", "month")}`}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {tr(
                "Ao salvar, os quatro períodos são atualizados juntos.",
                "When saved, all four periods are updated together.",
              )}
            </p>
            <Button
              onClick={saveAll}
              disabled={busy}
              className="bg-primary text-primary-foreground"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                tr("Salvar tabela completa", "Save complete pricing")
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

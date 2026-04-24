import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Crown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const PRESETS: { months: 1 | 3 | 6 | 12; defaultDiscount: number; label: string }[] = [
  { months: 1, defaultDiscount: 0, label: "1 mês (preço cheio)" },
  { months: 3, defaultDiscount: 10, label: "3 meses (-10%)" },
  { months: 6, defaultDiscount: 20, label: "6 meses (-20%)" },
  { months: 12, defaultDiscount: 30, label: "12 meses (-30%)" },
];

function PlansPage() {
  const { user, isCreator, profile, loading } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [basePrice, setBasePrice] = useState("19.90");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("creator_id", user.id)
      .order("months");
    setPlans((data as Plan[]) ?? []);
  };

  useEffect(() => {
    if (user) load();
    if (profile?.subscription_price_cents) setBasePrice((profile.subscription_price_cents / 100).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  if (!user || !isCreator) return null;

  const seedAll = async () => {
    setBusy(true);
    try {
      const base = Math.round(parseFloat(basePrice) * 100);
      if (base < 100) {
        toast.error("Preço base mínimo: R$ 1,00");
        return;
      }
      // atualiza preço base no perfil
      await supabase.from("profiles").update({ subscription_price_cents: base }).eq("user_id", user.id);
      // upsert nos 4 planos
      for (const p of PRESETS) {
        const finalCents = Math.round(base * (1 - p.defaultDiscount / 100));
        const existing = plans.find((pl) => pl.months === p.months);
        if (existing) {
          await supabase
            .from("subscription_plans")
            .update({ price_cents: finalCents, discount_pct: p.defaultDiscount, is_active: true })
            .eq("id", existing.id);
        } else {
          await supabase.from("subscription_plans").insert({
            creator_id: user.id,
            months: p.months,
            price_cents: finalCents,
            discount_pct: p.defaultDiscount,
            is_active: true,
          });
        }
      }
      toast.success("Planos atualizados!");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("subscription_plans").delete().eq("id", id);
    load();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-bold text-foreground">Planos de assinatura</h1>

        <div className="space-y-3 rounded-2xl bg-card p-5">
          <p className="text-xs text-muted-foreground">
            Defina seu preço base mensal. Ao salvar, geramos automaticamente os bundles 1/3/6/12 meses com descontos progressivos.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">R$</span>
            <Input
              type="number"
              step="0.50"
              min="1"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">/mês</span>
            <Button onClick={seedAll} disabled={busy} className="ml-auto bg-primary text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar planos"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {plans.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum plano configurado.
            </p>
          ) : (
            plans.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-4">
                <Crown className="h-5 w-5 text-accent" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">
                    {p.months} {p.months === 1 ? "mês" : "meses"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    R$ {(p.price_cents / 100).toFixed(2)}/mês • Total R$ {((p.price_cents * p.months) / 100).toFixed(2)}
                    {p.discount_pct > 0 && <span className="ml-2 text-accent">-{p.discount_pct}%</span>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => remove(p.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

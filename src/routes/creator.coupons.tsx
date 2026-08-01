import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Tag, Gift, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/creator/coupons")({
  component: CouponsPage,
});

interface Coupon {
  id: string;
  code: string;
  trial_days: number | null;
  discount_pct: number | null;
  duration_months: number;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function CouponsPage() {
  const { tr } = useI18n();
  const { user, isCreator, profile, loading } = useAuth();
  const nav = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [mode, setMode] = useState<"trial" | "discount">("trial");
  const [trialDays, setTrialDays] = useState("7");
  const [discountPct, setDiscountPct] = useState("20");
  const [maxUses, setMaxUses] = useState("100");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subscription_coupons")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    setCoupons((data as Coupon[]) ?? []);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || !isCreator) return null;

  const create = async () => {
    setBusy(true);
    try {
      const code = `${profile?.username?.toUpperCase().slice(0, 4) ?? "VEN"}${genCode()}`;
      const payload: {
        creator_id: string;
        code: string;
        max_uses: number;
        trial_days?: number;
        discount_pct?: number;
        duration_months: number;
      } = {
        creator_id: user.id,
        code,
        max_uses: parseInt(maxUses) || 100,
        duration_months: 1,
      };
      if (mode === "trial") payload.trial_days = parseInt(trialDays) || 7;
      else payload.discount_pct = parseInt(discountPct) || 20;
      const { error } = await supabase.from("subscription_coupons").insert(payload);
      if (error) throw error;
      toast.success(tr("Cupom criado!", "Coupon created!"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("subscription_coupons").delete().eq("id", id);
    load();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-bold text-foreground">
          {tr("Cupons e testes grátis", "Coupons & trials")}
        </h1>

        <div className="space-y-3 rounded-2xl bg-card p-5">
          <div className="flex gap-1 rounded-full bg-background p-1">
            <button
              onClick={() => setMode("trial")}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                mode === "trial" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Gift className="mr-1 inline h-3.5 w-3.5" /> {tr("Teste grátis", "Free trial")}
            </button>
            <button
              onClick={() => setMode("discount")}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                mode === "discount" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Tag className="mr-1 inline h-3.5 w-3.5" /> {tr("Desconto %", "Discount %")}
            </button>
          </div>

          {mode === "trial" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {tr("Dias grátis (1–30)", "Free days (1–30)")}
              </span>
              <Input
                type="number"
                min="1"
                max="30"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="ml-auto h-9 w-24"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {tr("Desconto % (5–90)", "Discount % (5–90)")}
              </span>
              <Input
                type="number"
                min="5"
                max="90"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="ml-auto h-9 w-24"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {tr("Limite de usos", "Usage limit")}
            </span>
            <Input
              type="number"
              min="1"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              className="ml-auto h-9 w-24"
            />
          </div>
          <Button
            onClick={create}
            disabled={busy}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              tr("Criar cupom", "Create coupon")
            )}
          </Button>
        </div>

        <div className="space-y-2">
          {coupons.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {tr("Nenhum cupom ainda.", "No coupons yet.")}
            </p>
          ) : (
            coupons.map((c) => {
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${c.code}`;
              return (
                <div key={c.id} className="rounded-2xl bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="rounded-md bg-primary/10 px-2 py-1 text-sm font-bold text-primary">
                          {c.code}
                        </code>
                        {c.trial_days ? (
                          <span className="text-xs text-muted-foreground">
                            🎁 {c.trial_days} {tr("dias grátis", "free days")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            🏷️ {c.discount_pct}% off
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {tr("Usos", "Uses")}: {c.uses_count} / {c.max_uses}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(link);
                          toast.success(tr("Link copiado!", "Link copied!"));
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Gift, Loader2, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/creator/coupons")({
  component: CouponsPage,
});

interface Coupon {
  id: string;
  code: string;
  trial_days: number | null;
  discount_pct: number | null;
  fixed_price_cents: number | null;
  duration_months: number;
  max_uses: number;
  uses_count: number;
  new_subscribers_only: boolean;
  is_active: boolean;
}

type CouponMode = "trial" | "discount" | "fixed";

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function CouponsPage() {
  const { tr } = useI18n();
  const { user, isCreator, profile, loading } = useAuth();
  const nav = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [mode, setMode] = useState<CouponMode>("fixed");
  const [trialDays, setTrialDays] = useState("7");
  const [discountPct, setDiscountPct] = useState("20");
  const [fixedPrice, setFixedPrice] = useState("19.90");
  const [durationMonths, setDurationMonths] = useState("1");
  const [maxUses, setMaxUses] = useState("10");
  const [newSubscribersOnly, setNewSubscribersOnly] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("subscription_coupons")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setCoupons((data as Coupon[]) ?? []);
  };

  useEffect(() => {
    if (user) load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || !isCreator) return null;

  const create = async () => {
    setBusy(true);
    try {
      const limit = Math.max(1, Number.parseInt(maxUses, 10) || 1);
      const months = Number.parseInt(durationMonths, 10);
      const payload: {
        creator_id: string;
        code: string;
        max_uses: number;
        duration_months: number;
        new_subscribers_only: boolean;
        trial_days?: number;
        discount_pct?: number;
        fixed_price_cents?: number;
      } = {
        creator_id: user.id,
        code: `${profile?.username?.toUpperCase().slice(0, 4) ?? "VEN"}${genCode()}`,
        max_uses: limit,
        duration_months: months,
        new_subscribers_only: newSubscribersOnly,
      };

      if (mode === "trial") {
        const days = Number.parseInt(trialDays, 10);
        if (days < 1 || days > 30) throw new Error(tr("Use de 1 a 30 dias.", "Use 1 to 30 days."));
        payload.trial_days = days;
      } else if (mode === "discount") {
        const percent = Number.parseInt(discountPct, 10);
        if (percent < 5 || percent > 90) {
          throw new Error(tr("Use um desconto de 5% a 90%.", "Use a discount from 5% to 90%."));
        }
        payload.discount_pct = percent;
      } else {
        const cents = Math.round(Number.parseFloat(fixedPrice.replace(",", ".")) * 100);
        if (!Number.isFinite(cents) || cents < 100) {
          throw new Error(tr("Preço promocional mínimo: R$ 1,00.", "Minimum promotional price: R$ 1.00."));
        }
        payload.fixed_price_cents = cents;
      }

      const { error } = await supabase.from("subscription_coupons").insert(payload);
      if (error) throw error;
      toast.success(tr("Cupom criado!", "Coupon created!"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("subscription_coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };

  const modeButton = (value: CouponMode, label: string, icon: "gift" | "tag") => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
        mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      {icon === "gift" ? <Gift className="mr-1 inline h-3.5 w-3.5" /> : <Tag className="mr-1 inline h-3.5 w-3.5" />}
      {label}
    </button>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {tr("Cupons e testes grátis", "Coupons & trials")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr(
              "Crie uma oferta com vagas reais. Cada Pix pendente reserva uma vaga até expirar.",
              "Create an offer with real capacity. Each pending Pix reserves one slot until it expires.",
            )}
          </p>
        </div>

        <div className="space-y-4 rounded-2xl bg-card p-5">
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">
              {tr("Tipo do benefício", "Benefit type")}
            </Label>
            <div className="flex gap-1 rounded-full bg-background p-1">
              {modeButton("fixed", tr("Preço fixo", "Fixed price"), "tag")}
              {modeButton("discount", tr("Desconto %", "Discount %"), "tag")}
              {modeButton("trial", tr("Teste grátis", "Free trial"), "gift")}
            </div>
          </div>

          {mode === "trial" ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{tr("Dias grátis (1–30)", "Free days (1–30)")}</Label>
              <Input type="number" min="1" max="30" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} className="ml-auto h-9 w-28" />
            </div>
          ) : mode === "discount" ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{tr("Valor do desconto (5–90%)", "Discount value (5–90%)")}</Label>
              <Input type="number" min="5" max="90" value={discountPct} onChange={(event) => setDiscountPct(event.target.value)} className="ml-auto h-9 w-28" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{tr("Valor promocional da assinatura", "Promotional subscription price")}</Label>
              <div className="ml-auto flex items-center gap-1"><span className="text-sm">R$</span><Input type="number" min="1" step="0.10" value={fixedPrice} onChange={(event) => setFixedPrice(event.target.value)} className="h-9 w-28" /></div>
            </div>
          )}

          {mode !== "trial" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{tr("Duração do desconto", "Discount duration")}</Label>
              <Select value={durationMonths} onValueChange={setDurationMonths}>
                <SelectTrigger className="ml-auto h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{tr("Mensal", "Monthly")}</SelectItem>
                  <SelectItem value="3">{tr("Trimestral", "Quarterly")}</SelectItem>
                  <SelectItem value="6">{tr("Semestral", "Semiannual")}</SelectItem>
                  <SelectItem value="12">{tr("Anual", "Annual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{tr("Quantidade de vagas disponíveis", "Number of available slots")}</Label>
            <Input type="number" min="1" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} className="ml-auto h-9 w-28" />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-background p-3">
            <div>
              <div className="text-sm font-medium">{tr("Somente novos assinantes", "New subscribers only")}</div>
              <div className="text-[11px] text-muted-foreground">{tr("Quem já assinou esta criadora não pode usar.", "Previous subscribers cannot use it.")}</div>
            </div>
            <Switch checked={newSubscribersOnly} onCheckedChange={setNewSubscribersOnly} />
          </div>

          <Button onClick={create} disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Criar oferta", "Create offer")}
          </Button>
        </div>

        <div className="space-y-2">
          {coupons.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {tr("Nenhum cupom ainda.", "No coupons yet.")}
            </p>
          ) : (
            coupons.map((coupon) => {
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${coupon.code}`;
              const benefit = coupon.trial_days
                ? `🎁 ${coupon.trial_days} ${tr("dias grátis", "free days")}`
                : coupon.fixed_price_cents
                  ? `${tr("Preço total", "Total price")} R$ ${(coupon.fixed_price_cents / 100).toFixed(2)}`
                  : `🏷️ ${coupon.discount_pct}% off`;
              return (
                <div key={coupon.id} className="rounded-2xl bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded-md bg-primary/10 px-2 py-1 text-sm font-bold text-primary">{coupon.code}</code>
                        <span className="text-xs text-muted-foreground">{benefit}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {tr("Usos confirmados", "Confirmed uses")}: {coupon.uses_count} / {coupon.max_uses}
                        {coupon.new_subscribers_only && ` · ${tr("novos assinantes", "new subscribers")}`}
                        {!coupon.trial_days && ` · ${coupon.duration_months} ${coupon.duration_months === 1 ? tr("mês", "month") : tr("meses", "months")}`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => remove(coupon.id)} aria-label={tr("Excluir cupom", "Delete coupon")}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {tr("Link de divulgação", "Promotion link")}
                      </div>
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {link}
                      </a>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        toast.success(tr("Link de divulgação copiado!", "Promotion link copied!"));
                      }}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {tr("Copiar link", "Copy link")}
                    </Button>
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

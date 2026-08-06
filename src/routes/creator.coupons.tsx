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
  offer_type: CouponMode;
  trial_days: number | null;
  discount_pct: number | null;
  discount_amount_cents: number | null;
  fixed_price_cents: number | null;
  normal_price_snapshot_cents: number | null;
  post_trial_price_cents: number | null;
  auto_renew_after_trial: boolean;
  duration_months: number;
  max_uses: number;
  uses_count: number;
  eligibility: CouponEligibility;
  expires_at: string | null;
  link_only: boolean;
  new_subscribers_only: boolean;
  is_active: boolean;
}

type CouponMode =
  "percentage_discount" | "fixed_discount" | "first_month" | "special_price" | "trial";
type CouponEligibility = "new_subscribers" | "former_subscribers" | "new_and_former";

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function futureLocalInput(days: number) {
  const date = new Date(Date.now() + days * 24 * 60 * 60_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function CouponsPage() {
  const { tr } = useI18n();
  const { user, isCreator, profile, loading } = useAuth();
  const nav = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [mode, setMode] = useState<CouponMode>("special_price");
  const [trialDays, setTrialDays] = useState("7");
  const [discountPct, setDiscountPct] = useState("20");
  const [discountAmount, setDiscountAmount] = useState("10.00");
  const [fixedPrice, setFixedPrice] = useState("19.90");
  const [postTrialPrice, setPostTrialPrice] = useState("49.00");
  const [autoRenewAfterTrial, setAutoRenewAfterTrial] = useState(false);
  const [durationMonths, setDurationMonths] = useState("1");
  const [maxUses, setMaxUses] = useState("10");
  const [eligibility, setEligibility] = useState<CouponEligibility>("new_subscribers");
  const [expiresAt, setExpiresAt] = useState(() => futureLocalInput(7));
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
      const expiration = new Date(expiresAt);
      if (!expiresAt || Number.isNaN(expiration.getTime()) || expiration.getTime() <= Date.now()) {
        throw new Error(tr("Defina uma data e hora futuras.", "Set a future date and time."));
      }
      const normalPriceCents = Math.max(100, profile?.subscription_price_cents ?? 4_900);
      const payload: {
        creator_id: string;
        code: string;
        offer_type: CouponMode;
        max_uses: number;
        max_uses_per_user: number;
        duration_months: number;
        new_subscribers_only: boolean;
        eligibility: CouponEligibility;
        expires_at: string;
        link_only: boolean;
        normal_price_snapshot_cents: number;
        auto_renew_after_trial: boolean;
        post_trial_price_cents?: number;
        trial_days?: number;
        discount_pct?: number;
        discount_amount_cents?: number;
        fixed_price_cents?: number;
      } = {
        creator_id: user.id,
        code: `${profile?.username?.toUpperCase().slice(0, 4) ?? "VEN"}${genCode()}`,
        offer_type: mode,
        max_uses: limit,
        max_uses_per_user: 1,
        duration_months: mode === "first_month" || mode === "trial" ? 1 : months,
        new_subscribers_only: eligibility === "new_subscribers",
        eligibility,
        expires_at: expiration.toISOString(),
        link_only: true,
        normal_price_snapshot_cents: normalPriceCents,
        auto_renew_after_trial: mode === "trial" && autoRenewAfterTrial,
      };

      if (mode === "trial") {
        const days = Number.parseInt(trialDays, 10);
        if (days < 1 || days > 30) throw new Error(tr("Use de 1 a 30 dias.", "Use 1 to 30 days."));
        const postCents = Math.round(Number.parseFloat(postTrialPrice.replace(",", ".")) * 100);
        if (!Number.isFinite(postCents) || postCents < 100) {
          throw new Error(tr("Informe o valor após o teste.", "Enter the post-trial price."));
        }
        payload.trial_days = days;
        payload.post_trial_price_cents = postCents;
      } else if (mode === "percentage_discount") {
        const percent = Number.parseInt(discountPct, 10);
        if (percent < 5 || percent > 90) {
          throw new Error(tr("Use um desconto de 5% a 90%.", "Use a discount from 5% to 90%."));
        }
        payload.discount_pct = percent;
      } else if (mode === "fixed_discount") {
        const cents = Math.round(Number.parseFloat(discountAmount.replace(",", ".")) * 100);
        if (!Number.isFinite(cents) || cents < 100 || cents >= normalPriceCents) {
          throw new Error(
            tr(
              "O desconto fixo precisa ser menor que o valor normal.",
              "The fixed discount must be lower than the regular price.",
            ),
          );
        }
        payload.discount_amount_cents = cents;
      } else {
        const cents = Math.round(Number.parseFloat(fixedPrice.replace(",", ".")) * 100);
        if (!Number.isFinite(cents) || cents < 100 || cents >= normalPriceCents) {
          throw new Error(
            tr(
              "O preço promocional precisa ser menor que o valor normal.",
              "The promotional price must be lower than the regular price.",
            ),
          );
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
      {icon === "gift" ? (
        <Gift className="mr-1 inline h-3.5 w-3.5" />
      ) : (
        <Tag className="mr-1 inline h-3.5 w-3.5" />
      )}
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
            <div className="flex flex-wrap gap-1 rounded-2xl bg-background p-1">
              {modeButton("special_price", tr("Valor especial", "Special price"), "tag")}
              {modeButton("first_month", tr("1º mês promocional", "Promotional 1st month"), "tag")}
              {modeButton("percentage_discount", tr("Desconto %", "Discount %"), "tag")}
              {modeButton("fixed_discount", tr("Desconto R$", "BRL discount"), "tag")}
              {modeButton("trial", tr("Teste grátis", "Free trial"), "gift")}
            </div>
          </div>

          {mode === "trial" ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {tr("Dias grátis (1–30)", "Free days (1–30)")}
              </Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={trialDays}
                onChange={(event) => setTrialDays(event.target.value)}
                className="ml-auto h-9 w-28"
              />
            </div>
          ) : mode === "percentage_discount" ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {tr("Valor do desconto (5–90%)", "Discount value (5–90%)")}
              </Label>
              <Input
                type="number"
                min="5"
                max="90"
                value={discountPct}
                onChange={(event) => setDiscountPct(event.target.value)}
                className="ml-auto h-9 w-28"
              />
            </div>
          ) : mode === "fixed_discount" ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {tr("Desconto em valor fixo", "Fixed amount discount")}
              </Label>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-sm">R$</span>
                <Input
                  type="number"
                  min="1"
                  step="0.10"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                  className="h-9 w-28"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {tr("Valor promocional da assinatura", "Promotional subscription price")}
              </Label>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-sm">R$</span>
                <Input
                  type="number"
                  min="1"
                  step="0.10"
                  value={fixedPrice}
                  onChange={(event) => setFixedPrice(event.target.value)}
                  className="h-9 w-28"
                />
              </div>
            </div>
          )}

          {mode === "trial" && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">
                  {tr("Valor após o período de teste", "Price after the trial")}
                </Label>
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-sm">R$</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.10"
                    value={postTrialPrice}
                    onChange={(event) => setPostTrialPrice(event.target.value)}
                    className="h-9 w-28"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-background p-3">
                <div>
                  <div className="text-sm font-medium">
                    {tr("Renovação automática", "Automatic renewal")}
                  </div>
                  <div className="max-w-md text-[11px] text-muted-foreground">
                    {tr(
                      "Só será cobrada com autorização recorrente válida; Pix avulso nunca renova sozinho.",
                      "Only charged with valid recurring authorization; a one-time PIX never renews itself.",
                    )}
                  </div>
                </div>
                <Switch checked={autoRenewAfterTrial} onCheckedChange={setAutoRenewAfterTrial} />
              </div>
            </>
          )}

          {mode !== "trial" && mode !== "first_month" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {tr("Duração do desconto", "Discount duration")}
              </Label>
              <Select value={durationMonths} onValueChange={setDurationMonths}>
                <SelectTrigger className="ml-auto h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
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
            <Label className="text-xs text-muted-foreground">
              {tr("Quantidade de vagas disponíveis", "Number of available slots")}
            </Label>
            <Input
              type="number"
              min="1"
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              className="ml-auto h-9 w-28"
            />
          </div>

          <div className="space-y-2 rounded-xl bg-background p-3">
            <Label className="text-xs text-muted-foreground">
              {tr("Quem pode utilizar", "Who can use it")}
            </Label>
            <Select
              value={eligibility}
              onValueChange={(value) => setEligibility(value as CouponEligibility)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_subscribers">
                  {tr("Novos assinantes", "New subscribers")}
                </SelectItem>
                <SelectItem value="former_subscribers">
                  {tr("Antigos assinantes", "Former subscribers")}
                </SelectItem>
                <SelectItem value="new_and_former">
                  {tr("Novos e antigos", "New and former")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">
              {tr("Data e hora de expiração", "Expiration date and time")}
            </Label>
            <Input
              type="datetime-local"
              value={expiresAt}
              min={futureLocalInput(0)}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="ml-auto h-9 w-52"
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
              tr("Criar oferta", "Create offer")
            )}
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
              const benefit =
                coupon.offer_type === "trial"
                  ? `🎁 ${coupon.trial_days} ${tr("dias grátis", "free days")}`
                  : coupon.offer_type === "fixed_discount"
                    ? `🏷️ R$ ${((coupon.discount_amount_cents ?? 0) / 100).toFixed(2)} ${tr("de desconto", "off")}`
                    : coupon.offer_type === "percentage_discount"
                      ? `🏷️ ${coupon.discount_pct}% off`
                      : `${tr("Preço promocional", "Promotional price")} R$ ${((coupon.fixed_price_cents ?? 0) / 100).toFixed(2)}`;
              return (
                <div key={coupon.id} className="rounded-2xl bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded-md bg-primary/10 px-2 py-1 text-sm font-bold text-primary">
                          {coupon.code}
                        </code>
                        <span className="text-xs text-muted-foreground">{benefit}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {tr("Usos confirmados", "Confirmed uses")}: {coupon.uses_count} /{" "}
                        {coupon.max_uses}
                        {` · ${Math.max(0, coupon.max_uses - coupon.uses_count)} ${tr("vagas restantes", "slots left")}`}
                        {` · ${coupon.eligibility === "new_subscribers" ? tr("novos assinantes", "new subscribers") : coupon.eligibility === "former_subscribers" ? tr("antigos assinantes", "former subscribers") : tr("novos e antigos", "new and former")}`}
                        {!coupon.trial_days &&
                          ` · ${coupon.duration_months} ${coupon.duration_months === 1 ? tr("mês", "month") : tr("meses", "months")}`}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {tr("Expira em", "Expires at")}:{" "}
                        {coupon.expires_at
                          ? new Date(coupon.expires_at).toLocaleString("pt-BR")
                          : tr("sem expiração", "no expiration")}
                        {coupon.offer_type === "trial" && coupon.post_trial_price_cents
                          ? ` · ${tr("depois", "after")}: R$ ${(coupon.post_trial_price_cents / 100).toFixed(2)}`
                          : coupon.normal_price_snapshot_cents
                            ? ` · ${tr("depois", "after")}: R$ ${(coupon.normal_price_snapshot_cents / 100).toFixed(2)}`
                            : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => remove(coupon.id)}
                        aria-label={tr("Excluir cupom", "Delete coupon")}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
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

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Link2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  TicketCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUPON_BENEFITS,
  COUPON_ELIGIBILITIES,
  calculateCouponPrice,
  couponBenefitLabel,
  couponEligibilityLabel,
  couponPostOfferPrice,
  couponRemainingSlots,
  isCouponExpired,
  validateCouponDraft,
  type CouponBenefitType,
  type CouponEligibility,
} from "@/lib/coupon-offers";
import { createDemoId, type DemoCoupon, type DemoOperationsState } from "@/lib/demo-operations";
import { useI18n } from "@/lib/i18n";

type PlanMonths = 1 | 3 | 6 | 12;

function money(cents: number, locale: "pt-BR" | "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function futureLocalInput(days: number) {
  const date = new Date(Date.now() + days * 24 * 60 * 60_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function offerStatus(coupon: DemoCoupon, locale: "pt-BR" | "en") {
  if (!coupon.active) {
    return { label: locale === "en" ? "Paused" : "Pausada", tone: "muted" as const };
  }
  if (isCouponExpired(coupon)) {
    return { label: locale === "en" ? "Expired" : "Expirada", tone: "danger" as const };
  }
  if (couponRemainingSlots(coupon) === 0) {
    return { label: locale === "en" ? "Sold out" : "Esgotada", tone: "danger" as const };
  }
  return { label: locale === "en" ? "Active" : "Ativa", tone: "success" as const };
}

export function CreatorCouponStudio({
  operations,
  update,
}: {
  operations: DemoOperationsState;
  update: (fn: (state: DemoOperationsState) => DemoOperationsState) => void;
}) {
  const { locale, tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("PRIMEIRAS10");
  const [benefitType, setBenefitType] = useState<CouponBenefitType>("special_price");
  const [benefitValue, setBenefitValue] = useState("19.90");
  const [normalPrice, setNormalPrice] = useState("49.00");
  const [durationMonths, setDurationMonths] = useState<PlanMonths>(1);
  const [eligibility, setEligibility] = useState<CouponEligibility>("new_subscribers");
  const [limitedQuantity, setLimitedQuantity] = useState(true);
  const [maxUses, setMaxUses] = useState("10");
  const [limitedDate, setLimitedDate] = useState(true);
  const [expiresAt, setExpiresAt] = useState(() => futureLocalInput(7));
  const [linkOnly, setLinkOnly] = useState(true);
  const [trialDays, setTrialDays] = useState("7");
  const [autoRenew, setAutoRenew] = useState(false);
  const [postTrialPrice, setPostTrialPrice] = useState("49.00");

  const monthlyPlan = operations.plans.find((plan) => plan.months === 1);
  const defaultNormalCents = monthlyPlan?.price_cents ?? 4_900;

  const draftPreview = useMemo<DemoCoupon>(() => {
    const normalCents = Math.max(
      100,
      Math.round(Number(normalPrice.replace(",", ".")) * 100) || defaultNormalCents,
    );
    const numericBenefit = Number(benefitValue.replace(",", ".")) || 0;
    return {
      id: "preview",
      code: code.trim().toUpperCase(),
      benefit_type: benefitType,
      discount_percent:
        benefitType === "percentage_discount" ? Math.round(numericBenefit) : undefined,
      discount_amount_cents:
        benefitType === "fixed_discount" ? Math.round(numericBenefit * 100) : undefined,
      promotional_price_cents:
        benefitType === "first_month" || benefitType === "special_price"
          ? Math.round(numericBenefit * 100)
          : undefined,
      trial_days: benefitType === "trial" ? Math.round(Number(trialDays) || 0) : undefined,
      normal_price_cents: normalCents,
      post_trial_price_cents:
        benefitType === "trial"
          ? Math.round(Number(postTrialPrice.replace(",", ".")) * 100) || normalCents
          : undefined,
      auto_renew_after_trial: benefitType === "trial" && autoRenew,
      duration_months:
        benefitType === "first_month" || benefitType === "trial" ? 1 : durationMonths,
      uses: 0,
      reserved_uses: 0,
      max_uses: limitedQuantity ? Math.max(1, Math.floor(Number(maxUses) || 1)) : 0,
      max_uses_per_user: 1,
      used_by_user_ids: [],
      eligibility,
      expires_at: limitedDate && expiresAt ? new Date(expiresAt).toISOString() : null,
      link_only: linkOnly,
      active: true,
    };
  }, [
    autoRenew,
    benefitType,
    benefitValue,
    code,
    defaultNormalCents,
    durationMonths,
    eligibility,
    expiresAt,
    limitedDate,
    limitedQuantity,
    linkOnly,
    maxUses,
    normalPrice,
    postTrialPrice,
    trialDays,
  ]);

  const activeCoupons = operations.coupons.filter(
    (coupon) => coupon.active && !isCouponExpired(coupon) && couponRemainingSlots(coupon) !== 0,
  );
  const confirmedUses = operations.coupons.reduce((total, coupon) => total + coupon.uses, 0);
  const reservedUses = operations.coupons.reduce(
    (total, coupon) => total + coupon.reserved_uses,
    0,
  );

  const openCreate = () => {
    const normal = (defaultNormalCents / 100).toFixed(2);
    setCode(`OFERTA${Math.floor(100 + Math.random() * 900)}`);
    setBenefitType("special_price");
    setBenefitValue("19.90");
    setNormalPrice(normal);
    setDurationMonths(1);
    setEligibility("new_subscribers");
    setLimitedQuantity(true);
    setMaxUses("10");
    setLimitedDate(true);
    setExpiresAt(futureLocalInput(7));
    setLinkOnly(true);
    setTrialDays("7");
    setAutoRenew(false);
    setPostTrialPrice(normal);
    setOpen(true);
  };

  const changeBenefit = (next: CouponBenefitType) => {
    setBenefitType(next);
    setBenefitValue(
      next === "percentage_discount"
        ? "20"
        : next === "fixed_discount"
          ? "10.00"
          : next === "first_month" || next === "special_price"
            ? "19.90"
            : "0",
    );
  };

  const save = () => {
    const errors = validateCouponDraft({
      code: draftPreview.code,
      benefitType,
      benefitValue: Number(benefitValue.replace(",", ".")) || 0,
      normalPriceCents: draftPreview.normal_price_cents,
      maxUses: draftPreview.max_uses,
      expiresAt: draftPreview.expires_at,
      trialDays: Number(trialDays) || 0,
      postTrialPriceCents: draftPreview.post_trial_price_cents ?? 0,
    });
    if (operations.coupons.some((coupon) => coupon.code === draftPreview.code)) {
      errors.unshift(tr("Este código já está em uso.", "This code is already in use."));
    }
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    const coupon = { ...draftPreview, id: createDemoId("coupon") };
    update((state) => ({ ...state, coupons: [coupon, ...state.coupons] }));
    setOpen(false);
    toast.success(
      tr(
        "Oferta criada. O link já aplica o cupom no perfil.",
        "Offer created. Its link now applies the coupon on the profile.",
      ),
    );
  };

  const toggle = (id: string) => {
    update((state) => ({
      ...state,
      coupons: state.coupons.map((coupon) =>
        coupon.id === id ? { ...coupon, active: !coupon.active } : coupon,
      ),
    }));
  };

  const duplicate = (coupon: DemoCoupon) => {
    setCode(`${coupon.code}2`.slice(0, 30));
    setBenefitType(coupon.benefit_type);
    setBenefitValue(
      coupon.benefit_type === "percentage_discount"
        ? String(coupon.discount_percent ?? 20)
        : coupon.benefit_type === "fixed_discount"
          ? ((coupon.discount_amount_cents ?? 1_000) / 100).toFixed(2)
          : ((coupon.promotional_price_cents ?? 1_990) / 100).toFixed(2),
    );
    setNormalPrice((coupon.normal_price_cents / 100).toFixed(2));
    setDurationMonths(coupon.duration_months);
    setEligibility(coupon.eligibility);
    setLimitedQuantity(coupon.max_uses > 0);
    setMaxUses(String(coupon.max_uses || 10));
    setLimitedDate(Boolean(coupon.expires_at));
    setExpiresAt(coupon.expires_at ? localInputFromIso(coupon.expires_at) : futureLocalInput(7));
    setLinkOnly(coupon.link_only);
    setTrialDays(String(coupon.trial_days ?? 7));
    setAutoRenew(coupon.auto_renew_after_trial);
    setPostTrialPrice(
      ((coupon.post_trial_price_cents ?? coupon.normal_price_cents) / 100).toFixed(2),
    );
    setOpen(true);
  };

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary
          label={tr("Ofertas ativas", "Active offers")}
          value={String(activeCoupons.length)}
          helper={tr("Disponíveis por link", "Available by link")}
          icon={TicketCheck}
        />
        <Summary
          label={tr("Usos confirmados", "Confirmed uses")}
          value={String(confirmedUses)}
          helper={tr("Uma utilização por pessoa", "One use per person")}
          icon={Users}
        />
        <Summary
          label={tr("Vagas reservadas", "Reserved slots")}
          value={String(reservedUses)}
          helper={tr("Pix pendente", "Pending PIX")}
          icon={Clock3}
        />
      </div>

      <Card className="border-emerald-500/25 bg-emerald-500/5 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {tr("Vagas protegidas no pagamento", "Slots protected at payment")}
              </h3>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                {tr(
                  "Cada Pix pendente reserva uma vaga até expirar. O mesmo usuário não consegue reservar ou utilizar a oferta novamente, e o preço volta ao normal quando as vagas ou a data acabam.",
                  "Each pending PIX reserves a slot until expiration. The same user cannot reserve or redeem again, and regular pricing returns after slots or time run out.",
                )}
              </p>
            </div>
          </div>
          <Button className="shrink-0" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {tr("Nova oferta", "New offer")}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-foreground">
            {tr("Cupons criados", "Created coupons")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {tr(
              "Acompanhe vagas, validade, público e preço posterior.",
              "Track slots, validity, audience, and post-offer pricing.",
            )}
          </p>
        </div>
        {operations.coupons.map((coupon) => {
          const remaining = couponRemainingSlots(coupon);
          const status = offerStatus(coupon, locale);
          const link = `${typeof window === "undefined" ? "http://localhost:8080" : window.location.origin}/c/${encodeURIComponent(coupon.code)}`;
          const promotional = calculateCouponPrice(coupon);
          const postPrice = couponPostOfferPrice(coupon);
          const capacityUsed = coupon.uses + coupon.reserved_uses;
          const capacityPercent = coupon.max_uses
            ? Math.min(100, (capacityUsed / coupon.max_uses) * 100)
            : 0;
          return (
            <Card key={coupon.id} className="overflow-hidden">
              <div className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
                        {coupon.code}
                      </code>
                      <StatusBadge label={status.label} tone={status.tone} />
                      {coupon.link_only && (
                        <Badge variant="outline">
                          <Link2 className="mr-1 h-3 w-3" /> {tr("Exclusiva por link", "Link only")}
                        </Badge>
                      )}
                    </div>
                    <h4 className="mt-3 font-semibold text-foreground">
                      {couponBenefitLabel(coupon.benefit_type, locale)}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {couponEligibilityLabel(coupon.eligibility, locale)} ·{" "}
                      {tr("máximo de 1 uso por pessoa", "maximum 1 use per person")}
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3 text-right">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {coupon.benefit_type === "trial"
                          ? tr("Durante o teste", "During trial")
                          : tr("Valor promocional", "Promotional price")}
                      </span>
                      <strong className="mt-1 block text-lg text-primary">
                        {coupon.benefit_type === "trial"
                          ? `${coupon.trial_days} ${tr("dias grátis", "free days")}`
                          : money(promotional, locale)}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {tr("Depois da oferta", "After offer")}
                      </span>
                      <strong className="mt-1 block text-lg text-foreground">
                        {money(postPrice, locale)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Info
                    label={tr("Vagas disponíveis", "Available slots")}
                    value={
                      remaining === null
                        ? tr("Sem limite", "Unlimited")
                        : `${remaining} de ${coupon.max_uses}`
                    }
                  />
                  <Info
                    label={tr("Validade", "Validity")}
                    value={
                      coupon.expires_at
                        ? new Date(coupon.expires_at).toLocaleString(
                            locale === "en" ? "en-US" : "pt-BR",
                          )
                        : tr("Sem expiração", "No expiration")
                    }
                  />
                  <Info
                    label={tr("Renovação", "Renewal")}
                    value={
                      coupon.benefit_type === "trial"
                        ? coupon.auto_renew_after_trial
                          ? tr("Automática se autorizada", "Automatic if authorized")
                          : tr("Confirmação necessária", "Confirmation required")
                        : `${coupon.duration_months} ${coupon.duration_months === 1 ? tr("mês promocional", "promotional month") : tr("meses promocionais", "promotional months")}`
                    }
                  />
                </div>

                {coupon.max_uses > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
                      <span>
                        {coupon.uses} {tr("confirmados", "confirmed")} · {coupon.reserved_uses}{" "}
                        {tr("reservados", "reserved")}
                      </span>
                      <span>
                        {remaining} {tr("restantes", "remaining")}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${capacityPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-xs text-primary hover:underline"
                  >
                    {link}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(link);
                        toast.success(tr("Link copiado!", "Link copied!"));
                      }}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> {tr("Copiar link", "Copy link")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(coupon)}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {tr("Duplicar", "Duplicate")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggle(coupon.id)}>
                      {coupon.active ? (
                        <Pause className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {coupon.active ? tr("Pausar", "Pause") : tr("Ativar", "Activate")}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("Criar oferta por link", "Create link offer")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Defina o benefício, a elegibilidade, os limites e o valor após a promoção.",
                "Set the benefit, eligibility, limits, and post-promotion price.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Step number="1" />
                  <Label>{tr("Benefício da oferta", "Offer benefit")}</Label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {COUPON_BENEFITS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => changeBenefit(item.id)}
                      className={`rounded-xl border p-3 text-left transition ${benefitType === item.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <strong className="text-sm text-foreground">
                        {locale === "en" ? item.labelEn : item.label}
                      </strong>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {locale === "en" ? item.descriptionEn : item.description}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-xs text-muted-foreground">
                    {tr("Código da oferta", "Offer code")}
                    <Input
                      value={code}
                      maxLength={30}
                      onChange={(event) =>
                        setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                      }
                    />
                  </label>
                  <label className="space-y-1.5 text-xs text-muted-foreground">
                    {tr("Valor normal", "Regular price")}
                    <div className="flex items-center gap-2">
                      <span>R$</span>
                      <Input
                        type="number"
                        min="1"
                        step="0.10"
                        value={normalPrice}
                        onChange={(event) => setNormalPrice(event.target.value)}
                      />
                    </div>
                  </label>
                </div>

                {benefitType === "trial" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 text-xs text-muted-foreground">
                      {tr("Quantidade de dias", "Number of days")}
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={trialDays}
                        onChange={(event) => setTrialDays(event.target.value)}
                      />
                    </label>
                    <label className="space-y-1.5 text-xs text-muted-foreground">
                      {tr("Valor após o teste", "Price after trial")}
                      <div className="flex items-center gap-2">
                        <span>R$</span>
                        <Input
                          type="number"
                          min="1"
                          step="0.10"
                          value={postTrialPrice}
                          onChange={(event) => setPostTrialPrice(event.target.value)}
                        />
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 text-xs text-muted-foreground">
                      {benefitType === "percentage_discount"
                        ? tr("Desconto (%)", "Discount (%)")
                        : benefitType === "fixed_discount"
                          ? tr("Valor descontado (R$)", "Discount amount (BRL)")
                          : tr("Valor promocional (R$)", "Promotional price (BRL)")}
                      <Input
                        type="number"
                        min="1"
                        max={benefitType === "percentage_discount" ? 90 : undefined}
                        step={benefitType === "percentage_discount" ? "1" : "0.10"}
                        value={benefitValue}
                        onChange={(event) => setBenefitValue(event.target.value)}
                      />
                    </label>
                    {benefitType !== "first_month" && (
                      <label className="space-y-1.5 text-xs text-muted-foreground">
                        {tr("Período da assinatura", "Subscription period")}
                        <Select
                          value={String(durationMonths)}
                          onValueChange={(value) => setDurationMonths(Number(value) as PlanMonths)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">{tr("Mensal", "Monthly")}</SelectItem>
                            <SelectItem value="3">{tr("Trimestral", "Quarterly")}</SelectItem>
                            <SelectItem value="6">{tr("Semestral", "Semiannual")}</SelectItem>
                            <SelectItem value="12">{tr("Anual", "Annual")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-3 border-t border-border pt-5">
                <div className="flex items-center gap-2">
                  <Step number="2" />
                  <Label>{tr("Quem pode utilizar", "Who can use it")}</Label>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {COUPON_ELIGIBILITIES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setEligibility(item.id)}
                      className={`rounded-xl border p-3 text-left ${eligibility === item.id ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <strong className="text-xs text-foreground">
                        {locale === "en" ? item.labelEn : item.label}
                      </strong>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                        {locale === "en" ? item.descriptionEn : item.description}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-500" />
                  {tr(
                    "Regra fixa: cada pessoa pode utilizar este cupom somente uma vez.",
                    "Fixed rule: each person can redeem this coupon only once.",
                  )}
                </div>
              </section>

              <section className="space-y-3 border-t border-border pt-5">
                <div className="flex items-center gap-2">
                  <Step number="3" />
                  <Label>{tr("Limites da oferta", "Offer limits")}</Label>
                </div>
                <ToggleRow
                  checked={limitedQuantity}
                  onChange={setLimitedQuantity}
                  title={tr("Limitar por quantidade", "Limit by quantity")}
                  description={tr(
                    "O preço volta ao normal quando todas as vagas forem usadas ou reservadas.",
                    "Regular pricing returns when all slots are used or reserved.",
                  )}
                />
                {limitedQuantity && (
                  <label className="block max-w-xs space-y-1.5 text-xs text-muted-foreground">
                    {tr("Quantidade máxima de usuários", "Maximum users")}
                    <Input
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={(event) => setMaxUses(event.target.value)}
                    />
                  </label>
                )}
                <ToggleRow
                  checked={limitedDate}
                  onChange={setLimitedDate}
                  title={tr("Limitar por data e hora", "Limit by date and time")}
                  description={tr(
                    "O link abre o perfil com o preço normal depois da expiração.",
                    "The link opens the profile at regular price after expiration.",
                  )}
                />
                {limitedDate && (
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    aria-label={tr("Data e hora de expiração", "Expiration date and time")}
                  />
                )}
                <ToggleRow
                  checked={linkOnly}
                  onChange={setLinkOnly}
                  title={tr("Oferta exclusiva por link", "Link-exclusive offer")}
                  description={tr(
                    "O cupom é aplicado automaticamente ao abrir o link de divulgação.",
                    "The coupon is automatically applied from its promotion link.",
                  )}
                />
              </section>

              {benefitType === "trial" && (
                <section className="space-y-3 border-t border-border pt-5">
                  <div className="flex items-center gap-2">
                    <Step number="4" />
                    <Label>{tr("Depois do período de teste", "After the trial")}</Label>
                  </div>
                  <ToggleRow
                    checked={autoRenew}
                    onChange={setAutoRenew}
                    title={tr("Renovação automática", "Automatic renewal")}
                    description={tr(
                      "Só será executada se houver autorização válida para cobrança recorrente. Um Pix avulso não autoriza renovação.",
                      "Only runs with valid recurring-payment authorization. A one-time PIX does not authorize renewal.",
                    )}
                  />
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-0 lg:self-start">
              <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5">
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <TicketCheck className="h-4 w-4" />
                    {tr("Prévia da oferta", "Offer preview")}
                  </div>
                  <code className="mt-4 inline-block rounded-lg bg-background px-2.5 py-1 text-sm font-bold text-foreground">
                    {draftPreview.code || "CUPOM"}
                  </code>
                  <h3 className="mt-4 font-semibold text-foreground">
                    {couponBenefitLabel(benefitType, locale)}
                  </h3>
                  <div className="mt-4 rounded-xl bg-background p-4 text-center">
                    <span className="text-xs text-muted-foreground">
                      {benefitType === "trial"
                        ? tr("Comece com", "Start with")
                        : tr("Agora", "Now")}
                    </span>
                    <strong className="mt-1 block text-3xl text-primary">
                      {benefitType === "trial"
                        ? `${trialDays} ${tr("dias grátis", "free days")}`
                        : money(calculateCouponPrice(draftPreview), locale)}
                    </strong>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {tr("Depois", "After")}:{" "}
                      <strong className="text-foreground">
                        {money(couponPostOfferPrice(draftPreview), locale)}
                      </strong>
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    <p>
                      <Users className="mr-1.5 inline h-3.5 w-3.5" />
                      {limitedQuantity
                        ? `${maxUses} ${tr("vagas no total", "total slots")}`
                        : tr("Sem limite de vagas", "Unlimited slots")}
                    </p>
                    <p>
                      <CalendarClock className="mr-1.5 inline h-3.5 w-3.5" />
                      {limitedDate && expiresAt
                        ? `${tr("Até", "Until")} ${new Date(expiresAt).toLocaleString(locale === "en" ? "en-US" : "pt-BR")}`
                        : tr("Sem expiração", "No expiration")}
                    </p>
                    <p>
                      <Link2 className="mr-1.5 inline h-3.5 w-3.5" />
                      {linkOnly
                        ? tr("Aplicada automaticamente pelo link", "Automatically applied by link")
                        : tr("Link e código manual", "Link and manual code")}
                    </p>
                  </div>
                </div>
                <div className="border-t border-primary/20 bg-background/50 p-3 text-[10px] leading-4 text-muted-foreground">
                  {tr(
                    "Quando a oferta acabar, o lead continua no perfil e vê o valor normal, sem erro ou página quebrada.",
                    "When the offer ends, the lead stays on the profile and sees regular pricing.",
                  )}
                </div>
              </div>
            </aside>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={save}>
              <Link2 className="mr-2 h-4 w-4" />
              {tr("Criar oferta e gerar link", "Create offer and link")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function localInputFromIso(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function Step({ number }: { number: string }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {number}
    </span>
  );
}

function Summary({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof TicketCheck;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs text-muted-foreground">{label}</span>
          <strong className="mt-1 block text-xl text-foreground">{value}</strong>
          <span className="mt-1 block text-[11px] text-muted-foreground">{helper}</span>
        </div>
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-xs text-foreground">{value}</strong>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "danger" | "muted" }) {
  const className =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
      : tone === "danger"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-background p-3">
      <span>
        <strong className="block text-sm text-foreground">{title}</strong>
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
      />
    </label>
  );
}

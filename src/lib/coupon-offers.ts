export type CouponBenefitType =
  "percentage_discount" | "fixed_discount" | "first_month" | "special_price" | "trial";

export type CouponEligibility = "new_subscribers" | "former_subscribers" | "new_and_former";

export interface CouponOfferLike {
  benefit_type: CouponBenefitType;
  discount_percent?: number;
  discount_amount_cents?: number;
  promotional_price_cents?: number;
  normal_price_cents: number;
  trial_days?: number;
  post_trial_price_cents?: number;
  auto_renew_after_trial: boolean;
  max_uses: number;
  uses: number;
  reserved_uses: number;
  max_uses_per_user: number;
  used_by_user_ids: string[];
  expires_at: string | null;
  eligibility: CouponEligibility;
  active: boolean;
}

export interface CouponViewerContext {
  userId: string;
  wasSubscriber: boolean;
  isActiveSubscriber: boolean;
  now?: Date;
}

export const COUPON_BENEFITS: Array<{
  id: CouponBenefitType;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
}> = [
  {
    id: "percentage_discount",
    label: "Desconto percentual",
    labelEn: "Percentage discount",
    description: "Reduz o preço normal em uma porcentagem.",
    descriptionEn: "Reduces the regular price by a percentage.",
  },
  {
    id: "fixed_discount",
    label: "Desconto em valor fixo",
    labelEn: "Fixed amount discount",
    description: "Desconta um valor exato do preço normal.",
    descriptionEn: "Subtracts an exact amount from the regular price.",
  },
  {
    id: "first_month",
    label: "Primeiro mês promocional",
    labelEn: "Promotional first month",
    description: "O primeiro mês tem preço especial; depois volta ao normal.",
    descriptionEn: "The first month has a special price, then returns to regular pricing.",
  },
  {
    id: "special_price",
    label: "Assinatura por valor especial",
    labelEn: "Special subscription price",
    description: "Define um preço fechado para o período escolhido.",
    descriptionEn: "Sets a fixed price for the selected subscription period.",
  },
  {
    id: "trial",
    label: "Período de teste",
    labelEn: "Trial period",
    description: "Libera alguns dias e informa o preço após o teste.",
    descriptionEn: "Unlocks a few days and shows the post-trial price.",
  },
];

export const COUPON_ELIGIBILITIES: Array<{
  id: CouponEligibility;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
}> = [
  {
    id: "new_subscribers",
    label: "Somente novos assinantes",
    labelEn: "New subscribers only",
    description: "Nunca assinaram esta modelo.",
    descriptionEn: "Never subscribed to this creator.",
  },
  {
    id: "former_subscribers",
    label: "Somente antigos assinantes",
    labelEn: "Former subscribers only",
    description: "Já assinaram, mas não têm assinatura ativa.",
    descriptionEn: "Subscribed before but are not active now.",
  },
  {
    id: "new_and_former",
    label: "Novos e antigos assinantes",
    labelEn: "New and former subscribers",
    description: "Qualquer pessoa sem assinatura ativa.",
    descriptionEn: "Anyone without an active subscription.",
  },
];

export function couponBenefitLabel(type: CouponBenefitType, locale: "pt-BR" | "en") {
  const item = COUPON_BENEFITS.find((entry) => entry.id === type);
  return locale === "en" ? (item?.labelEn ?? type) : (item?.label ?? type);
}

export function couponEligibilityLabel(type: CouponEligibility, locale: "pt-BR" | "en") {
  const item = COUPON_ELIGIBILITIES.find((entry) => entry.id === type);
  return locale === "en" ? (item?.labelEn ?? type) : (item?.label ?? type);
}

export function couponRemainingSlots(
  coupon: Pick<CouponOfferLike, "max_uses" | "uses" | "reserved_uses">,
) {
  if (coupon.max_uses === 0) return null;
  return Math.max(0, coupon.max_uses - coupon.uses - coupon.reserved_uses);
}

export function isCouponExpired(coupon: Pick<CouponOfferLike, "expires_at">, now = new Date()) {
  return Boolean(coupon.expires_at && new Date(coupon.expires_at).getTime() <= now.getTime());
}

export function calculateCouponPrice(coupon: CouponOfferLike) {
  const normal = Math.max(100, coupon.normal_price_cents);
  switch (coupon.benefit_type) {
    case "percentage_discount":
      return Math.max(100, Math.round(normal * (1 - (coupon.discount_percent ?? 0) / 100)));
    case "fixed_discount":
      return Math.max(100, normal - (coupon.discount_amount_cents ?? 0));
    case "first_month":
    case "special_price":
      return Math.max(100, coupon.promotional_price_cents ?? normal);
    case "trial":
      return 0;
  }
}

export function couponPostOfferPrice(coupon: CouponOfferLike) {
  if (coupon.benefit_type === "trial") {
    return Math.max(100, coupon.post_trial_price_cents ?? coupon.normal_price_cents);
  }
  return Math.max(100, coupon.normal_price_cents);
}

export function evaluateCouponAvailability(coupon: CouponOfferLike, viewer: CouponViewerContext) {
  if (!coupon.active) return { available: false, reason: "inactive" as const };
  if (isCouponExpired(coupon, viewer.now)) {
    return { available: false, reason: "expired" as const };
  }
  const remaining = couponRemainingSlots(coupon);
  if (remaining !== null && remaining <= 0) {
    return { available: false, reason: "sold_out" as const };
  }
  const usesByViewer = coupon.used_by_user_ids.filter((id) => id === viewer.userId).length;
  if (usesByViewer >= coupon.max_uses_per_user) {
    return { available: false, reason: "already_used" as const };
  }
  if (viewer.isActiveSubscriber) {
    return { available: false, reason: "already_active" as const };
  }
  if (coupon.eligibility === "new_subscribers" && viewer.wasSubscriber) {
    return { available: false, reason: "new_only" as const };
  }
  if (coupon.eligibility === "former_subscribers" && !viewer.wasSubscriber) {
    return { available: false, reason: "former_only" as const };
  }
  return { available: true, reason: null, remaining };
}

export interface CouponDraftInput {
  code: string;
  benefitType: CouponBenefitType;
  benefitValue: number;
  normalPriceCents: number;
  maxUses: number;
  expiresAt: string | null;
  trialDays: number;
  postTrialPriceCents: number;
}

export function validateCouponDraft(input: CouponDraftInput) {
  const errors: string[] = [];
  if (!/^[A-Z0-9_-]{3,30}$/.test(input.code)) {
    errors.push("Use de 3 a 30 letras, números, hífen ou sublinhado no código.");
  }
  if (input.normalPriceCents < 100) errors.push("O valor normal precisa ser válido.");
  if (input.maxUses < 0) errors.push("A quantidade de vagas não pode ser negativa.");
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now()) {
    errors.push("A expiração precisa estar no futuro.");
  }
  if (
    input.benefitType === "percentage_discount" &&
    (input.benefitValue < 1 || input.benefitValue > 90)
  ) {
    errors.push("O desconto percentual deve ficar entre 1% e 90%.");
  }
  if (
    input.benefitType === "fixed_discount" &&
    (input.benefitValue < 1 || input.benefitValue * 100 >= input.normalPriceCents)
  ) {
    errors.push("O desconto fixo precisa ser menor que o valor normal.");
  }
  if (
    ["first_month", "special_price"].includes(input.benefitType) &&
    (input.benefitValue < 1 || input.benefitValue * 100 >= input.normalPriceCents)
  ) {
    errors.push("O preço promocional precisa ser menor que o valor normal.");
  }
  if (input.benefitType === "trial") {
    if (input.trialDays < 1 || input.trialDays > 30) {
      errors.push("O teste pode durar de 1 a 30 dias.");
    }
    if (input.postTrialPriceCents < 100) errors.push("Informe o valor após o período de teste.");
  }
  return errors;
}

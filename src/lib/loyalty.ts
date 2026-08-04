export type LoyaltyTier = "bronze" | "silver" | "gold" | "diamond" | "vip";

export const LOYALTY_TIERS: LoyaltyTier[] = ["bronze", "silver", "gold", "diamond", "vip"];

export const LOYALTY_THRESHOLDS: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 150,
  gold: 500,
  diamond: 1_200,
  vip: 2_500,
};

export const TIER_META: Record<
  LoyaltyTier,
  { label: string; labelEn: string; emoji: string; color: string; bg: string }
> = {
  bronze: {
    label: "Bronze",
    labelEn: "Bronze",
    emoji: "🥉",
    color: "text-orange-600 dark:text-orange-300",
    bg: "bg-orange-500/10 border-orange-500/30",
  },
  silver: {
    label: "Prata",
    labelEn: "Silver",
    emoji: "🥈",
    color: "text-slate-600 dark:text-slate-300",
    bg: "bg-slate-500/10 border-slate-500/30",
  },
  gold: {
    label: "Ouro",
    labelEn: "Gold",
    emoji: "🥇",
    color: "text-yellow-700 dark:text-yellow-300",
    bg: "bg-yellow-500/10 border-yellow-500/30",
  },
  diamond: {
    label: "Diamante",
    labelEn: "Diamond",
    emoji: "💎",
    color: "text-cyan-700 dark:text-cyan-300",
    bg: "bg-cyan-500/10 border-cyan-500/30",
  },
  vip: {
    label: "VIP",
    labelEn: "VIP",
    emoji: "👑",
    color: "text-fuchsia-700 dark:text-fuchsia-300",
    bg: "bg-fuchsia-500/10 border-fuchsia-500/30",
  },
};

export function loyaltyTierFromPoints(points: number): LoyaltyTier {
  if (points >= LOYALTY_THRESHOLDS.vip) return "vip";
  if (points >= LOYALTY_THRESHOLDS.diamond) return "diamond";
  if (points >= LOYALTY_THRESHOLDS.gold) return "gold";
  if (points >= LOYALTY_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export function loyaltyTierRank(tier: LoyaltyTier | string | null | undefined) {
  const index = LOYALTY_TIERS.indexOf((tier ?? "bronze") as LoyaltyTier);
  return index < 0 ? 0 : index;
}

export function loyaltyProgress(points: number) {
  const tier = loyaltyTierFromPoints(points);
  const index = LOYALTY_TIERS.indexOf(tier);
  const nextTier = LOYALTY_TIERS[index + 1] ?? null;
  if (!nextTier) {
    return { tier, nextTier: null, currentFloor: LOYALTY_THRESHOLDS[tier], nextAt: null, pct: 100 };
  }
  const currentFloor = LOYALTY_THRESHOLDS[tier];
  const nextAt = LOYALTY_THRESHOLDS[nextTier];
  const pct = Math.max(
    0,
    Math.min(100, Math.round(((points - currentFloor) / (nextAt - currentFloor)) * 100)),
  );
  return { tier, nextTier, currentFloor, nextAt, pct };
}

export function tierMeetsMinimum(tier: LoyaltyTier, minimum: LoyaltyTier) {
  return loyaltyTierRank(tier) >= loyaltyTierRank(minimum);
}

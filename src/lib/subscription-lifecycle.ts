export type RenewalReminderDay = 1 | 3 | 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilSubscriptionEnds(periodEnd: string | null, now = new Date()) {
  if (!periodEnd) return null;
  const end = new Date(periodEnd).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - now.getTime()) / DAY_MS);
}
export function getRenewalReminderDay(
  periodEnd: string | null,
  now = new Date(),
): RenewalReminderDay | null {
  const days = daysUntilSubscriptionEnds(periodEnd, now);
  return days === 1 || days === 3 || days === 7 ? days : null;
}

export function shouldOfferManualRenewal(periodEnd: string | null, now = new Date()) {
  const days = daysUntilSubscriptionEnds(periodEnd, now);
  return days !== null && days >= 1 && days <= 7;
}

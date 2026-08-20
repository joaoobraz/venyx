export const MIN_WITHDRAWAL_CENTS = 3_000;
export const DAILY_WITHDRAWAL_LIMIT = 5;
export const ADDITIONAL_WITHDRAWAL_FEE_CENTS = 300;

const DAILY_LIMIT_STATUSES = new Set(["pending", "approved", "processing", "paid"]);

export type DailyWithdrawal = {
  created_at: string;
  status: string;
};

export function countsTowardDailyWithdrawalLimit(status: string): boolean {
  return DAILY_LIMIT_STATUSES.has(status);
}

export function saoPauloDateKey(value: string | number | Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function countDailyWithdrawals(
  withdrawals: DailyWithdrawal[],
  now: string | number | Date = new Date(),
): number {
  const today = saoPauloDateKey(now);
  return withdrawals.filter(
    (withdrawal) =>
      countsTowardDailyWithdrawalLimit(withdrawal.status) &&
      saoPauloDateKey(withdrawal.created_at) === today,
  ).length;
}

export function withdrawalFeeForDailyCount(existingCount: number): number {
  return existingCount <= 0 ? 0 : ADDITIONAL_WITHDRAWAL_FEE_CENTS;
}

export function maximumWithdrawalAmount(availableCents: number, existingCount: number): number {
  return Math.max(availableCents - withdrawalFeeForDailyCount(existingCount), 0);
}

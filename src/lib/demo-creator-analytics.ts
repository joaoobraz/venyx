export type AnalyticsPeriodPreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_60_days"
  | "last_90_days"
  | "custom";

export interface AnalyticsDateRange {
  startDate: string;
  endDate: string;
}

export interface CreatorAnalyticsSummary {
  revenueCents: number;
  newSubscribers: number;
  cancellations: number;
  visits: number;
  conversions: number;
  conversionRate: number;
  ppvSold: number;
  tipsReceived: number;
  messages: number;
  renewalsCompleted: number;
  renewalsDue: number;
  renewalRate: number;
  days: number;
}

type DatedPurchase = {
  kind: "ppv" | "subscription";
  amount_cents: number;
  status: string;
  created_at: string;
};

type DatedTip = {
  amount_cents: number;
  payment_status: string;
  created_at: string;
};

const DAY_MS = 86_400_000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

export function resolveAnalyticsPeriod(
  preset: Exclude<AnalyticsPeriodPreset, "custom">,
  now = new Date(),
): AnalyticsDateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") {
    const date = dateInputValue(today);
    return { startDate: date, endDate: date };
  }
  if (preset === "yesterday") {
    const date = dateInputValue(shiftDate(today, -1));
    return { startDate: date, endDate: date };
  }
  const days =
    preset === "last_7_days"
      ? 7
      : preset === "last_60_days"
        ? 60
        : preset === "last_90_days"
          ? 90
          : 30;
  return {
    startDate: dateInputValue(shiftDate(today, -(days - 1))),
    endDate: dateInputValue(today),
  };
}

export function validateAnalyticsRange(range: AnalyticsDateRange, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(range.endDate)) {
    return "required" as const;
  }
  const start = dateFromInput(range.startDate);
  const end = dateFromInput(range.endDate);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    dateInputValue(start) !== range.startDate ||
    dateInputValue(end) !== range.endDate
  ) {
    return "invalid" as const;
  }
  if (start > end) return "inverted" as const;
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (end > todayDate) return "future" as const;
  return null;
}

function seededFraction(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}

function inRange(createdAt: string, range: AnalyticsDateRange) {
  const key = dateInputValue(new Date(createdAt));
  return key >= range.startDate && key <= range.endDate;
}

export function summarizeCreatorAnalytics({
  range,
  purchases = [],
  tips = [],
}: {
  range: AnalyticsDateRange;
  purchases?: DatedPurchase[];
  tips?: DatedTip[];
}): CreatorAnalyticsSummary {
  const start = dateFromInput(range.startDate);
  const end = dateFromInput(range.endDate);
  const total: CreatorAnalyticsSummary = {
    revenueCents: 0,
    newSubscribers: 0,
    cancellations: 0,
    visits: 0,
    conversions: 0,
    conversionRate: 0,
    ppvSold: 0,
    tipsReceived: 0,
    messages: 0,
    renewalsCompleted: 0,
    renewalsDue: 0,
    renewalRate: 0,
    days: 0,
  };

  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    const seed = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
    const weekdayFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.86 : 1;
    const visits = Math.round((235 + seededFraction(seed) * 105) * weekdayFactor);
    const newSubscribers = Math.max(1, Math.round(1 + seededFraction(seed + 3) * 2.4));
    const cancellations = Math.round(seededFraction(seed + 7) * 1.35);
    const ppvSold = Math.round((7 + seededFraction(seed + 11) * 9) * weekdayFactor);
    const tipsReceived = Math.round((3 + seededFraction(seed + 17) * 6) * weekdayFactor);
    const messages = Math.round((58 + seededFraction(seed + 23) * 72) * weekdayFactor);
    const renewalsDue = Math.max(1, Math.round(3 + seededFraction(seed + 29) * 5));
    const renewalRate = 0.82 + seededFraction(seed + 31) * 0.12;
    const renewalsCompleted = Math.min(renewalsDue, Math.round(renewalsDue * renewalRate));
    const conversions = newSubscribers + ppvSold + tipsReceived;
    const revenueCents =
      newSubscribers * 2_490 +
      renewalsCompleted * 2_490 +
      ppvSold * Math.round(990 + seededFraction(seed + 37) * 1_400) +
      tipsReceived * Math.round(1_000 + seededFraction(seed + 41) * 3_500);

    total.days += 1;
    total.visits += visits;
    total.newSubscribers += newSubscribers;
    total.cancellations += cancellations;
    total.ppvSold += ppvSold;
    total.tipsReceived += tipsReceived;
    total.messages += messages;
    total.renewalsDue += renewalsDue;
    total.renewalsCompleted += renewalsCompleted;
    total.conversions += conversions;
    total.revenueCents += revenueCents;
  }

  for (const purchase of purchases) {
    if (purchase.status !== "paid" || !inRange(purchase.created_at, range)) continue;
    total.revenueCents += purchase.amount_cents;
    total.conversions += 1;
    if (purchase.kind === "ppv") total.ppvSold += 1;
    if (purchase.kind === "subscription") total.newSubscribers += 1;
  }

  for (const tip of tips) {
    if (tip.payment_status !== "paid" || !inRange(tip.created_at, range)) continue;
    total.revenueCents += tip.amount_cents;
    total.tipsReceived += 1;
    total.conversions += 1;
  }

  total.conversionRate = total.visits > 0 ? (total.conversions / total.visits) * 100 : 0;
  total.renewalRate =
    total.renewalsDue > 0 ? (total.renewalsCompleted / total.renewalsDue) * 100 : 0;
  return total;
}

export const MIN_GOAL_CONTRIBUTION_CENTS = 100;
export const MAX_GOAL_CONTRIBUTION_CENTS = 5_000_000;

function roundUpFriendly(value: number) {
  const step = value <= 2_000 ? 100 : value <= 10_000 ? 500 : 1_000;
  return Math.ceil(value / step) * step;
}

export function buildGoalContributionPresets(input: {
  minimumCents: number;
}) {
  const minimum = Math.max(MIN_GOAL_CONTRIBUTION_CENTS, Math.round(input.minimumCents));

  const candidates = [
    minimum,
    roundUpFriendly(minimum * 2),
    roundUpFriendly(minimum * 5),
    roundUpFriendly(minimum * 10),
  ];

  return Array.from(new Set(candidates))
    .filter((amount) => amount <= MAX_GOAL_CONTRIBUTION_CENTS)
    .slice(0, 4);
}

export function parseGoalContributionToCents(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export function validateGoalContribution(input: {
  amountCents: number | null;
  minimumCents: number;
}) {
  if (input.amountCents === null || input.amountCents < input.minimumCents) {
    return `A contribuição mínima é de R$ ${(input.minimumCents / 100).toFixed(2).replace(".", ",")}.`;
  }
  if (input.amountCents > MAX_GOAL_CONTRIBUTION_CENTS) {
    return "O valor informado ultrapassa o limite permitido.";
  }
  return null;
}

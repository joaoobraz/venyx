import { DEMO_CREATORS, getDemoCreatorById } from "./demo-creators.ts";
import { loyaltyTierFromPoints, tierMeetsMinimum, type LoyaltyTier } from "./loyalty.ts";

export type DemoLoyaltyReason =
  | "subscription"
  | "renewal_streak"
  | "ppv_spend"
  | "ppv_bonus"
  | "gift"
  | "post_like"
  | "post_comment"
  | "manual_seed";

export type DemoRewardType =
  | "renewal_discount"
  | "ppv_coupon"
  | "exclusive_content"
  | "personal_message"
  | "early_access"
  | "fan_badge";

export interface DemoLoyaltyLedgerEntry {
  id: string;
  creatorId: string;
  points: number;
  reason: DemoLoyaltyReason;
  label: string;
  refId: string;
  createdAt: string;
}

export interface DemoLoyaltyRelationship {
  creatorId: string;
  points: number;
  streakMonths: number;
  joinedAt: string;
  ledger: DemoLoyaltyLedgerEntry[];
}

export interface DemoLoyaltyReward {
  id: string;
  title: string;
  description: string;
  type: DemoRewardType;
  minimumTier: LoyaltyTier;
  stock: number | null;
  redeemedCount: number;
  active: boolean;
  expiresAt: string | null;
}

export interface DemoLoyaltyClaim {
  id: string;
  rewardId: string;
  creatorId: string;
  claimedAt: string;
  status: "available" | "used";
}

export interface DemoFanLoyalty {
  userId: string;
  username: string;
  displayName: string;
  globalPoints: number;
  creatorPoints: number;
  streakMonths: number;
  lastActiveAt: string;
}

export interface DemoLoyaltyProgram {
  creatorId: string;
  enabled: boolean;
  interactionPointsEnabled: boolean;
  showGlobalTier: boolean;
  rewards: DemoLoyaltyReward[];
}

export interface DemoLoyaltyState {
  globalPoints: number;
  relationships: DemoLoyaltyRelationship[];
  claims: DemoLoyaltyClaim[];
  program: DemoLoyaltyProgram;
  fans: DemoFanLoyalty[];
}

const STORAGE_VERSION = "v2";
const DAY = 86_400_000;
export const DEMO_LOYALTY_CHANGED_EVENT = "venyx:demo:loyalty-changed";

function storageKey(userId: string) {
  return `venyx:demo:loyalty:${STORAGE_VERSION}:${userId}`;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY).toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function ledger(
  creatorId: string,
  points: number,
  reason: DemoLoyaltyReason,
  label: string,
  refId: string,
  ago: number,
): DemoLoyaltyLedgerEntry {
  return {
    id: `loyalty-${refId}`,
    creatorId,
    points,
    reason,
    label,
    refId,
    createdAt: daysAgo(ago),
  };
}

function defaultRewards(): DemoLoyaltyReward[] {
  return [
    {
      id: "reward-bronze-badge",
      title: "Selo de fã",
      description: "Selo Bronze exibido nas interações com a modelo.",
      type: "fan_badge",
      minimumTier: "bronze",
      stock: null,
      redeemedCount: 184,
      active: true,
      expiresAt: null,
    },
    {
      id: "reward-silver-renewal",
      title: "5% na próxima renovação",
      description: "Cupom pessoal, válido uma vez durante a assinatura ativa.",
      type: "renewal_discount",
      minimumTier: "silver",
      stock: 200,
      redeemedCount: 62,
      active: true,
      expiresAt: null,
    },
    {
      id: "reward-gold-ppv",
      title: "15% em um PPV",
      description: "Benefício para um conteúdo PPV escolhido pelo fã.",
      type: "ppv_coupon",
      minimumTier: "gold",
      stock: 120,
      redeemedCount: 38,
      active: true,
      expiresAt: null,
    },
    {
      id: "reward-diamond-early",
      title: "Acesso antecipado",
      description: "Veja uma publicação selecionada 24 horas antes.",
      type: "early_access",
      minimumTier: "diamond",
      stock: 80,
      redeemedCount: 21,
      active: true,
      expiresAt: null,
    },
    {
      id: "reward-vip-content",
      title: "Conteúdo VIP mensal",
      description: "Um conteúdo exclusivo selecionado pela modelo a cada mês.",
      type: "exclusive_content",
      minimumTier: "vip",
      stock: 50,
      redeemedCount: 12,
      active: true,
      expiresAt: null,
    },
  ];
}

function relationship(
  creatorId: string,
  points: number,
  streakMonths: number,
  entries: DemoLoyaltyLedgerEntry[],
): DemoLoyaltyRelationship {
  return {
    creatorId,
    points,
    streakMonths,
    joinedAt: daysAgo(30 * Math.max(streakMonths, 1)),
    ledger: entries,
  };
}

export function createDemoLoyaltySeed(): DemoLoyaltyState {
  const aline = "demo-aline";
  const camila = "demo-camila";
  const valentina = "demo-valentina";
  return {
    globalPoints: 1_650,
    relationships: [
      relationship(aline, 920, 8, [
        ledger(aline, 49, "subscription", "Renovação mensal com Aline", "aline-renew-8", 3),
        ledger(aline, 25, "renewal_streak", "Sequência de 8 meses", "aline-streak-8", 3),
        ledger(aline, 35, "ppv_spend", "PPV desbloqueado", "aline-ppv-12", 8),
        ledger(aline, 5, "ppv_bonus", "Bônus por comprar PPV", "aline-ppv-bonus-12", 8),
        ledger(aline, 50, "gift", "Mimo confirmado", "aline-gift-7", 14),
      ]),
      relationship(camila, 540, 5, [
        ledger(camila, 49, "subscription", "Renovação mensal com Camila", "camila-renew-5", 6),
        ledger(camila, 25, "renewal_streak", "Sequência de 5 meses", "camila-streak-5", 6),
        ledger(camila, 24, "ppv_spend", "PPV desbloqueado", "camila-ppv-4", 18),
      ]),
      relationship(valentina, 190, 3, [
        ledger(
          valentina,
          39,
          "subscription",
          "Renovação mensal com Valentina",
          "valentina-renew-3",
          11,
        ),
        ledger(valentina, 25, "renewal_streak", "Sequência de 3 meses", "valentina-streak-3", 11),
      ]),
    ],
    claims: [],
    program: {
      creatorId: aline,
      enabled: true,
      interactionPointsEnabled: true,
      showGlobalTier: true,
      rewards: defaultRewards(),
    },
    fans: [
      ["demo-lead-2", "lucas_mendes", "Lucas Mendes", 3_220, 2_680, 18, 0],
      ["demo-lead-3", "felipe_alves", "Felipe Alves", 1_940, 1_380, 12, 1],
      ["demo-lead-1", "joao_silva", "João Silva", 1_650, 920, 8, 0],
      ["demo-lead-10", "henrique_melo", "Henrique Melo", 1_110, 780, 7, 2],
      ["demo-lead-5", "rafael_lima_2", "Rafael Lima", 870, 610, 6, 3],
      ["demo-lead-7", "andre_souza", "André Souza", 690, 540, 5, 4],
      ["demo-lead-4", "bruno_costa", "Bruno Costa", 520, 390, 4, 5],
      ["demo-lead-6", "diego_rocha", "Diego Rocha", 410, 310, 3, 7],
      ["demo-lead-8", "pedro_martins", "Pedro Martins", 260, 205, 3, 8],
      ["demo-lead-9", "gustavo_nunes", "Gustavo Nunes", 185, 140, 2, 10],
      ["demo-lead-11", "caio_ramos", "Caio Ramos", 128, 96, 2, 12],
      ["demo-lead-12", "matheus_freitas", "Matheus Freitas", 84, 62, 1, 16],
      ["demo-lead-13", "thiago_cardoso", "Thiago Cardoso", 55, 41, 1, 20],
      ["demo-lead-14", "eduardo_reis", "Eduardo Reis", 31, 24, 1, 25],
      ["demo-lead-15", "daniel_araujo", "Daniel Araújo", 18, 12, 1, 32],
    ].map(([userId, username, displayName, globalPoints, creatorPoints, streakMonths, ago]) => ({
      userId: String(userId),
      username: String(username),
      displayName: String(displayName),
      globalPoints: Number(globalPoints),
      creatorPoints: Number(creatorPoints),
      streakMonths: Number(streakMonths),
      lastActiveAt: daysAgo(Number(ago)),
    })),
  };
}

function normalizeState(value: DemoLoyaltyState): DemoLoyaltyState {
  const seed = createDemoLoyaltySeed();
  return {
    ...seed,
    ...value,
    relationships: value.relationships ?? seed.relationships,
    claims: value.claims ?? [],
    fans: value.fans ?? seed.fans,
    program: {
      ...seed.program,
      ...value.program,
      rewards: value.program?.rewards ?? seed.program.rewards,
    },
  };
}

export function readDemoLoyalty(userId: string): DemoLoyaltyState {
  if (typeof window === "undefined") return createDemoLoyaltySeed();
  try {
    const stored = localStorage.getItem(storageKey(userId));
    if (stored) return normalizeState(JSON.parse(stored) as DemoLoyaltyState);
  } catch {
    // Corrupted local demo data is replaced by the safe seed.
  }
  const seed = createDemoLoyaltySeed();
  localStorage.setItem(storageKey(userId), JSON.stringify(seed));
  return seed;
}

export function writeDemoLoyalty(userId: string, state: DemoLoyaltyState) {
  if (typeof window === "undefined") return state;
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
  window.dispatchEvent(new Event(DEMO_LOYALTY_CHANGED_EVENT));
  return state;
}

export function updateDemoLoyalty(
  userId: string,
  update: (state: DemoLoyaltyState) => DemoLoyaltyState,
) {
  return writeDemoLoyalty(userId, update(readDemoLoyalty(userId)));
}

export function awardDemoLoyaltyPoints(input: {
  userId: string;
  creatorId: string;
  points: number;
  reason: DemoLoyaltyReason;
  label: string;
  refId: string;
}) {
  const points = Math.max(0, Math.floor(input.points));
  if (!points || !input.creatorId || input.creatorId === input.userId)
    return readDemoLoyalty(input.userId);
  return updateDemoLoyalty(input.userId, (state) => {
    const isProgramCreator = input.creatorId === state.program.creatorId;
    const isEngagement = input.reason === "post_like" || input.reason === "post_comment";
    if (isProgramCreator && !state.program.enabled) return state;
    if (isProgramCreator && isEngagement && !state.program.interactionPointsEnabled) return state;

    const existingRelationship = state.relationships.find(
      (item) => item.creatorId === input.creatorId,
    );
    if (
      existingRelationship?.ledger.some(
        (entry) => entry.reason === input.reason && entry.refId === input.refId,
      )
    ) {
      return state;
    }
    const weekStartedAt = Date.now() - 7 * DAY;
    const weeklyEngagementPoints = isEngagement
      ? (existingRelationship?.ledger ?? [])
          .filter(
            (entry) =>
              (entry.reason === "post_like" || entry.reason === "post_comment") &&
              new Date(entry.createdAt).getTime() >= weekStartedAt,
          )
          .reduce((total, entry) => total + entry.points, 0)
      : 0;
    const awardedPoints = isEngagement
      ? Math.min(points, Math.max(10 - weeklyEngagementPoints, 0))
      : points;
    if (!awardedPoints) return state;

    const entry: DemoLoyaltyLedgerEntry = {
      id: createId("loyalty"),
      creatorId: input.creatorId,
      points: awardedPoints,
      reason: input.reason,
      label: input.label,
      refId: input.refId,
      createdAt: new Date().toISOString(),
    };
    const relationships = existingRelationship
      ? state.relationships.map((item) =>
          item.creatorId === input.creatorId
            ? {
                ...item,
                points: item.points + awardedPoints,
                ledger: [entry, ...item.ledger].slice(0, 100),
              }
            : item,
        )
      : [relationship(input.creatorId, awardedPoints, 1, [entry]), ...state.relationships];
    const fans = state.fans.map((fan) =>
      fan.userId === "demo-lead-1" && input.creatorId === state.program.creatorId
        ? {
            ...fan,
            globalPoints: fan.globalPoints + awardedPoints,
            creatorPoints: fan.creatorPoints + awardedPoints,
            lastActiveAt: entry.createdAt,
          }
        : fan,
    );
    return { ...state, globalPoints: state.globalPoints + awardedPoints, relationships, fans };
  });
}

export function awardDemoPurchaseLoyalty(input: {
  userId: string;
  creatorId: string;
  creatorName: string;
  kind: "ppv" | "subscription";
  amountCents: number;
  refId: string;
}) {
  const spendPoints = Math.max(1, Math.floor(input.amountCents / 100));
  awardDemoLoyaltyPoints({
    userId: input.userId,
    creatorId: input.creatorId,
    points: spendPoints,
    reason: input.kind === "ppv" ? "ppv_spend" : "subscription",
    label:
      input.kind === "ppv"
        ? `PPV desbloqueado de ${input.creatorName}`
        : `Assinatura confirmada com ${input.creatorName}`,
    refId: input.refId,
  });
  if (input.kind === "ppv") {
    awardDemoLoyaltyPoints({
      userId: input.userId,
      creatorId: input.creatorId,
      points: 5,
      reason: "ppv_bonus",
      label: "Bônus por comprar PPV",
      refId: input.refId,
    });
  }
}

export function awardDemoGiftLoyalty(input: {
  userId: string;
  creatorId: string;
  creatorName: string;
  amountCents: number;
  refId: string;
}) {
  awardDemoLoyaltyPoints({
    userId: input.userId,
    creatorId: input.creatorId,
    points: Math.max(1, Math.floor(input.amountCents / 100)),
    reason: "gift",
    label: `Mimo confirmado para ${input.creatorName}`,
    refId: input.refId,
  });
}

export function setDemoLoyaltyProgram(
  userId: string,
  patch: Partial<Pick<DemoLoyaltyProgram, "enabled" | "interactionPointsEnabled">>,
) {
  return updateDemoLoyalty(userId, (state) => ({
    ...state,
    program: { ...state.program, ...patch },
  }));
}

export function saveDemoLoyaltyReward(
  userId: string,
  reward: Omit<DemoLoyaltyReward, "id" | "redeemedCount"> & { id?: string },
) {
  return updateDemoLoyalty(userId, (state) => {
    const existing = reward.id ? state.program.rewards.find((item) => item.id === reward.id) : null;
    const saved: DemoLoyaltyReward = {
      ...reward,
      id: reward.id ?? createId("reward"),
      redeemedCount: existing?.redeemedCount ?? 0,
    };
    const rewards = existing
      ? state.program.rewards.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...state.program.rewards];
    return { ...state, program: { ...state.program, rewards } };
  });
}

export function toggleDemoLoyaltyReward(userId: string, rewardId: string) {
  return updateDemoLoyalty(userId, (state) => ({
    ...state,
    program: {
      ...state.program,
      rewards: state.program.rewards.map((reward) =>
        reward.id === rewardId ? { ...reward, active: !reward.active } : reward,
      ),
    },
  }));
}

export function claimDemoLoyaltyReward(userId: string, rewardId: string) {
  let error: string | null = null;
  let alreadyClaimed = false;
  const next = updateDemoLoyalty(userId, (state) => {
    const reward = state.program.rewards.find((item) => item.id === rewardId);
    const relationship = state.relationships.find(
      (item) => item.creatorId === state.program.creatorId,
    );
    const hasExistingClaim = state.claims.some((claim) => claim.rewardId === rewardId);
    if (!state.program.enabled || !reward || !reward.active || !relationship) {
      error = "Benefício indisponível.";
      return state;
    }
    if (!tierMeetsMinimum(loyaltyTierFromPoints(relationship.points), reward.minimumTier)) {
      error = "Seu nível ainda não libera este benefício.";
      return state;
    }
    if (hasExistingClaim) {
      alreadyClaimed = true;
      return state;
    }
    if (reward.stock !== null && reward.redeemedCount >= reward.stock) {
      error = "As vagas deste benefício acabaram.";
      return state;
    }
    return {
      ...state,
      claims: [
        ...state.claims,
        {
          id: createId("claim"),
          rewardId,
          creatorId: state.program.creatorId,
          claimedAt: new Date().toISOString(),
          status: "available" as const,
        },
      ],
      program: {
        ...state.program,
        rewards: state.program.rewards.map((item) =>
          item.id === rewardId ? { ...item, redeemedCount: item.redeemedCount + 1 } : item,
        ),
      },
    };
  });
  return { state: next, error, alreadyClaimed };
}

export function getDemoFanLoyalty(userId: string, fanId: string) {
  return readDemoLoyalty(userId).fans.find((fan) => fan.userId === fanId) ?? null;
}

export function getDemoRelationship(userId: string, creatorId: string) {
  return readDemoLoyalty(userId).relationships.find((item) => item.creatorId === creatorId) ?? null;
}

export function relationshipCreator(relationship: DemoLoyaltyRelationship) {
  return getDemoCreatorById(relationship.creatorId) ?? DEMO_CREATORS[0];
}

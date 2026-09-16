import assert from "node:assert/strict";
import test from "node:test";
import {
  awardDemoLoyaltyPoints,
  claimDemoLoyaltyReward,
  readDemoLoyalty,
  setDemoLoyaltyProgram,
} from "../src/lib/demo-loyalty.ts";
import { loyaltyTierFromPoints } from "../src/lib/loyalty.ts";

function installBrowserStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: { dispatchEvent: () => true },
    configurable: true,
  });
}

function removeBrowserStorage() {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
}

test("usa os cinco níveis aprovados", () => {
  assert.equal(loyaltyTierFromPoints(0), "bronze");
  assert.equal(loyaltyTierFromPoints(150), "silver");
  assert.equal(loyaltyTierFromPoints(500), "gold");
  assert.equal(loyaltyTierFromPoints(1_200), "diamond");
  assert.equal(loyaltyTierFromPoints(2_500), "vip");
});

test("não duplica eventos e limita interações a dez pontos por semana", () => {
  installBrowserStorage();
  const userId = "viewer-loyalty-cap";
  const creatorId = "demo-aline";
  const initial = readDemoLoyalty(userId);
  const initialPoints =
    initial.relationships.find((item) => item.creatorId === creatorId)?.points ?? 0;

  for (let index = 0; index < 8; index += 1) {
    awardDemoLoyaltyPoints({
      userId,
      creatorId,
      points: 2,
      reason: "post_comment",
      label: "Comentário aprovado",
      refId: `comment-${index}`,
    });
  }
  awardDemoLoyaltyPoints({
    userId,
    creatorId,
    points: 2,
    reason: "post_comment",
    label: "Comentário aprovado",
    refId: "comment-0",
  });

  const result = readDemoLoyalty(userId);
  const points = result.relationships.find((item) => item.creatorId === creatorId)?.points ?? 0;
  assert.equal(points - initialPoints, 10);
  removeBrowserStorage();
});

test("pausar o programa preserva o saldo e impede novos pontos", () => {
  installBrowserStorage();
  const userId = "viewer-loyalty-pause";
  const creatorId = "demo-aline";
  setDemoLoyaltyProgram(userId, { enabled: false });
  const before = readDemoLoyalty(userId).globalPoints;
  awardDemoLoyaltyPoints({
    userId,
    creatorId,
    points: 50,
    reason: "gift",
    label: "Mimo confirmado",
    refId: "gift-paused",
  });
  assert.equal(readDemoLoyalty(userId).globalPoints, before);
  removeBrowserStorage();
});

test("resgatar benefício não consome pontos e é idempotente", () => {
  installBrowserStorage();
  const userId = "viewer-loyalty-claim";
  const state = readDemoLoyalty(userId);
  const reward = state.program.rewards.find((item) => item.minimumTier === "gold");
  assert.ok(reward);
  const before = state.globalPoints;
  assert.equal(claimDemoLoyaltyReward(userId, reward.id).error, null);
  assert.equal(claimDemoLoyaltyReward(userId, reward.id).alreadyClaimed, true);
  assert.equal(readDemoLoyalty(userId).globalPoints, before);
  removeBrowserStorage();
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoalContributionPresets,
  parseGoalContributionToCents,
  validateGoalContribution,
} from "../src/lib/goal-contributions.ts";

test("oferece valores rápidos a partir do mínimo definido pela modelo", () => {
  assert.deepEqual(
    buildGoalContributionPresets({
      minimumCents: 1_000,
    }),
    [1_000, 2_000, 5_000, 10_000],
  );
});

test("aceita valor livre com vírgula e respeita o mínimo", () => {
  const amountCents = parseGoalContributionToCents("35,50");
  assert.equal(amountCents, 3_550);
  assert.equal(
    validateGoalContribution({ amountCents, minimumCents: 1_000 }),
    null,
  );
  assert.match(
    validateGoalContribution({ amountCents: 500, minimumCents: 1_000 }) ?? "",
    /mínima/,
  );
});

test("aceita contribuição maior que o valor restante da meta", () => {
  assert.equal(validateGoalContribution({ amountCents: 50_000, minimumCents: 1_000 }), null);
  assert.deepEqual(buildGoalContributionPresets({ minimumCents: 10_000 }), [
    10_000,
    20_000,
    50_000,
    100_000,
  ]);
});

test("mantém a meta aberta para apoio depois de atingir 100%", () => {
  assert.deepEqual(
    buildGoalContributionPresets({
      minimumCents: 1_000,
    }),
    [1_000, 2_000, 5_000, 10_000],
  );
  assert.equal(
    validateGoalContribution({
      amountCents: 25_000,
      minimumCents: 1_000,
    }),
    null,
  );
});

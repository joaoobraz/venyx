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
      targetCents: 50_000,
      raisedCents: 18_500,
    }),
    [1_000, 2_000, 5_000, 10_000],
  );
});

test("aceita valor livre com vírgula e respeita mínimo e saldo restante", () => {
  const amountCents = parseGoalContributionToCents("35,50");
  assert.equal(amountCents, 3_550);
  assert.equal(
    validateGoalContribution({ amountCents, minimumCents: 1_000, remainingCents: 10_000 }),
    null,
  );
  assert.match(
    validateGoalContribution({ amountCents: 500, minimumCents: 1_000, remainingCents: 10_000 }) ?? "",
    /mínima/,
  );
  assert.match(
    validateGoalContribution({ amountCents: 12_000, minimumCents: 1_000, remainingCents: 10_000 }) ?? "",
    /máximo/,
  );
});

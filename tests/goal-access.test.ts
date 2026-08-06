import assert from "node:assert/strict";
import test from "node:test";
import { hasGoalContentAccess } from "../src/lib/goal-access.ts";

test("meta libera somente quando o lead participou e a meta foi atingida", () => {
  assert.equal(hasGoalContentAccess({ goalReached: false, participated: false }), false);
  assert.equal(hasGoalContentAccess({ goalReached: false, participated: true }), false);
  assert.equal(hasGoalContentAccess({ goalReached: true, participated: false }), false);
  assert.equal(hasGoalContentAccess({ goalReached: true, participated: true }), true);
});

test("a criadora mantém acesso ao próprio conteúdo de meta", () => {
  assert.equal(
    hasGoalContentAccess({ isOwner: true, goalReached: false, participated: false }),
    true,
  );
});

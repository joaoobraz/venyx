import assert from "node:assert/strict";
import test from "node:test";
import { secureTokenMatches } from "../src/_server/impulsepay-webhook-security.ts";

test("aceita somente o token completo do webhook Impulse Pay", () => {
  assert.equal(secureTokenMatches("segredo-forte", "segredo-forte"), true);
  assert.equal(secureTokenMatches("segredo-forte", "segredo-fraco"), false);
  assert.equal(secureTokenMatches("segredo-forte", "segredo"), false);
  assert.equal(secureTokenMatches(undefined, "segredo-forte"), false);
  assert.equal(secureTokenMatches("segredo-forte", null), false);
});

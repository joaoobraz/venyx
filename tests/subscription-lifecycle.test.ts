import assert from "node:assert/strict";
import test from "node:test";
import {
  daysUntilSubscriptionEnds,
  getRenewalReminderDay,
  shouldOfferManualRenewal,
} from "../src/lib/subscription-lifecycle.ts";

const now = new Date("2026-08-02T12:00:00.000Z");

test("calcula dias restantes arredondando para preservar o dia corrente", () => {
  assert.equal(daysUntilSubscriptionEnds("2026-08-03T11:59:59.000Z", now), 1);
  assert.equal(daysUntilSubscriptionEnds("2026-08-05T12:00:00.000Z", now), 3);
  assert.equal(daysUntilSubscriptionEnds(null, now), null);
  assert.equal(daysUntilSubscriptionEnds("inválido", now), null);
});
test("dispara lembretes somente em 7, 3 e 1 dia", () => {
  assert.equal(getRenewalReminderDay("2026-08-09T12:00:00.000Z", now), 7);
  assert.equal(getRenewalReminderDay("2026-08-05T12:00:00.000Z", now), 3);
  assert.equal(getRenewalReminderDay("2026-08-03T12:00:00.000Z", now), 1);
  assert.equal(getRenewalReminderDay("2026-08-06T12:00:00.000Z", now), null);
});

test("oferece renovação manual somente na última semana ativa", () => {
  assert.equal(shouldOfferManualRenewal("2026-08-09T12:00:00.000Z", now), true);
  assert.equal(shouldOfferManualRenewal("2026-08-10T12:00:00.000Z", now), false);
  assert.equal(shouldOfferManualRenewal("2026-08-02T11:59:59.000Z", now), false);
});

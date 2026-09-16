import assert from "node:assert/strict";
import test from "node:test";
import {
  compareGatewayCharge,
  gatewayConfirmationIsSafe,
  normalizeGatewayCharge,
  sanitizedGatewayDetails,
} from "../src/lib/payment-reconciliation.ts";

const local = {
  amount_cents: 2990,
  external_id: "venyx-charge-1",
  gateway_transaction_id: "gateway-1",
};

test("normaliza a resposta autenticada da Impulse Pay", () => {
  const normalized = normalizeGatewayCharge({
    data: {
      id: "gateway-1",
      status: "PAID",
      amount: 2990,
      items: [{ product: { external_ref: "venyx-charge-1" } }],
      paid_at: "2026-08-02T12:00:00.000Z",
    },
  });
  assert.equal(normalized.status, "paid");
  assert.equal(normalized.amountCents, 2990);
  assert.deepEqual(normalized.transactionIds, ["gateway-1"]);
});
test("só confirma pagamento quando valor e referências conferem", () => {
  const correct = normalizeGatewayCharge({
    status: "PAID",
    amount: 2990,
    id: "gateway-1",
    items: [{ external_ref: "venyx-charge-1" }],
  });
  assert.equal(gatewayConfirmationIsSafe(local, correct), true);

  const wrongAmount = { ...correct, amountCents: 2989 };
  assert.equal(gatewayConfirmationIsSafe(local, wrongAmount), false);
  assert.equal(compareGatewayCharge(local, wrongAmount).amountMatches, false);
});

test("detalhes persistidos não incluem o nome do pagador", () => {
  const normalized = normalizeGatewayCharge({
    status: "PENDING",
    amount: 2990,
    payer: { name: "Dado pessoal" },
  });
  assert.equal("payerName" in sanitizedGatewayDetails(normalized), false);
});

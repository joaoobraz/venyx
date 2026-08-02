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

test("normaliza respostas aninhadas da NexusPag", () => {
  const normalized = normalizeGatewayCharge({
    data: {
      transaction: {
        id: "gateway-1",
        status: "PAID",
        amount: "29.90",
        external_id: "venyx-charge-1",
        paid_at: "2026-08-02T12:00:00.000Z",
      },
    },
  });
  assert.equal(normalized.status, "paid");
  assert.equal(normalized.amountCents, 2990);
  assert.deepEqual(normalized.transactionIds, ["gateway-1"]);
});
test("só confirma pagamento quando valor e referências conferem", () => {
  const correct = normalizeGatewayCharge({
    status: "paid",
    amount: 29.9,
    external_id: "venyx-charge-1",
    transaction_id: "gateway-1",
  });
  assert.equal(gatewayConfirmationIsSafe(local, correct), true);

  const wrongAmount = { ...correct, amountCents: 2989 };
  assert.equal(gatewayConfirmationIsSafe(local, wrongAmount), false);
  assert.equal(compareGatewayCharge(local, wrongAmount).amountMatches, false);
});

test("detalhes persistidos não incluem o nome do pagador", () => {
  const normalized = normalizeGatewayCharge({
    status: "pending",
    amount: 29.9,
    payer_name: "Dado pessoal",
  });
  assert.equal("payerName" in sanitizedGatewayDetails(normalized), false);
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fulfillPaidCharge, reconcileRefundedCharge } from "@/_server/payments-fulfillment.server";
import { getImpulsePayTransaction } from "@/_server/impulsepay.server";
import { secureTokenMatches } from "@/_server/impulsepay-webhook-security";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  compareGatewayCharge,
  gatewayConfirmationIsSafe,
  normalizeGatewayCharge,
} from "@/lib/payment-reconciliation";

const MAX_WEBHOOK_BYTES = 64 * 1024;

const transactionSchema = z
  .object({
    event: z.enum(["transaction.waiting_payment", "transaction.paid", "transaction.refunded"]),
    transaction: z
      .object({
        id: z.string().uuid(),
        status: z.string(),
        amount: z.number().int().positive(),
        paid_at: z.string().nullable().optional(),
      })
      .passthrough(),
    sent_at: z.string(),
  })
  .passthrough();

const withdrawalSchema = z
  .object({
    event: z.enum(["withdrawal.processing", "withdrawal.completed", "withdrawal.failed"]),
    withdrawal: z
      .object({
        id: z.string().uuid(),
        status: z.string(),
        amount: z.number().int().positive(),
        net_amount: z.number().int().nonnegative(),
        fee: z.number().int().nonnegative().optional(),
        end_to_end: z.string().nullable().optional(),
        paid_at: z.string().nullable().optional(),
      })
      .passthrough(),
    sent_at: z.string(),
  })
  .passthrough();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function processTransaction(payload: z.infer<typeof transactionSchema>) {
  if (payload.event === "transaction.waiting_payment") {
    return jsonResponse({ ok: true });
  }

  const { data: charge, error } = await supabaseAdmin
    .from("pix_charges")
    .select("id,status,amount_cents,external_id,gateway_transaction_id")
    .eq("gateway_transaction_id", payload.transaction.id)
    .maybeSingle();
  if (error) return jsonResponse({ ok: false, error: "Internal lookup failed" }, 500);
  if (!charge) return jsonResponse({ ok: true, ignored: true });
  if (payload.transaction.amount !== charge.amount_cents) {
    return jsonResponse({ ok: false, error: "Amount mismatch" }, 409);
  }

  let verified;
  try {
    verified = normalizeGatewayCharge(await getImpulsePayTransaction(payload.transaction.id));
  } catch (lookupError) {
    console.error(
      "[impulsepay-webhook] transaction verification failed",
      lookupError instanceof Error ? lookupError.name : "unknown",
    );
    return jsonResponse({ ok: false, error: "Verification failed" }, 502);
  }

  const comparison = compareGatewayCharge(charge, verified);
  if (
    !comparison.amountMatches ||
    !comparison.externalIdMatches ||
    !comparison.transactionMatches
  ) {
    console.warn("[impulsepay-webhook] verified transaction mismatch", comparison);
    return jsonResponse({ ok: false, error: "Transaction mismatch" }, 409);
  }

  if (payload.event === "transaction.paid") {
    if (!gatewayConfirmationIsSafe(charge, verified)) {
      return jsonResponse({ ok: false, error: "Transaction is not paid" }, 409);
    }
    const result = await fulfillPaidCharge({
      externalId: charge.external_id,
      gatewayTransactionId: charge.gateway_transaction_id,
      paidAt: verified.paidAt,
      payerName: verified.payerName,
    });
    if (!result.ok) return jsonResponse({ ok: false, error: "Fulfillment pending" }, 503);
    return jsonResponse({ ok: true, fulfilled: !result.alreadyFulfilled });
  }

  if (verified.status !== "refunded") {
    return jsonResponse({ ok: false, error: "Transaction is not refunded" }, 409);
  }
  const result = await reconcileRefundedCharge({
    chargeId: charge.id,
    gatewayReference: payload.transaction.id,
    amountCents: charge.amount_cents,
  });
  if (!result.ok) return jsonResponse({ ok: false, error: "Refund reconciliation pending" }, 503);
  return jsonResponse({ ok: true, reconciled: !result.alreadyRefunded });
}

async function processWithdrawal(payload: z.infer<typeof withdrawalSchema>) {
  const external = payload.withdrawal;
  const { data: withdrawal, error } = await supabaseAdmin
    .from("withdrawal_requests")
    .select("id,creator_id,amount_cents,fanlira_withdrawal_fee_cents,status,gateway_transfer_id")
    .eq("gateway_transfer_id", external.id)
    .maybeSingle();
  if (error) return jsonResponse({ ok: false, error: "Internal lookup failed" }, 500);
  if (!withdrawal) return jsonResponse({ ok: true, ignored: true });
  if (withdrawal.amount_cents !== external.amount) {
    return jsonResponse({ ok: false, error: "Amount mismatch" }, 409);
  }
  if (external.net_amount > external.amount) {
    return jsonResponse({ ok: false, error: "Net amount mismatch" }, 409);
  }
  const absorbedProviderFee = external.amount - external.net_amount;
  const gatewayValues = {
    gateway_status: external.status,
    gateway_fee_cents: external.fee ?? absorbedProviderFee,
    gateway_net_amount_cents: external.net_amount,
  };

  if (payload.event === "withdrawal.processing") {
    await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: "processing", ...gatewayValues })
      .eq("id", withdrawal.id)
      .in("status", ["approved", "processing"]);
    return jsonResponse({ ok: true });
  }

  if (payload.event === "withdrawal.failed") {
    if (withdrawal.status === "paid") return jsonResponse({ ok: true, ignored: true });
    const { error: updateError } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: "rejected",
        ...gatewayValues,
        rejection_reason: "Saque recusado pela Impulse Pay",
      })
      .eq("id", withdrawal.id)
      .in("status", ["approved", "processing"]);
    if (updateError) return jsonResponse({ ok: false, error: "Withdrawal update failed" }, 500);
    return jsonResponse({ ok: true });
  }

  if (external.status !== "COMPLETED") {
    return jsonResponse({ ok: false, error: "Withdrawal is not completed" }, 409);
  }

  const { error: transactionError } = await supabaseAdmin.from("transactions").insert({
    payer_id: null,
    payee_id: withdrawal.creator_id,
    type: "withdrawal",
    status: "paid",
    amount_cents: external.net_amount + withdrawal.fanlira_withdrawal_fee_cents,
    reference_id: withdrawal.id,
    gateway: "impulsepay",
    gateway_ref: external.id,
    idempotency_key: `withdrawal:${withdrawal.id}`,
    metadata: {
      withdrawal_id: withdrawal.id,
      requested_amount_cents: withdrawal.amount_cents,
      transferred_amount_cents: external.net_amount,
      gateway_fee_absorbed_cents: absorbedProviderFee,
      fanlira_withdrawal_fee_cents: withdrawal.fanlira_withdrawal_fee_cents,
      end_to_end: external.end_to_end ?? null,
    },
  });
  if (transactionError && transactionError.code !== "23505") {
    return jsonResponse({ ok: false, error: "Transaction insert failed" }, 500);
  }

  const { data: paid, error: updateError } = await supabaseAdmin
    .from("withdrawal_requests")
    .update({
      status: "paid",
      ...gatewayValues,
      gateway_end_to_end: external.end_to_end ?? null,
      paid_at: external.paid_at ?? new Date().toISOString(),
    })
    .eq("id", withdrawal.id)
    // A provider may emit FAILED and later reconcile the same transfer as
    // COMPLETED. In that case the provider's final settlement is authoritative.
    .in("status", ["approved", "processing", "rejected"])
    .select("id")
    .maybeSingle();
  if (updateError) return jsonResponse({ ok: false, error: "Withdrawal update failed" }, 500);

  if (paid) {
    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      user_id: withdrawal.creator_id,
      type: "withdrawal",
      title: "Saque pago",
      body: `A Impulse Pay transferiu R$ ${(external.net_amount / 100).toFixed(2).replace(".", ",")}. A taxa de R$ ${(absorbedProviderFee / 100).toFixed(2).replace(".", ",")} da adquirente foi absorvida pela Fanlira.`,
      link: "/creator/wallet",
      metadata: {
        withdrawal_id: withdrawal.id,
        transferred_amount_cents: external.net_amount,
        gateway_fee_absorbed_cents: absorbedProviderFee,
        fanlira_withdrawal_fee_cents: withdrawal.fanlira_withdrawal_fee_cents,
      },
    });
    if (notificationError) {
      console.error("[impulsepay-webhook] withdrawal notification failed", notificationError.code);
    }
  }

  return jsonResponse({ ok: true });
}

export const Route = createFileRoute("/api/public/impulsepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedToken = process.env.IMPULSEPAY_WEBHOOK_TOKEN?.trim();
        const url = new URL(request.url);
        const suppliedToken =
          request.headers.get("x-webhook-token") ?? url.searchParams.get("token");
        if (!expectedToken) return jsonResponse({ ok: false, error: "Server misconfigured" }, 503);
        if (!secureTokenMatches(expectedToken, suppliedToken)) {
          return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
        }

        const declaredLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
          return jsonResponse({ ok: false, error: "Payload too large" }, 413);
        }
        const rawText = await request.text();
        if (new TextEncoder().encode(rawText).byteLength > MAX_WEBHOOK_BYTES) {
          return jsonResponse({ ok: false, error: "Payload too large" }, 413);
        }

        let raw: unknown;
        try {
          raw = JSON.parse(rawText);
        } catch {
          return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
        }

        const transaction = transactionSchema.safeParse(raw);
        if (transaction.success) return processTransaction(transaction.data);
        const withdrawal = withdrawalSchema.safeParse(raw);
        if (withdrawal.success) return processWithdrawal(withdrawal.data);
        return jsonResponse({ ok: false, error: "Invalid webhook payload" }, 400);
      },
    },
  },
});

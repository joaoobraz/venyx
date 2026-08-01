import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fulfillPaidCharge, reconcileRefundedCharge } from "@/_server/payments-fulfillment.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyNexusPagSignature } from "@/_server/nexuspag-webhook-security";

const NEXUSPAG_BASE = "https://nexuspag.com";
const MAX_WEBHOOK_BYTES = 64 * 1024;
const VERIFY_TIMEOUT_MS = 20_000;

const baseWebhookSchema = z
  .object({
    event: z.string().optional(),
    id: z.string().optional(),
    refund_id: z.string().optional(),
    transaction_id: z.string().optional(),
    txid: z.string().optional(),
    external_id: z.string().min(1).max(200).optional(),
    status: z.string().optional(),
    amount: z.coerce.number().finite().positive().optional(),
    paid_at: z.string().optional(),
    refunded_at: z.string().optional(),
    payer_name: z.string().optional(),
    payer_document_masked: z.string().optional(),
  })
  .passthrough();

const paymentWebhookSchema = baseWebhookSchema.extend({
  external_id: z.string().min(1).max(200),
  status: z.literal("paid"),
});

const refundWebhookSchema = baseWebhookSchema.refine(
  (payload) =>
    !!(payload.external_id || payload.transaction_id || payload.txid) &&
    typeof payload.amount === "number",
  "Estorno sem referência ou valor",
);

const verifiedTransactionSchema = z
  .object({
    id: z.string().optional(),
    transaction_id: z.string().optional(),
    txid: z.string().optional(),
    external_id: z.string().optional(),
    status: z.string(),
    amount: z.coerce.number().finite().positive(),
    paid_at: z.string().optional(),
    payer_name: z.string().optional(),
  })
  .passthrough();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function unwrapTransaction(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const root = raw as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : undefined;
  return data?.transaction ?? root.transaction ?? data ?? root;
}

async function loadInternalCharge(payload: z.infer<typeof baseWebhookSchema>) {
  let query = supabaseAdmin
    .from("pix_charges")
    .select("id, status, amount_cents, external_id, gateway_transaction_id");
  if (payload.external_id) {
    query = query.eq("external_id", payload.external_id);
  } else {
    const gatewayId = payload.transaction_id ?? payload.txid;
    if (!gatewayId) return { charge: null, error: null };
    query = query.eq("gateway_transaction_id", gatewayId);
  }
  const { data, error } = await query.maybeSingle();
  return { charge: data, error };
}

async function processRefund(payload: z.infer<typeof refundWebhookSchema>) {
  const { charge, error } = await loadInternalCharge(payload);
  if (error) {
    console.error("[nexuspag-webhook] erro buscando estorno", error.code);
    return jsonResponse({ ok: false, error: "Internal lookup failed" }, 500);
  }
  if (!charge) return jsonResponse({ ok: true, ignored: true, reason: "no internal charge" });

  const gatewayId = payload.transaction_id ?? payload.txid;
  if (gatewayId && gatewayId !== charge.gateway_transaction_id) {
    return jsonResponse({ ok: false, error: "Transaction mismatch" }, 401);
  }
  if (payload.external_id && payload.external_id !== charge.external_id) {
    return jsonResponse({ ok: false, error: "External reference mismatch" }, 401);
  }

  const amountCents = Math.round((payload.amount ?? 0) * 100);
  if (amountCents !== charge.amount_cents) {
    return jsonResponse({ ok: false, error: "Amount mismatch" }, 401);
  }

  const result = await reconcileRefundedCharge({
    chargeId: charge.id,
    gatewayReference: payload.refund_id ?? payload.id ?? gatewayId ?? null,
    amountCents,
    refundedAt: payload.refunded_at ?? null,
  });
  if (!result.ok) return jsonResponse({ ok: false, error: "Refund reconciliation pending" }, 503);
  return jsonResponse({ ok: true, reconciled: !result.alreadyRefunded });
}

async function processPayment(payload: z.infer<typeof paymentWebhookSchema>) {
  const { charge, error: chargeError } = await loadInternalCharge(payload);
  if (chargeError) {
    console.error("[nexuspag-webhook] erro buscando cobrança", chargeError.code);
    return jsonResponse({ ok: false, error: "Internal lookup failed" }, 500);
  }
  if (!charge) return jsonResponse({ ok: true, ignored: true, reason: "no internal charge" });
  if (charge.status === "refunded") {
    return jsonResponse({ ok: true, ignored: true, reason: "charge already refunded" });
  }
  if (!charge.gateway_transaction_id) {
    return jsonResponse({ ok: false, error: "Charge is missing gateway reference" }, 409);
  }

  const payloadGatewayId = payload.transaction_id ?? payload.txid;
  if (payloadGatewayId && payloadGatewayId !== charge.gateway_transaction_id) {
    return jsonResponse({ ok: false, error: "Gateway reference mismatch" }, 401);
  }

  const apiKey = process.env.NEXUSPAG_API_KEY;
  if (!apiKey) {
    console.error("[nexuspag-webhook] NEXUSPAG_API_KEY ausente");
    return jsonResponse({ ok: false, error: "Server misconfigured" }, 503);
  }

  let verified: z.infer<typeof verifiedTransactionSchema>;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${NEXUSPAG_BASE}/api/pix/${encodeURIComponent(charge.gateway_transaction_id)}`,
      { headers: { "x-api-key": apiKey }, signal: controller.signal },
    );
    if (!response.ok) {
      console.warn("[nexuspag-webhook] verificação NexusPag falhou", response.status);
      return jsonResponse({ ok: false, error: "Verification failed" }, 502);
    }
    verified = verifiedTransactionSchema.parse(unwrapTransaction(await response.json()));
  } catch (error) {
    console.error(
      "[nexuspag-webhook] erro consultando NexusPag",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonResponse({ ok: false, error: "Verification error" }, 502);
  } finally {
    clearTimeout(timeout);
  }

  if (verified.status !== "paid") {
    return jsonResponse({ ok: false, error: "Charge not paid at gateway" }, 409);
  }
  if (verified.external_id && verified.external_id !== charge.external_id) {
    return jsonResponse({ ok: false, error: "External reference mismatch" }, 401);
  }
  const verifiedIds = [verified.id, verified.transaction_id, verified.txid].filter(
    (value): value is string => !!value,
  );
  if (verifiedIds.length > 0 && !verifiedIds.includes(charge.gateway_transaction_id)) {
    return jsonResponse({ ok: false, error: "Transaction mismatch" }, 401);
  }
  if (Math.round(verified.amount * 100) !== charge.amount_cents) {
    return jsonResponse({ ok: false, error: "Amount mismatch" }, 401);
  }

  const result = await fulfillPaidCharge({
    externalId: charge.external_id,
    gatewayTransactionId: charge.gateway_transaction_id,
    paidAt: verified.paid_at ?? null,
    payerName: verified.payer_name ?? null,
  });
  if (!result.ok) return jsonResponse({ ok: false, error: "Fulfillment pending" }, 503);
  return jsonResponse({ ok: true, fulfilled: !result.alreadyFulfilled });
}

export const Route = createFileRoute("/api/public/nexuspag-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const declaredLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
          return jsonResponse({ ok: false, error: "Payload too large" }, 413);
        }

        const rawText = await request.text();
        if (new TextEncoder().encode(rawText).byteLength > MAX_WEBHOOK_BYTES) {
          return jsonResponse({ ok: false, error: "Payload too large" }, 413);
        }

        const webhookSecret = process.env.NEXUSPAG_WEBHOOK_SECRET;
        if (!webhookSecret) {
          console.error("[nexuspag-webhook] NEXUSPAG_WEBHOOK_SECRET ausente");
          return jsonResponse({ ok: false, error: "Server misconfigured" }, 503);
        }
        const signatureValid = await verifyNexusPagSignature(
          rawText,
          request.headers.get("x-nexuspag-signature"),
          webhookSecret,
        );
        if (!signatureValid) {
          return jsonResponse({ ok: false, error: "Invalid signature" }, 401);
        }

        let rawPayload: z.infer<typeof baseWebhookSchema>;
        try {
          rawPayload = baseWebhookSchema.parse(JSON.parse(rawText));
        } catch {
          return jsonResponse({ ok: false, error: "Invalid payload" }, 400);
        }

        const event = request.headers.get("x-nexuspag-event") ?? rawPayload.event;
        if (event === "refund.completed") {
          const parsed = refundWebhookSchema.safeParse(rawPayload);
          if (!parsed.success) return jsonResponse({ ok: false, error: "Invalid refund" }, 400);
          return processRefund(parsed.data);
        }
        if (event !== "payment.confirmed") {
          return jsonResponse({ ok: true, ignored: true, reason: `event=${event ?? "missing"}` });
        }

        const parsed = paymentWebhookSchema.safeParse(rawPayload);
        if (!parsed.success) return jsonResponse({ ok: false, error: "Invalid payment" }, 400);
        return processPayment(parsed.data);
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fulfillPaidCharge } from "@/_server/payments-fulfillment.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NEXUSPAG_BASE = "https://nexuspag.com";
const MAX_WEBHOOK_BYTES = 64 * 1024;

// Schema do webhook conforme doc da NexusPag
const webhookSchema = z
  .object({
    event: z.string().optional(),
    transaction_id: z.string().optional(),
    txid: z.string().optional(),
    external_id: z.string().min(1).max(200),
    status: z.string(),
    amount: z.number().optional(),
    paid_at: z.string().optional(),
    payer_name: z.string().optional(),
    payer_document_masked: z.string().optional(),
  })
  .passthrough();

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

export const Route = createFileRoute("/api/public/nexuspag-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof webhookSchema>;
        try {
          const declaredLength = Number(request.headers.get("content-length") ?? "0");
          if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
            return jsonResponse({ ok: false, error: "Payload too large" }, 413);
          }

          const rawText = await request.text();
          if (new TextEncoder().encode(rawText).byteLength > MAX_WEBHOOK_BYTES) {
            return jsonResponse({ ok: false, error: "Payload too large" }, 413);
          }
          payload = webhookSchema.parse(JSON.parse(rawText));
        } catch (e) {
          console.warn("[nexuspag-webhook] payload inválido", e);
          return jsonResponse({ ok: false, error: "Invalid payload" }, 400);
        }

        // Só processamos confirmações de pagamento
        if (payload.status !== "paid") {
          return jsonResponse({ ok: true, ignored: true, reason: `status=${payload.status}` });
        }

        const { data: charge, error: chargeError } = await supabaseAdmin
          .from("pix_charges")
          .select("amount_cents, external_id, gateway_transaction_id")
          .eq("external_id", payload.external_id)
          .maybeSingle();

        if (chargeError) {
          console.error("[nexuspag-webhook] erro buscando cobrança", chargeError);
          return jsonResponse({ ok: false, error: "Internal lookup failed" }, 500);
        }
        if (!charge) {
          return jsonResponse({ ok: true, ignored: true, reason: "no internal charge" });
        }
        if (!charge.gateway_transaction_id) {
          console.error("[nexuspag-webhook] cobrança sem gateway_transaction_id");
          return jsonResponse({ ok: false, error: "Charge is missing gateway reference" }, 409);
        }

        const payloadGatewayId = payload.transaction_id ?? payload.txid;
        if (payloadGatewayId && payloadGatewayId !== charge.gateway_transaction_id) {
          console.warn("[nexuspag-webhook] referência do gateway divergente");
          return jsonResponse({ ok: false, error: "Gateway reference mismatch" }, 401);
        }

        // Confirma a cobrança usando exclusivamente o identificador salvo quando
        // o Pix foi criado. Dados enviados pelo webhook nunca escolhem qual venda
        // será consultada ou creditada.
        const apiKey = process.env.NEXUSPAG_API_KEY;
        if (!apiKey) {
          console.error("[nexuspag-webhook] NEXUSPAG_API_KEY ausente");
          return jsonResponse({ ok: false, error: "Server misconfigured" }, 500);
        }

        let verified: z.infer<typeof verifiedTransactionSchema>;
        try {
          const res = await fetch(
            `${NEXUSPAG_BASE}/api/pix/${encodeURIComponent(charge.gateway_transaction_id)}`,
            {
              headers: { "x-api-key": apiKey },
            },
          );
          if (!res.ok) {
            console.warn("[nexuspag-webhook] verificação NexusPag falhou", res.status);
            return jsonResponse({ ok: false, error: "Verification failed" }, 401);
          }
          verified = verifiedTransactionSchema.parse(unwrapTransaction(await res.json()));
        } catch (e) {
          console.error("[nexuspag-webhook] erro consultando NexusPag", e);
          return jsonResponse({ ok: false, error: "Verification error" }, 502);
        }

        if (verified?.status !== "paid") {
          console.warn("[nexuspag-webhook] NexusPag retornou status diferente", verified?.status);
          return jsonResponse({ ok: false, error: "Charge not paid at gateway" }, 401);
        }

        if (verified.external_id && verified.external_id !== charge.external_id) {
          console.warn("[nexuspag-webhook] external_id confirmado diverge da cobrança");
          return jsonResponse({ ok: false, error: "External reference mismatch" }, 401);
        }

        const verifiedIds = [verified.id, verified.transaction_id, verified.txid].filter(
          (value): value is string => !!value,
        );
        if (verifiedIds.length > 0 && !verifiedIds.includes(charge.gateway_transaction_id)) {
          console.warn("[nexuspag-webhook] transação confirmada diverge da cobrança");
          return jsonResponse({ ok: false, error: "Transaction mismatch" }, 401);
        }

        // O valor confirmado pelo gateway é obrigatório e deve ser exato.
        const verifiedCents = Math.round(verified.amount * 100);
        if (verifiedCents !== charge.amount_cents) {
          console.warn("[nexuspag-webhook] valor divergente", {
            expected: charge.amount_cents,
            got: verifiedCents,
          });
          return jsonResponse({ ok: false, error: "Amount mismatch" }, 401);
        }

        // Credita
        const result = await fulfillPaidCharge({
          externalId: charge.external_id,
          gatewayTransactionId: charge.gateway_transaction_id,
          paidAt: verified.paid_at ?? null,
          payerName: verified.payer_name ?? null,
        });

        if (!result.ok) {
          console.error("[nexuspag-webhook] fulfill falhou", result.reason);
          // Mantém a cobrança pendente e pede nova entrega ao gateway. Todos os
          // efeitos financeiros possuem chave idempotente, então a repetição é segura.
          return jsonResponse({ ok: false, error: "Fulfillment pending" }, 503);
        }

        return jsonResponse({ ok: true, fulfilled: !result.alreadyFulfilled });
      },
    },
  },
});

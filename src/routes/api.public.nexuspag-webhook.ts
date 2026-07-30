import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fulfillPaidCharge } from "@/_server/payments-fulfillment.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NEXUSPAG_BASE = "https://nexuspag.com";

// Schema do webhook conforme doc da NexusPag
const webhookSchema = z.object({
  event: z.string().optional(),
  transaction_id: z.string().optional(),
  txid: z.string().optional(),
  external_id: z.string().min(1).max(200),
  status: z.string(),
  amount: z.number().optional(),
  paid_at: z.string().optional(),
  payer_name: z.string().optional(),
  payer_document_masked: z.string().optional(),
}).passthrough();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/nexuspag-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        let payload: z.infer<typeof webhookSchema>;
        try {
          const raw = await request.json();
          payload = webhookSchema.parse(raw);
        } catch (e) {
          console.warn("[nexuspag-webhook] payload inválido", e);
          return jsonResponse({ ok: false, error: "Invalid payload" }, 400);
        }

        // Só processamos confirmações de pagamento
        if (payload.status !== "paid") {
          return jsonResponse({ ok: true, ignored: true, reason: `status=${payload.status}` });
        }

        // SEGURANÇA: confirma com a NexusPag antes de creditar.
        // Isso impede que qualquer um chame este endpoint e force um crédito falso.
        const apiKey = process.env.NEXUSPAG_API_KEY;
        if (!apiKey) {
          console.error("[nexuspag-webhook] NEXUSPAG_API_KEY ausente");
          return jsonResponse({ ok: false, error: "Server misconfigured" }, 500);
        }

        const lookupId = payload.transaction_id ?? payload.txid ?? payload.external_id;
        let verified: any = null;
        try {
          const res = await fetch(`${NEXUSPAG_BASE}/api/pix/${encodeURIComponent(lookupId)}`, {
            headers: { "x-api-key": apiKey },
          });
          if (!res.ok) {
            console.warn("[nexuspag-webhook] verificação NexusPag falhou", res.status);
            return jsonResponse({ ok: false, error: "Verification failed" }, 401);
          }
          const json = await res.json();
          verified = json?.data?.transaction ?? json?.transaction ?? json?.data ?? json;
        } catch (e) {
          console.error("[nexuspag-webhook] erro consultando NexusPag", e);
          return jsonResponse({ ok: false, error: "Verification error" }, 502);
        }

        if (verified?.status !== "paid") {
          console.warn("[nexuspag-webhook] NexusPag retornou status diferente", verified?.status);
          return jsonResponse({ ok: false, error: "Charge not paid at gateway" }, 401);
        }

        // Busca a charge interna pelo external_id
        const { data: charge } = await supabaseAdmin
          .from("pix_charges")
          .select("amount_cents, external_id")
          .eq("external_id", payload.external_id)
          .maybeSingle();

        if (!charge) {
          // Pode ser cobrança de teste (/test-pix) que não persistimos. Aceita silenciosamente.
          console.log("[nexuspag-webhook] external_id sem charge interna:", payload.external_id);
          return jsonResponse({ ok: true, ignored: true, reason: "no internal charge" });
        }

        // Confere o valor (em centavos vs reais)
        const verifiedCents = Math.round(Number(verified.amount ?? payload.amount ?? 0) * 100);
        if (verifiedCents > 0 && verifiedCents !== charge.amount_cents) {
          console.warn(
            "[nexuspag-webhook] valor divergente",
            { expected: charge.amount_cents, got: verifiedCents },
          );
          return jsonResponse({ ok: false, error: "Amount mismatch" }, 401);
        }

        // Credita
        const result = await fulfillPaidCharge({
          externalId: payload.external_id,
          gatewayTransactionId: payload.transaction_id ?? payload.txid ?? null,
          paidAt: payload.paid_at ?? verified.paid_at ?? null,
          payerName: payload.payer_name ?? verified.payer_name ?? null,
        });

        if (!result.ok) {
          console.error("[nexuspag-webhook] fulfill falhou", result.reason);
          // Retornamos 200 mesmo assim para a NexusPag não ficar reentregando indefinidamente —
          // a charge já foi marcada como paga, o erro é só no efeito colateral e admin precisa olhar.
          return jsonResponse({ ok: true, warning: result.reason });
        }

        return jsonResponse({ ok: true, fulfilled: !result.alreadyFulfilled });
      },
    },
  },
});

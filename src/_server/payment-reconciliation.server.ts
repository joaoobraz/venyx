import { fulfillPaidCharge } from "@/_server/payments-fulfillment.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  compareGatewayCharge,
  gatewayConfirmationIsSafe,
  normalizeGatewayCharge,
  sanitizedGatewayDetails,
} from "@/lib/payment-reconciliation";

const NEXUSPAG_BASE = "https://nexuspag.com";
const LOOKUP_TIMEOUT_MS = 15_000;
const MINIMUM_CHARGE_AGE_MS = 90_000;
const STALE_PROCESSING_MS = 5 * 60_000;
const STALE_PENDING_MS = 60 * 60_000;

type PendingCharge = Pick<
  Tables<"pix_charges">,
  | "id"
  | "amount_cents"
  | "external_id"
  | "gateway_transaction_id"
  | "status"
  | "created_at"
  | "updated_at"
  | "expires_at"
>;

type IssueCode =
  | "missing_gateway_reference"
  | "provider_lookup_failed"
  | "gateway_data_mismatch"
  | "fulfillment_failed"
  | "status_mismatch";

type Severity = "low" | "medium" | "high";

export type ReconciliationSummary = {
  ok: boolean;
  scanned: number;
  recovered: number;
  expired: number;
  issues: number;
  runId: string | null;
};

export class ReconciliationConfigurationError extends Error {
  code = "PAYMENT_CONFIG_ERROR" as const;
}
async function lookupGatewayCharge(gatewayId: string) {
  const apiKey = process.env.NEXUSPAG_API_KEY;
  if (!apiKey) throw new ReconciliationConfigurationError("NEXUSPAG_API_KEY não configurada");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${NEXUSPAG_BASE}/api/pix/${encodeURIComponent(gatewayId)}`,
      { headers: { "x-api-key": apiKey }, signal: controller.signal },
    );
    if (!response.ok) {
      return { ok: false as const, code: `HTTP_${response.status}` };
    }
    return { ok: true as const, value: normalizeGatewayCharge(await response.json()) };
  } catch (error) {
    return {
      ok: false as const,
      code: error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function reportIssue(
  charge: PendingCharge,
  issueCode: IssueCode,
  severity: Severity,
  gatewayStatus: string | null,
  details: Record<string, Json | undefined>,
) {
  const { error } = await supabaseAdmin.rpc("report_financial_reconciliation_issue", {
    _charge_id: charge.id,
    _issue_code: issueCode,
    _severity: severity,
    _local_status: charge.status,
    _gateway_status: gatewayStatus,
    _details: details,
  });
  if (error) {
    console.error("[financial-reconciliation] issue insert failed", error.code);
    throw new Error("ISSUE_PERSISTENCE_FAILED");
  }
}

async function resolveIssues(chargeId: string, note: string) {
  const { error } = await supabaseAdmin.rpc(
    "resolve_financial_reconciliation_issues_for_charge",
    { _charge_id: chargeId, _note: note },
  );
  if (error) console.error("[financial-reconciliation] auto resolve failed", error.code);
}

function shouldInspect(charge: PendingCharge, now: number) {
  const createdAt = new Date(charge.created_at).getTime();
  if (!Number.isFinite(createdAt) || now - createdAt < MINIMUM_CHARGE_AGE_MS) return false;
  if (charge.status !== "processing") return true;
  const updatedAt = new Date(charge.updated_at).getTime();
  return Number.isFinite(updatedAt) && now - updatedAt >= STALE_PROCESSING_MS;
}

function isStalePending(charge: PendingCharge, now: number) {
  const createdAt = new Date(charge.created_at).getTime();
  const expiresAt = charge.expires_at ? new Date(charge.expires_at).getTime() : Number.NaN;
  return (
    (Number.isFinite(createdAt) && now - createdAt >= STALE_PENDING_MS) ||
    (Number.isFinite(expiresAt) && now - expiresAt >= STALE_PROCESSING_MS)
  );
}

export async function reconcilePendingPixCharges(options: {
  source: "cron" | "admin";
  limit?: number;
}): Promise<ReconciliationSummary> {
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabaseAdmin
    .from("financial_reconciliation_runs")
    .insert({ source: options.source, status: "running", started_at: startedAt })
    .select("id")
    .single();
  if (runError || !run) throw new Error("RECONCILIATION_RUN_CREATE_FAILED");

  const result: ReconciliationSummary = {
    ok: true,
    scanned: 0,
    recovered: 0,
    expired: 0,
    issues: 0,
    runId: run.id,
  };

  try {
    if (!process.env.NEXUSPAG_API_KEY) {
      throw new ReconciliationConfigurationError("NEXUSPAG_API_KEY não configurada");
    }

    const { data: rows, error } = await supabaseAdmin
      .from("pix_charges")
      .select(
        "id,amount_cents,external_id,gateway_transaction_id,status,created_at,updated_at,expires_at",
      )
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: true })
      .limit(Math.max(1, Math.min(options.limit ?? 100, 200)));
    if (error) throw new Error("CHARGE_LIST_FAILED");

    const now = Date.now();
    const charges = (rows ?? []).filter((charge) => shouldInspect(charge, now));
    result.scanned = charges.length;

    for (const charge of charges) {
      try {
        if (!charge.gateway_transaction_id) {
          await reportIssue(charge, "missing_gateway_reference", "high", null, {
            external_id: charge.external_id,
          });
          result.issues += 1;
          continue;
        }

        const gatewayResult = await lookupGatewayCharge(charge.gateway_transaction_id);
        if (!gatewayResult.ok) {
          await reportIssue(charge, "provider_lookup_failed", "medium", null, {
            lookup_code: gatewayResult.code,
            gateway_transaction_id: charge.gateway_transaction_id,
          });
          result.issues += 1;
          continue;
        }

        const gateway = gatewayResult.value;
        if (gateway.status === "paid") {
          if (!gatewayConfirmationIsSafe(charge, gateway)) {
            await reportIssue(charge, "gateway_data_mismatch", "high", gateway.status, {
              comparison: compareGatewayCharge(charge, gateway),
              gateway: sanitizedGatewayDetails(gateway),
            });
            result.issues += 1;
            continue;
          }

          const fulfillment = await fulfillPaidCharge({
            externalId: charge.external_id,
            gatewayTransactionId: charge.gateway_transaction_id,
            paidAt: gateway.paidAt,
            payerName: gateway.payerName,
          });
          if (!fulfillment.ok) {
            await reportIssue(charge, "fulfillment_failed", "high", gateway.status, {
              reason: fulfillment.reason,
              gateway: sanitizedGatewayDetails(gateway),
            });
            result.issues += 1;
            continue;
          }

          result.recovered += 1;
          await resolveIssues(charge.id, "Pagamento confirmado e entrega recuperada automaticamente");
          continue;
        }

        if (gateway.status === "expired" || gateway.status === "cancelled") {
          const { error: updateError } = await supabaseAdmin
            .from("pix_charges")
            .update({ status: gateway.status })
            .eq("id", charge.id)
            .in("status", ["pending", "processing"]);
          if (updateError) throw new Error("CHARGE_STATUS_UPDATE_FAILED");
          result.expired += 1;
          await resolveIssues(charge.id, `Cobrança encerrada pelo provedor: ${gateway.status}`);
          continue;
        }

        if (isStalePending(charge, now)) {
          await reportIssue(charge, "status_mismatch", "low", gateway.status, {
            gateway: sanitizedGatewayDetails(gateway),
          });
          result.issues += 1;
        }
      } catch (error) {
        console.error(
          "[financial-reconciliation] charge failed",
          charge.id,
          error instanceof Error ? error.message : "unknown",
        );
        result.issues += 1;
      }
    }

    const runStatus = result.issues > 0 ? "partial" : "success";
    await supabaseAdmin
      .from("financial_reconciliation_runs")
      .update({
        status: runStatus,
        scanned_count: result.scanned,
        recovered_count: result.recovered,
        expired_count: result.expired,
        issue_count: result.issues,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return result;
  } catch (error) {
    result.ok = false;
    const errorCode =
      error instanceof ReconciliationConfigurationError
        ? error.code
        : error instanceof Error
          ? error.message.slice(0, 64)
          : "UNKNOWN_ERROR";
    await supabaseAdmin
      .from("financial_reconciliation_runs")
      .update({ status: "failed", error_code: errorCode, completed_at: new Date().toISOString() })
      .eq("id", run.id);
    throw error;
  }
}

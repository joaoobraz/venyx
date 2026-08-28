import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseMfa } from "@/_server/access-control.server";
import { logAdminAction } from "@/_server/admin-audit.server";
import {
  reconcilePendingPixCharges,
  ReconciliationConfigurationError,
} from "@/_server/payment-reconciliation.server";
import { impulsePayIsConfigured } from "@/_server/impulsepay.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const listFinancialReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseMfa])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [issuesResult, runsResult, pendingResult] = await Promise.all([
      supabaseAdmin
        .from("financial_reconciliation_issues")
        .select(
          "id,charge_id,issue_code,severity,status,local_status,gateway_status,attempt_count,first_detected_at,last_detected_at,resolved_at,resolution_note",
        )
        .order("last_detected_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("financial_reconciliation_runs")
        .select(
          "id,source,status,scanned_count,recovered_count,expired_count,issue_count,error_code,started_at,completed_at",
        )
        .order("started_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("pix_charges")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"]),
    ]);

    if (issuesResult.error || runsResult.error || pendingResult.error) {
      console.error("[admin.financialReconciliation.list]", {
        issues: issuesResult.error?.code,
        runs: runsResult.error?.code,
        pending: pendingResult.error?.code,
      });
      throw new Error("Não foi possível carregar a conciliação financeira.");
    }

    const chargeIds = Array.from(
      new Set((issuesResult.data ?? []).map((issue) => issue.charge_id)),
    );
    const chargesById: Record<
      string,
      {
        id: string;
        external_id: string;
        amount_cents: number;
        purpose: string;
        status: string;
        created_at: string;
      }
    > = {};

    if (chargeIds.length > 0) {
      const { data: charges, error } = await supabaseAdmin
        .from("pix_charges")
        .select("id,external_id,amount_cents,purpose,status,created_at")
        .in("id", chargeIds);
      if (error) {
        console.error("[admin.financialReconciliation.charges]", error.code);
        throw new Error("Não foi possível carregar as cobranças relacionadas.");
      }
      for (const charge of charges ?? []) chargesById[charge.id] = charge;
    }

    return {
      providerConfigured: impulsePayIsConfigured(),
      pendingCharges: pendingResult.count ?? 0,
      issues: (issuesResult.data ?? []).map((issue) => ({
        ...issue,
        charge: chargesById[issue.charge_id] ?? null,
      })),
      runs: runsResult.data ?? [],
    };
  });

export const runFinancialReconciliationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    try {
      const result = await reconcilePendingPixCharges({
        source: "admin",
        limit: data.limit ?? 100,
      });
      await logAdminAction({
        adminId: context.userId,
        actionType: "financial_reconciliation_run",
        targetType: "financial_reconciliation_run",
        targetId: result.runId,
        metadata: {
          scanned: result.scanned,
          recovered: result.recovered,
          expired: result.expired,
          issues: result.issues,
        },
      });
      return result;
    } catch (error) {
      if (error instanceof ReconciliationConfigurationError) {
        throw new Error(
          "As credenciais da Impulse Pay ainda não foram configuradas. A consulta real ao provedor permanece bloqueada.",
          { cause: error },
        );
      }
      console.error(
        "[admin.financialReconciliation.run]",
        error instanceof Error ? error.message : "unknown",
      );
      throw new Error(
        "A varredura não pôde ser concluída. Consulte o histórico e tente novamente.",
        { cause: error },
      );
    }
  });

const resolutionSchema = z.object({
  issueId: z.string().uuid(),
  status: z.enum(["resolved", "ignored"]),
  note: z.string().trim().min(3).max(2000),
});

export const resolveFinancialReconciliationIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => resolutionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: issue, error } = await supabaseAdmin
      .from("financial_reconciliation_issues")
      .update({
        status: data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
        resolution_note: data.note,
      })
      .eq("id", data.issueId)
      .eq("status", "open")
      .select("id,charge_id,issue_code")
      .maybeSingle();

    if (error || !issue) {
      console.error("[admin.financialReconciliation.resolve]", error?.code);
      throw new Error("A pendência já foi tratada ou não pôde ser atualizada.");
    }

    await logAdminAction({
      adminId: context.userId,
      actionType: `financial_reconciliation_${data.status}`,
      targetType: "financial_reconciliation_issue",
      targetId: issue.id,
      metadata: {
        chargeId: issue.charge_id,
        issueCode: issue.issue_code,
        note: data.note,
      },
    });

    return { ok: true };
  });

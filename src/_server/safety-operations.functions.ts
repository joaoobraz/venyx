import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseMfa } from "@/_server/access-control.server";
import { logAdminAction } from "@/_server/admin-audit.server";
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

const priorityRank: Record<string, number> = { critical: 0, high: 1, normal: 2 };
const statusRank: Record<string, number> = { pending: 0, reviewing: 1, resolved: 2, rejected: 3 };

export const listSafetyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseMfa])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: reports, error } = await supabaseAdmin
      .from("content_reports")
      .select(
        "id,target_type,target_id,reported_user_id,reporter_id,reason,details,status,priority,sla_due_at,assigned_to,escalated_at,resolution_note,created_at,updated_at,reviewed_at,reviewed_by",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[safety.listReports]", error.code);
      throw new Error("Não foi possível carregar a fila de denúncias.");
    }

    const ids = (reports ?? []).map((report) => report.id);
    const evidenceByReport = new Map<
      string,
      { preservedAt: string; legalHold: boolean; retentionUntil: string }
    >();
    if (ids.length > 0) {
      const { data: evidence, error: evidenceError } = await supabaseAdmin
        .from("safety_incident_evidence")
        .select("report_id,preserved_at,legal_hold,retention_until")
        .in("report_id", ids);
      if (evidenceError) {
        console.error("[safety.listEvidence]", evidenceError.code);
      } else {
        for (const item of evidence ?? []) {
          evidenceByReport.set(item.report_id, {
            preservedAt: item.preserved_at,
            legalHold: item.legal_hold,
            retentionUntil: item.retention_until,
          });
        }
      }
    }

    const rows = (reports ?? [])
      .map((report) => ({
        ...report,
        evidence: evidenceByReport.get(report.id) ?? null,
      }))
      .sort((a, b) => {
        const status = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
        if (status !== 0) return status;
        const priority = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
        if (priority !== 0) return priority;
        return new Date(a.sla_due_at ?? a.created_at).getTime() - new Date(b.sla_due_at ?? b.created_at).getTime();
      });

    return { rows };
  });

const reviewSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["reviewing", "resolved", "rejected"]),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const reviewSafetyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.status !== "reviewing" && (data.note?.trim().length ?? 0) < 5) {
      throw new Error("Informe uma conclusão com pelo menos 5 caracteres.");
    }

    const { data: updated, error } = await supabaseAdmin.rpc("review_safety_report", {
      _report_id: data.reportId,
      _reviewer_id: context.userId,
      _status: data.status,
      _note: data.note?.trim() || null,
    });
    if (error || !updated) {
      console.error("[safety.reviewReport]", error?.code);
      throw new Error("Não foi possível atualizar a denúncia.");
    }

    await logAdminAction({
      adminId: context.userId,
      actionType: `safety_report_${data.status}`,
      targetType: "content_report",
      targetId: data.reportId,
      metadata: { hasResolutionNote: Boolean(data.note?.trim()) },
    });
    return { ok: true };
  });

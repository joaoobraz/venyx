import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseMfa } from "@/_server/access-control.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAdminAction as auditLog } from "@/_server/admin-audit.server";

function getClientIp(req: Request | undefined): string | null {
  if (!req?.headers) return null;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

const adminGuardSchema = z.object({
  path: z.string().min(1).max(255).optional(),
});

/**
 * Verifica se o usuário autenticado é admin no servidor.
 * Registra cada tentativa (concedida ou negada) em admin_access_audit.
 */
export const requireAdminServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => adminGuardSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const req = getRequest();
    const ip = getClientIp(req);
    const ua = req?.headers?.get("user-agent") ?? null;
    const path = data?.path ?? null;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const granted = !!roleRow;

    // Registra auditoria (não bloqueia o fluxo se falhar)
    try {
      await supabaseAdmin.from("admin_access_audit").insert({
        user_id: userId,
        ip_address: ip,
        user_agent: ua,
        path,
        granted,
        reason: granted ? null : "missing_admin_role",
      });
    } catch (e) {
      console.error("[admin.audit] insert failed", e);
    }

    if (!granted) throw new Error("forbidden");
    return { ok: true, userId };
  });

const decisionSchema = z.object({
  logId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().min(5).max(2000),
});

export const recordModerationDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => decisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("forbidden");

    const { error } = await supabaseAdmin.from("moderation_decisions").upsert(
      {
        log_id: data.logId,
        decision: data.decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        note: data.note,
      },
      { onConflict: "log_id" },
    );
    if (error) {
      console.error("[admin.recordModerationDecision]", error);
      throw new Error("Não foi possível registrar a decisão. Tente novamente.");
    }
    return { ok: true };
  });

export const listModerationDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseMfa])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("forbidden");

    const { data } = await supabaseAdmin.from("moderation_decisions").select("*");
    return { decisions: data ?? [] };
  });

/**
 * Gera URL assinada para visualizar um documento KYC.
 * Verifica o papel admin no servidor antes de chamar storage,
 * impedindo bypass das guards de rota via cliente.
 */
export const getKycSignedUrlServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("forbidden");

    const { data: signed, error } = await supabaseAdmin.storage
      .from("kyc")
      .createSignedUrl(data.path, 300);
    if (error || !signed) {
      console.error("[admin.getKycSignedUrl]", error);
      throw new Error("Não foi possível abrir o documento");
    }
    return { url: signed.signedUrl };
  });

/**
 * Helper: garante que o caller é admin (consulta user_roles via service role).
 */
async function assertAdmin(userId: string) {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("forbidden");
}

const kycDecisionSchema = z.object({
  kycId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().min(3).max(500).optional(),
});

/**
 * Aprova ou rejeita um KYC. Em caso de aprovação, promove a usuária a creator
 * e marca o profile como verificado. Tudo via service role no servidor.
 */
export const reviewKycServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => kycDecisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertAdmin(userId);

    const { data: kyc, error: kycErr } = await supabaseAdmin
      .from("kyc_requests")
      .select("id, user_id, status")
      .eq("id", data.kycId)
      .maybeSingle();
    if (kycErr || !kyc) throw new Error("KYC não encontrado");

    if (data.decision === "rejected") {
      if (!data.rejectionReason) throw new Error("Motivo obrigatório");
      const { error } = await supabaseAdmin
        .from("kyc_requests")
        .update({
          status: "rejected",
          rejection_reason: data.rejectionReason,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", data.kycId);
      if (error) {
        console.error("[admin.reviewKyc.reject]", error);
        throw new Error("Não foi possível atualizar o KYC. Tente novamente.");
      }
      await auditLog({
        adminId: userId,
        actionType: "kyc_rejected",
        targetType: "kyc_request",
        targetId: data.kycId,
        targetUserId: kyc.user_id,
        metadata: { reason: data.rejectionReason },
      });
      return { ok: true };
    }

    // approved
    const { error: e1 } = await supabaseAdmin
      .from("kyc_requests")
      .update({
        status: "approved",
        rejection_reason: null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.kycId);
    if (e1) {
      console.error("[admin.reviewKyc.approve]", e1);
      throw new Error("Não foi possível aprovar o KYC. Tente novamente.");
    }

    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: kyc.user_id, role: "creator" });
    if (e2 && !e2.message.toLowerCase().includes("duplicate")) {
      console.error("[admin.reviewKyc.promote]", e2);
      throw new Error("KYC aprovado, mas não foi possível promover a criadora.");
    }

    await supabaseAdmin.from("profiles").update({ is_verified: true }).eq("user_id", kyc.user_id);

    await auditLog({
      adminId: userId,
      actionType: "kyc_approved",
      targetType: "kyc_request",
      targetId: data.kycId,
      targetUserId: kyc.user_id,
      metadata: { promotedToCreator: true },
    });

    return { ok: true };
  });

const dmcaSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["notified", "resolved", "rejected"]),
  adminNotes: z.string().max(2000).optional().nullable(),
});

export const updateDmcaReportServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => dmcaSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: report } = await supabaseAdmin
      .from("dmca_reports")
      .select("id, creator_id")
      .eq("id", data.reportId)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("dmca_reports")
      .update({
        status: data.status,
        admin_notes: data.adminNotes ?? null,
      })
      .eq("id", data.reportId);
    if (error) {
      console.error("[admin.updateDmcaReport]", error);
      throw new Error("Não foi possível atualizar o report. Tente novamente.");
    }
    await auditLog({
      adminId: context.userId,
      actionType: `dmca_${data.status}`,
      targetType: "dmca_report",
      targetId: data.reportId,
      targetUserId: report?.creator_id ?? null,
      metadata: { status: data.status, hasNotes: !!data.adminNotes },
    });
    return { ok: true };
  });

/**
 * Lista as últimas ações administrativas registradas (para a tela de auditoria).
 */
export const listAdminActionsAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) =>
    z
      .object({
        actionType: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const limit = data.limit ?? 200;

    let query = supabaseAdmin
      .from("admin_action_audit")
      .select(
        "id, admin_id, action_type, target_type, target_id, target_user_id, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data.actionType) query = query.eq("action_type", data.actionType);

    const { data: rows, error } = await query;
    if (error) {
      console.error("[admin.listAdminActionsAudit]", error);
      throw new Error("Não foi possível carregar a auditoria.");
    }

    const userIds = new Set<string>();
    (rows ?? []).forEach((r) => {
      if (r.admin_id) userIds.add(r.admin_id);
      if (r.target_user_id) userIds.add(r.target_user_id);
    });

    const profilesById = new Map<string, { username: string; display_name: string | null }>();
    if (userIds.size > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", Array.from(userIds));
      (profs ?? []).forEach((p) => {
        profilesById.set(p.user_id, { username: p.username, display_name: p.display_name });
      });
    }

    const enriched = (rows ?? []).map((r) => ({
      ...r,
      admin_username: profilesById.get(r.admin_id)?.username ?? null,
      target_username: r.target_user_id
        ? (profilesById.get(r.target_user_id)?.username ?? null)
        : null,
    }));

    return { rows: enriched };
  });

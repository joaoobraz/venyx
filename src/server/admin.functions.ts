import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getClientIp(req: Request | undefined): string | null {
  if (!req?.headers) return null;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null
  );
}

const adminGuardSchema = z.object({
  path: z.string().min(1).max(255).optional(),
});

/**
 * Verifica se o usuário autenticado é admin no servidor.
 * Registra cada tentativa (concedida ou negada) em admin_access_audit.
 */
export const requireAdminServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    adminGuardSchema.parse(input ?? {})
  )
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("forbidden");

    const { error } = await supabaseAdmin
      .from("moderation_decisions")
      .upsert(
        {
          log_id: data.logId,
          decision: data.decision,
          decided_by: userId,
          decided_at: new Date().toISOString(),
          note: data.note,
        },
        { onConflict: "log_id" }
      );
    if (error) {
      console.error("[admin.recordModerationDecision]", error);
      throw new Error("Não foi possível registrar a decisão. Tente novamente.");
    }
    return { ok: true };
  });

export const listModerationDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("forbidden");

    const { data } = await supabaseAdmin
      .from("moderation_decisions")
      .select("*");
    return { decisions: data ?? [] };
  });

/**
 * Gera URL assinada para visualizar um documento KYC.
 * Verifica o papel admin no servidor antes de chamar storage,
 * impedindo bypass das guards de rota via cliente.
 */
export const getKycSignedUrlServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ path: z.string().min(1).max(500) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("forbidden");

    const { data: signed, error } = await supabaseAdmin
      .storage
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

/**
 * Registra uma ação admin na tabela admin_action_audit. Não bloqueia o fluxo se falhar.
 */
export async function logAdminAction(params: {
  adminId: string;
  actionType: string;
  targetType: string;
  targetId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("admin_action_audit").insert({
      admin_id: params.adminId,
      action_type: params.actionType,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      target_user_id: params.targetUserId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (e) {
    console.error("[admin.logAdminAction] failed", e);
  }
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => kycDecisionSchema.parse(input))
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
      if (error) throw new Error(error.message);
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
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: kyc.user_id, role: "creator" });
    if (e2 && !e2.message.toLowerCase().includes("duplicate")) {
      throw new Error(e2.message);
    }

    await supabaseAdmin
      .from("profiles")
      .update({ is_verified: true })
      .eq("user_id", kyc.user_id);

    return { ok: true };
  });

const dmcaSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["notified", "resolved", "rejected"]),
  adminNotes: z.string().max(2000).optional().nullable(),
});

export const updateDmcaReportServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => dmcaSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("dmca_reports")
      .update({
        status: data.status,
        admin_notes: data.adminNotes ?? null,
      })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

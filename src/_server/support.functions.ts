import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSupabaseMfa } from "@/_server/access-control.server";
import { logAdminAction } from "@/_server/admin-audit.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function requestIp(request: Request | undefined) {
  return (
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers.get("cf-connecting-ip") ||
    request?.headers.get("x-real-ip") ||
    "unknown"
  );
}

function recoveryIpHash(request: Request | undefined) {
  const salt = process.env.CRON_SECRET || "venyx-local-recovery-rate-limit";
  return createHash("sha256").update(`${salt}:${requestIp(request)}`).digest("hex");
}

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

const supportSchema = z.object({
  category: z.enum(["account", "billing", "creator", "safety", "technical", "privacy", "other"]),
  subject: z.string().trim().min(5).max(140),
  message: z.string().trim().min(10).max(4000),
});

export const createSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => supportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: request, error } = await supabaseAdmin
      .from("support_requests")
      .insert({
        user_id: context.userId,
        category: data.category,
        subject: data.subject,
        message: data.message,
      })
      .select("id,protocol,status,priority,created_at")
      .single();
    if (error || !request) {
      console.error("[support.create]", error?.code);
      throw new Error("Não foi possível abrir o chamado.");
    }
    return request;
  });

export const listMySupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("support_requests")
      .select("id,protocol,category,subject,status,priority,created_at,updated_at,resolved_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Não foi possível carregar seus chamados.");
    return { rows: data ?? [] };
  });

const recoverySchema = z.object({
  loginEmail: z.string().trim().email().max(254),
  contactEmail: z.string().trim().email().max(254),
  issueType: z.enum(["lost_email", "lost_2fa", "locked_out"]),
  details: z.string().trim().min(20).max(4000),
});

export const createAccountRecoveryRequest = createServerFn({ method: "POST" })
  .validator((input: unknown) => recoverySchema.parse(input))
  .handler(async ({ data }) => {
    const { data: protocol, error } = await supabaseAdmin.rpc(
      "create_account_recovery_request",
      {
        _login_email: data.loginEmail,
        _contact_email: data.contactEmail,
        _issue_type: data.issueType,
        _details: data.details,
        _request_ip_hash: recoveryIpHash(getRequest()),
      },
    );
    if (error || !protocol) {
      if (error?.message.includes("VENYX_RECOVERY_RATE_LIMIT")) {
        throw new Error("Muitas solicitações foram enviadas. Tente novamente em uma hora.");
      }
      console.error("[support.recovery]", error?.code);
      throw new Error("Não foi possível registrar a recuperação da conta.");
    }
    return { protocol };
  });

const privacySchema = z.object({
  requestType: z.enum(["export", "deletion"]),
  note: z.string().trim().max(2000).nullable().optional(),
  confirmation: z.string().trim(),
});

export const createPrivacyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => privacySchema.parse(input))
  .handler(async ({ data, context }) => {
    const expected = data.requestType === "deletion" ? "EXCLUIR" : "EXPORTAR";
    if (data.confirmation.toUpperCase() !== expected) {
      throw new Error(`Digite ${expected} para confirmar.`);
    }
    const retentionExceptions = data.requestType === "deletion"
      ? [
          "Registros financeiros exigidos por lei",
          "Evidências de segurança ou fraude sob retenção",
          "Registros necessários para exercício regular de direitos",
        ]
      : [];
    const { data: request, error } = await supabaseAdmin
      .from("privacy_requests")
      .insert({
        user_id: context.userId,
        request_type: data.requestType,
        user_note: data.note?.trim() || null,
        retention_exceptions: retentionExceptions,
      })
      .select("id,protocol,request_type,status,created_at")
      .single();
    if (error || !request) {
      if (error?.code === "23505") throw new Error("Já existe uma solicitação deste tipo em andamento.");
      console.error("[privacy.create]", error?.code);
      throw new Error("Não foi possível registrar a solicitação.");
    }
    return request;
  });

export const listMyPrivacyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("privacy_requests")
      .select("id,protocol,request_type,status,retention_exceptions,download_path,download_expires_at,created_at,completed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Não foi possível carregar suas solicitações.");
    return { rows: data ?? [] };
  });

export const listAdminServiceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseMfa])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [support, recovery, privacy] = await Promise.all([
      supabaseAdmin.from("support_requests").select("*").order("created_at", { ascending: false }).limit(300),
      supabaseAdmin.from("account_recovery_requests").select("id,protocol,login_email,contact_email,issue_type,details,status,created_at,reviewed_at,admin_notes").order("created_at", { ascending: false }).limit(300),
      supabaseAdmin.from("privacy_requests").select("id,protocol,user_id,request_type,status,user_note,retention_exceptions,created_at,reviewed_at,admin_notes,completed_at").order("created_at", { ascending: false }).limit(300),
    ]);
    if (support.error || recovery.error || privacy.error) {
      console.error("[support.admin.list]", {
        support: support.error?.code,
        recovery: recovery.error?.code,
        privacy: privacy.error?.code,
      });
      throw new Error("Não foi possível carregar a central de atendimento.");
    }
    return { support: support.data ?? [], recovery: recovery.data ?? [], privacy: privacy.data ?? [] };
  });

const adminUpdateSchema = z.object({
  requestKind: z.enum(["support", "recovery", "privacy"]),
  requestId: z.string().uuid(),
  status: z.string().min(2).max(32),
  note: z.string().trim().min(3).max(4000),
});

export const updateAdminServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => adminUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const now = new Date().toISOString();
    let error: { code?: string } | null;

    if (data.requestKind === "support") {
      if (!["in_progress", "waiting_user", "resolved", "closed"].includes(data.status)) throw new Error("Status inválido.");
      ({ error } = await supabaseAdmin
        .from("support_requests")
        .update({
          status: data.status,
          assigned_to: context.userId,
          admin_notes: data.note,
          resolved_at: ["resolved", "closed"].includes(data.status) ? now : null,
        })
        .eq("id", data.requestId));
    } else if (data.requestKind === "recovery") {
      if (!["verifying", "approved", "rejected", "closed"].includes(data.status)) throw new Error("Status inválido.");
      ({ error } = await supabaseAdmin
        .from("account_recovery_requests")
        .update({ status: data.status, admin_notes: data.note, reviewed_by: context.userId, reviewed_at: now, updated_at: now })
        .eq("id", data.requestId));
    } else {
      if (!["verified", "processing", "completed", "rejected"].includes(data.status)) throw new Error("Status inválido.");
      ({ error } = await supabaseAdmin
        .from("privacy_requests")
        .update({
          status: data.status,
          admin_notes: data.note,
          reviewed_by: context.userId,
          reviewed_at: now,
          completed_at: data.status === "completed" ? now : null,
          updated_at: now,
        })
        .eq("id", data.requestId));
    }

    if (error) {
      console.error("[support.admin.update]", error.code);
      throw new Error("Não foi possível atualizar a solicitação.");
    }
    await logAdminAction({
      adminId: context.userId,
      actionType: `${data.requestKind}_request_${data.status}`,
      targetType: `${data.requestKind}_request`,
      targetId: data.requestId,
      metadata: { hasNote: true },
    });
    return { ok: true };
  });

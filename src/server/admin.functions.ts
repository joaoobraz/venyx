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

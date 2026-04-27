import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    await (supabaseAdmin.from("admin_action_audit") as any).insert({
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

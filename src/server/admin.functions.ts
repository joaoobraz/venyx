import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Verifica se o usuário autenticado é admin no servidor.
 * Use no beforeLoad de rotas /admin.* para garantir guarda real.
 */
export const requireAdminServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw new Error("forbidden");
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

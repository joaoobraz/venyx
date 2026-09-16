import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UpdatePauseSchema = z.object({ paused: z.boolean() });

export const getMyAccountPause = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("account_lifecycle")
      .select("status,paused_at,reactivated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error && !["42P01", "PGRST205"].includes(error.code ?? "")) {
      throw new Error("Não foi possível consultar o estado da conta.");
    }
    return {
      paused: data?.status === "paused",
      pausedAt: data?.paused_at ?? null,
      reactivatedAt: data?.reactivated_at ?? null,
    };
  });

export const setMyAccountPause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => UpdatePauseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc(
      "set_my_account_paused",
      { _paused: data.paused },
    );
    if (error) {
      throw new Error(
        error.code === "PGRST202"
          ? "A pausa ainda não foi habilitada no banco de dados."
          : error.message,
      );
    }
    return result as {
      paused: boolean;
      paused_at: string | null;
      reactivated_at: string | null;
    };
  });

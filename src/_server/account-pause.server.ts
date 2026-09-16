import { supabaseAdmin } from "@/integrations/supabase/client.server";

function lifecycleTable() {
  return (supabaseAdmin as any).from("account_lifecycle");
}

function missingLifecycleTable(error: { code?: string; message?: string } | null) {
  return (
    !!error &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message?.includes("account_lifecycle") === true)
  );
}

export async function pausedAccountIds(userIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Set<string>();
  const { data, error } = await lifecycleTable()
    .select("user_id")
    .in("user_id", ids)
    .eq("status", "paused");
  if (missingLifecycleTable(error)) return new Set<string>();
  if (error) throw new Error("Não foi possível verificar o estado das contas.");
  return new Set<string>((data ?? []).map((row: { user_id: string }) => row.user_id));
}

export async function assertAccountsActive(userIds: Array<string | null | undefined>) {
  const paused = await pausedAccountIds(userIds);
  if (paused.size > 0) {
    throw new Error("Esta ação está indisponível enquanto uma das contas está pausada.");
  }
}

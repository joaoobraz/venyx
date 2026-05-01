import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAdminAction } from "@/server/admin-audit.server";

const ROLES = ["subscriber", "creator", "admin", "ambassador", "seller"] as const;
type Role = (typeof ROLES)[number];

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const listUsersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().trim().max(100).optional(),
        roleFilter: z.enum(ROLES).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const limit = data.limit ?? 50;

    let query = supabaseAdmin
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data.search && data.search.length > 0) {
      const term = `%${data.search}%`;
      query = query.or(`username.ilike.${term},display_name.ilike.${term}`);
    }

    const { data: profiles, error } = await query;
    if (error) {
      console.error("[admin.listUsers]", error);
      throw new Error("Não foi possível listar usuários.");
    }

    const ids = (profiles ?? []).map((p) => p.user_id);
    if (ids.length === 0) return { users: [] };

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);

    const rolesByUser = new Map<string, Role[]>();
    (roleRows ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      rolesByUser.set(r.user_id, arr);
    });

    let users = (profiles ?? []).map((p) => ({
      ...p,
      roles: rolesByUser.get(p.user_id) ?? [],
    }));

    if (data.roleFilter) {
      users = users.filter((u) => u.roles.includes(data.roleFilter as Role));
    }

    return { users };
  });

export const updateUserRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        role: z.enum(ROLES),
        action: z.enum(["add", "remove"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.action === "add") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.targetUserId, role: data.role },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (error) {
        console.error("[admin.updateUserRole.add]", error);
        throw new Error("Não foi possível adicionar o cargo.");
      }
    } else {
      if (data.role === "admin" && data.targetUserId === context.userId) {
        throw new Error("Você não pode remover seu próprio cargo de admin.");
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .eq("role", data.role);
      if (error) {
        console.error("[admin.updateUserRole.remove]", error);
        throw new Error("Não foi possível remover o cargo.");
      }
    }
    await logAdminAction({
      adminId: context.userId,
      actionType: data.action === "add" ? "role_added" : "role_removed",
      targetType: "user_role",
      targetUserId: data.targetUserId,
      metadata: { role: data.role },
    });
    return { ok: true };
  });

export const adminDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [
      { count: totalUsers },
      { count: totalCreators },
      { count: totalSellers },
      { count: pendingKyc },
      { count: pendingDmca },
      { count: pendingWithdrawals },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "creator"),
      supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "seller"),
      supabaseAdmin
        .from("kyc_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("dmca_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("type", "withdrawal")
        .eq("status", "pending"),
    ]);

    return {
      totalUsers: totalUsers ?? 0,
      totalCreators: totalCreators ?? 0,
      totalSellers: totalSellers ?? 0,
      pendingKyc: pendingKyc ?? 0,
      pendingDmca: pendingDmca ?? 0,
      pendingWithdrawals: pendingWithdrawals ?? 0,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseMfa } from "@/_server/access-control.server";
import { logAdminAction } from "@/_server/admin-audit.server";
import { recordOperationalEvent } from "@/_server/observability.server";
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

const dashboardSchema = z.object({ days: z.number().int().min(1).max(90).default(30) });

const FUNNEL_STEPS = [
  "page_view",
  "signup_completed",
  "profile_completed",
  "checkout_started",
  "payment_completed",
] as const;

type OperationalRow = {
  anonymous_id_hash: string | null;
  created_at: string;
  device_family: string | null;
  event_kind: string;
  event_name: string;
  fingerprint: string | null;
  id: string;
  route: string | null;
  severity: string;
  user_id: string | null;
};

function identityOf(row: OperationalRow) {
  return row.user_id ? `u:${row.user_id}` : row.anonymous_id_hash ? `a:${row.anonymous_id_hash}` : `e:${row.id}`;
}

export const listOperationsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => dashboardSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

    const [eventsResult, alertsResult, reportsResult, supportResult, backupsResult] = await Promise.all([
      supabaseAdmin
        .from("operational_events")
        .select("id,event_kind,event_name,severity,user_id,anonymous_id_hash,route,device_family,fingerprint,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("operational_alerts")
        .select("id,event_id,status,acknowledged_at,resolved_at,resolution_note,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("content_reports")
        .select("id,status,sla_due_at,priority")
        .in("status", ["pending", "reviewing"]),
      supabaseAdmin
        .from("support_requests")
        .select("id,status,priority")
        .not("status", "in", "(resolved,closed)"),
      supabaseAdmin
        .from("backup_verification_runs")
        .select("id,backup_provider,backup_reference,source_environment,restore_environment,status,started_at,completed_at,note,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const firstError = eventsResult.error || alertsResult.error || reportsResult.error || supportResult.error || backupsResult.error;
    if (firstError) {
      console.error("[operations.dashboard]", firstError.code);
      throw new Error("Não foi possível carregar a operação.");
    }

    const events = (eventsResult.data ?? []) as OperationalRow[];
    const identitiesByStep = new Map<string, Set<string>>();
    for (const step of FUNNEL_STEPS) identitiesByStep.set(step, new Set());
    for (const event of events) identitiesByStep.get(event.event_name)?.add(identityOf(event));

    const funnel = FUNNEL_STEPS.map((name, index) => {
      const count = identitiesByStep.get(name)?.size ?? 0;
      const previous = index === 0 ? count : (identitiesByStep.get(FUNNEL_STEPS[index - 1])?.size ?? 0);
      return { name, count, conversion: index === 0 || previous === 0 ? null : Math.round((count / previous) * 1000) / 10 };
    });

    const devices = ["desktop", "mobile", "tablet", "unknown"].map((name) => ({
      name,
      count: new Set(
        events
          .filter((event) => event.event_name === "page_view" && (event.device_family ?? "unknown") === name)
          .map(identityOf),
      ).size,
    }));

    const recentErrors = events.filter((event) => event.event_kind === "error").slice(0, 100);
    const eventById = new Map(events.map((event) => [event.id, event]));
    const alerts = (alertsResult.data ?? []).map((alert) => ({ ...alert, event: eventById.get(alert.event_id) ?? null }));
    const now = Date.now();
    const overdueSafety = (reportsResult.data ?? []).filter(
      (row) => row.sla_due_at && new Date(row.sla_due_at).getTime() < now,
    ).length;

    return {
      days: data.days,
      funnel,
      devices,
      recentErrors,
      alerts,
      backups: backupsResult.data ?? [],
      health: {
        errors24h: events.filter((event) => event.event_kind === "error" && event.created_at >= dayAgo).length,
        openAlerts: (alertsResult.data ?? []).filter((alert) => alert.status !== "resolved").length,
        overdueSafety,
        criticalSupport: (supportResult.data ?? []).filter((row) => row.priority === "critical").length,
      },
    };
  });

const alertSchema = z.object({
  alertId: z.string().uuid(),
  status: z.enum(["acknowledged", "resolved"]),
  note: z.string().trim().min(5).max(2000),
});

export const updateOperationalAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => alertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("operational_alerts")
      .update({
        status: data.status,
        acknowledged_by: context.userId,
        acknowledged_at: now,
        resolved_at: data.status === "resolved" ? now : null,
        resolution_note: data.note,
        updated_at: now,
      })
      .eq("id", data.alertId);
    if (error) throw new Error("Não foi possível atualizar o alerta.");
    await logAdminAction({
      adminId: context.userId,
      actionType: `operational_alert_${data.status}`,
      targetType: "operational_alert",
      targetId: data.alertId,
      metadata: { hasNote: true },
    });
    return { ok: true };
  });

const backupSchema = z.object({
  provider: z.string().trim().min(2).max(80),
  reference: z.string().trim().min(3).max(255),
  sourceEnvironment: z.string().trim().min(2).max(80),
  restoreEnvironment: z.string().trim().min(2).max(80),
  status: z.enum(["passed", "failed"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  note: z.string().trim().min(10).max(4000),
});

export const recordBackupVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseMfa])
  .validator((input: unknown) => backupSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (new Date(data.completedAt) < new Date(data.startedAt)) throw new Error("Datas inválidas.");
    const { data: row, error } = await supabaseAdmin
      .from("backup_verification_runs")
      .insert({
        backup_provider: data.provider,
        backup_reference: data.reference,
        source_environment: data.sourceEnvironment,
        restore_environment: data.restoreEnvironment,
        status: data.status,
        verified_by: context.userId,
        started_at: data.startedAt,
        completed_at: data.completedAt,
        note: data.note,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Não foi possível registrar a restauração.");
    await logAdminAction({
      adminId: context.userId,
      actionType: `backup_restore_${data.status}`,
      targetType: "backup_verification",
      targetId: row.id,
      metadata: { provider: data.provider, source: data.sourceEnvironment, restore: data.restoreEnvironment },
    });
    return { ok: true, id: row.id };
  });

export const runOperationalReadinessCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseMfa])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const checks = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id", { count: "exact", head: true }),
      supabaseAdmin.from("content_reports").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("support_requests").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("operational_events").select("id", { count: "exact", head: true }),
      supabaseAdmin.storage.listBuckets(),
    ]);
    const names = ["profiles", "content_reports", "support_requests", "operational_events", "storage"];
    const result = checks.map((check, index) => ({
      name: names[index],
      ok: !check.error,
      count: "count" in check ? check.count ?? null : "data" in check ? check.data?.length ?? null : null,
    }));
    await recordOperationalEvent({
      eventKind: "system",
      eventName: "operational_readiness_check",
      severity: result.every((item) => item.ok) ? "info" : "high",
      userId: context.userId,
      metadata: { checks: result },
    });
    return { checkedAt: new Date().toISOString(), checks: result };
  });

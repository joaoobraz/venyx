import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { sanitizeTelemetryMetadata } from "@/lib/telemetry-safety";

export type OperationalEventInput = {
  eventKind: "product" | "error" | "security" | "system";
  eventName: string;
  severity?: "info" | "warning" | "high" | "critical";
  userId?: string | null;
  anonymousIdHash?: string | null;
  route?: string | null;
  deviceFamily?: "desktop" | "mobile" | "tablet" | "unknown" | null;
  metadata?: Record<string, unknown>;
  fingerprint?: string | null;
  notifyExternal?: boolean;
};

async function notifyExternalOperations(input: OperationalEventInput) {
  const webhookUrl = process.env.OPERATIONS_ALERT_WEBHOOK_URL?.trim();
  const severity = input.severity ?? "info";
  if (!webhookUrl || (severity !== "high" && severity !== "critical")) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service: "fanlira",
          eventKind: input.eventKind,
          eventName: input.eventName.slice(0, 80),
          severity,
          route: input.route?.slice(0, 255) ?? null,
          fingerprint: input.fingerprint?.slice(0, 128) ?? null,
          occurredAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
      if (!response.ok) console.error("[observability.webhook] rejected", response.status);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(
      "[observability.webhook] unavailable",
      error instanceof Error ? error.name : "unknown",
    );
  }
}

export async function recordOperationalEvent(input: OperationalEventInput) {
  try {
    const metadata = sanitizeTelemetryMetadata(input.metadata ?? {}) as Json;
    const { error } = await supabaseAdmin.rpc("record_operational_event", {
      _event_kind: input.eventKind,
      _event_name: input.eventName.slice(0, 80),
      _severity: input.severity ?? "info",
      _user_id: input.userId ?? null,
      _anonymous_id_hash: input.anonymousIdHash ?? null,
      _route: input.route?.slice(0, 255) ?? null,
      _device_family: input.deviceFamily ?? null,
      _metadata: metadata,
      _fingerprint: input.fingerprint?.slice(0, 128) ?? null,
    });
    if (error && !error.message.includes("VENYX_TELEMETRY_RATE_LIMIT")) {
      console.error("[observability.record]", error.code);
    }
    if (!error && input.notifyExternal) await notifyExternalOperations(input);
  } catch (error) {
    console.error("[observability.record] unavailable", error instanceof Error ? error.name : "unknown");
  }
}

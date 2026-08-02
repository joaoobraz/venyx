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
};

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
  } catch (error) {
    console.error("[observability.record] unavailable", error instanceof Error ? error.name : "unknown");
  }
}

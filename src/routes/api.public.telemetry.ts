import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordOperationalEvent } from "@/_server/observability.server";

const allowedEvents = [
  "page_view",
  "signup_completed",
  "profile_completed",
  "checkout_started",
  "login_failed",
  "moderation_failed",
  "client_error",
] as const;

const schema = z.object({
  eventKind: z.enum(["product", "error"]),
  eventName: z.enum(allowedEvents),
  severity: z.enum(["info", "warning", "high"]).default("info"),
  anonymousId: z.string().uuid(),
  route: z.string().max(255).nullable().optional(),
  deviceFamily: z.enum(["desktop", "mobile", "tablet", "unknown"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function ipOf(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || "unknown";
}

export const Route = createFileRoute("/api/public/telemetry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 8_192) return Response.json({ ok: false }, { status: 413 });
        let payload: z.infer<typeof schema>;
        try {
          const rawBody = await request.text();
          if (new TextEncoder().encode(rawBody).byteLength > 8_192) {
            return Response.json({ ok: false }, { status: 413 });
          }
          payload = schema.parse(JSON.parse(rawBody));
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const salt = process.env.CRON_SECRET || "fanlira-local-telemetry";
        const anonymousIdHash = createHash("sha256")
          .update(`${salt}:${ipOf(request)}:${payload.anonymousId}`)
          .digest("hex");
        await recordOperationalEvent({
          ...payload,
          anonymousIdHash,
          fingerprint: payload.eventKind === "error" ? `${payload.eventName}:${payload.route ?? "unknown"}` : null,
        });
        return Response.json({ ok: true }, { status: 202 });
      },
    },
  },
});

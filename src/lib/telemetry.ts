const TELEMETRY_SESSION_KEY = "venyx_telemetry_session";

function anonymousId() {
  if (typeof window === "undefined") return crypto.randomUUID();
  const current = window.sessionStorage.getItem(TELEMETRY_SESSION_KEY);
  if (current) return current;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(TELEMETRY_SESSION_KEY, next);
  return next;
}

function deviceFamily(): "desktop" | "mobile" | "tablet" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1100) return "tablet";
  return "desktop";
}

async function send(eventKind: "product" | "error", eventName: string, severity: "info" | "warning" | "high", metadata: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/public/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventKind,
        eventName,
        severity,
        anonymousId: anonymousId(),
        route: window.location.pathname,
        deviceFamily: deviceFamily(),
        metadata,
      }),
      keepalive: true,
    });
  } catch {
    // Telemetry must never interrupt the user flow.
  }
}

export function trackProductEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  void send("product", eventName, "info", metadata);
}

export function trackClientError(eventName: string, error: unknown, metadata: Record<string, unknown> = {}) {
  const safeError = error instanceof Error
    ? { name: error.name, message: error.message.slice(0, 300) }
    : { name: "UnknownError" };
  void send("error", eventName, "high", { ...metadata, error: safeError });
}

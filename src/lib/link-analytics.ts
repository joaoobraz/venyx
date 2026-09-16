const STORAGE_KEY = "venyx:public-link-visitor:v1";

function anonymousId() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const generated = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}

export function recordPublicLinkEvent(input: {
  eventType: "view" | "click";
  creatorId: string;
  linkId?: string;
}) {
  const visitor = anonymousId();
  if (!visitor) return;
  void fetch("/api/public/link-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ ...input, anonymousId: visitor }),
  }).catch(() => undefined);
}

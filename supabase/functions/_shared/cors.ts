const LOCAL_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];

function allowedOrigins() {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return new Set([...LOCAL_ORIGINS, ...configured]);
}

export function corsHeadersFor(req: Request) {
  const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function isAllowedBrowserOrigin(req: Request) {
  const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
  return !origin || allowedOrigins().has(origin);
}

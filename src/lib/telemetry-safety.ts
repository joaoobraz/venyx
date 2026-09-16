const SENSITIVE_KEY = /(?:password|senha|token|secret|authorization|cookie|cpf|cnpj|document|pix_key|email|phone)/i;

export function redactTelemetryText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token]")
    .replace(/\b\d{11,16}\b/g, "[number]")
    .slice(0, 500);
}

export function sanitizeTelemetryMetadata(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactTelemetryText(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeTelemetryMetadata(item, depth + 1));
  if (typeof value !== "object") return undefined;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
    output[key.slice(0, 64)] = SENSITIVE_KEY.test(key)
      ? "[redacted]"
      : sanitizeTelemetryMetadata(item, depth + 1);
  }
  return output;
}

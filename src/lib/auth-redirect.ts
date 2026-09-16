export const DEFAULT_AUTH_REDIRECT_PATH = "/feed";

export function getSafeAuthRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH,
) {
  // Barra invertida também é rejeitada: o parser trata "/\evil.com" como
  // "//evil.com" (protocol-relative) e viraria um open redirect.
  if (!value || !value.startsWith("/") || /^[\\/]{2}/.test(value) || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "http://localhost");
    if (parsed.origin !== "http://localhost" || parsed.pathname.startsWith("//")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function createOAuthCallbackUrl(
  origin: string,
  next = DEFAULT_AUTH_REDIRECT_PATH,
) {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", getSafeAuthRedirectPath(next));
  return callbackUrl.toString();
}

export function getOAuthErrorFromUrl(href: string) {
  const url = new URL(href);
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

  return (
    query.get("error_description") ||
    query.get("error") ||
    hash.get("error_description") ||
    hash.get("error") ||
    null
  );
}

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

/** Normalizes creator-owned outbound links and rejects executable/credential URLs. */
export function normalizeCreatorLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!HTTP_PROTOCOLS.has(url.protocol) || !url.hostname || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

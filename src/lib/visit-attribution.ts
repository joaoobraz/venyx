export const VISIT_SOURCE_KEYS = [
  "social",
  "venyx_search",
  "venyx_links",
  "creator_links",
  "campaigns",
  "coupons",
  "direct",
  "other",
] as const;

export type VisitSourceKey = (typeof VISIT_SOURCE_KEYS)[number];

export type VisitAttributionMethod =
  | "coupon"
  | "utm_campaign"
  | "venyx_link"
  | "internal_search"
  | "creator_link"
  | "social_parameter"
  | "social_referrer"
  | "external_referrer"
  | "direct";

export interface VisitAttribution {
  source: VisitSourceKey;
  method: VisitAttributionMethod;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string;
}

const SOCIAL_SOURCES = new Set([
  "facebook",
  "fb",
  "instagram",
  "ig",
  "snapchat",
  "telegram",
  "threads",
  "tiktok",
  "twitter",
  "x",
  "youtube",
]);

const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "tiktok.com",
  "t.co",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "telegram.me",
  "t.me",
  "snapchat.com",
  "threads.net",
];

const SOURCE_WEIGHTS: Record<VisitSourceKey, number> = {
  social: 0.35,
  venyx_search: 0.18,
  venyx_links: 0.13,
  creator_links: 0.1,
  campaigns: 0.09,
  coupons: 0.05,
  direct: 0.07,
  other: 0.03,
};

function safeUrl(value: string | null | undefined, base: string) {
  if (!value) return null;
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function normalized(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function safeCampaignValue(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
}

function isSocialHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return SOCIAL_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

function attribution(
  source: VisitSourceKey,
  method: VisitAttributionMethod,
  landing: URL,
  referrer: URL | null,
): VisitAttribution {
  return {
    source,
    method,
    utmSource: safeCampaignValue(landing.searchParams.get("utm_source")),
    utmMedium: safeCampaignValue(landing.searchParams.get("utm_medium")),
    utmCampaign: safeCampaignValue(landing.searchParams.get("utm_campaign")),
    referrerHost: referrer ? referrer.hostname.toLowerCase().slice(0, 120) : undefined,
  };
}

/**
 * Assigns exactly one source to a visit, preferring the most specific evidence.
 * Raw referrer URLs and coupon codes are deliberately not returned.
 */
export function classifyVisitAttribution(input: {
  landingUrl: string;
  referrer?: string | null;
  siteOrigin?: string;
}): VisitAttribution {
  const base = input.siteOrigin || "https://fanlira.com.br";
  const landing = safeUrl(input.landingUrl, base) ?? new URL(base);
  const referrer = safeUrl(input.referrer, landing.origin);
  const params = landing.searchParams;
  const source = normalized(params.get("source") || params.get("utm_source"));
  const medium = normalized(params.get("utm_medium"));
  const via = normalized(params.get("via"));
  const sameOriginReferrer = Boolean(referrer && referrer.origin === landing.origin);

  if (
    landing.pathname.toLowerCase().startsWith("/c/") ||
    params.has("coupon") ||
    params.has("coupon_code")
  ) {
    return attribution("coupons", "coupon", landing, referrer);
  }

  if (params.has("utm_campaign") || params.has("campaign") || params.has("campaign_id")) {
    return attribution("campaigns", "utm_campaign", landing, referrer);
  }

  if (
    source === "venyx_links" ||
    medium === "venyx_links" ||
    via === "venyx_links" ||
    (sameOriginReferrer && referrer?.pathname.toLowerCase().startsWith("/links/"))
  ) {
    return attribution("venyx_links", "venyx_link", landing, referrer);
  }

  if (
    source === "venyx_search" ||
    medium === "internal_search" ||
    via === "venyx_search" ||
    (sameOriginReferrer && referrer?.pathname.toLowerCase().startsWith("/search"))
  ) {
    return attribution("venyx_search", "internal_search", landing, referrer);
  }

  if (
    source === "creator_link" ||
    medium === "creator_link" ||
    via === "creator" ||
    normalized(params.get("shared_by")) === "creator"
  ) {
    return attribution("creator_links", "creator_link", landing, referrer);
  }

  if (SOCIAL_SOURCES.has(source)) {
    return attribution("social", "social_parameter", landing, referrer);
  }

  if (referrer && isSocialHost(referrer.hostname)) {
    return attribution("social", "social_referrer", landing, referrer);
  }

  if (referrer && !sameOriginReferrer) {
    return attribution("other", "external_referrer", landing, referrer);
  }

  return attribution("direct", "direct", landing, referrer);
}

export function visitAttributionMetadata(input: {
  landingUrl: string;
  referrer?: string | null;
  siteOrigin?: string;
}) {
  const result = classifyVisitAttribution(input);
  return {
    visitSource: result.source,
    attributionMethod: result.method,
    ...(result.utmSource ? { utmSource: result.utmSource } : {}),
    ...(result.utmMedium ? { utmMedium: result.utmMedium } : {}),
    ...(result.utmCampaign ? { utmCampaign: result.utmCampaign } : {}),
    ...(result.referrerHost ? { referrerHost: result.referrerHost } : {}),
  };
}

export function withFanliraLinkAttribution(destination: string, siteOrigin: string) {
  const origin = safeUrl(siteOrigin, "https://fanlira.com.br");
  const target = origin ? safeUrl(destination, origin.origin) : null;
  if (!origin || !target || target.origin !== origin.origin) return destination;
  if (!target.searchParams.has("via")) target.searchParams.set("via", "venyx_links");
  const isRelative = destination.startsWith("/");
  return isRelative ? `${target.pathname}${target.search}${target.hash}` : target.toString();
}

/** Distributes the local demonstration total while preserving an exact sum. */
export function distributeVisitSources(totalVisits: number): Record<VisitSourceKey, number> {
  const safeTotal = Math.max(0, Math.floor(totalVisits));
  const counts = Object.fromEntries(
    VISIT_SOURCE_KEYS.map((source) => [source, Math.floor(safeTotal * SOURCE_WEIGHTS[source])]),
  ) as Record<VisitSourceKey, number>;
  const assigned = VISIT_SOURCE_KEYS.reduce((total, source) => total + counts[source], 0);
  counts.social += safeTotal - assigned;
  return counts;
}

export const BRAZIL_STATES = [
  ["AC", "Acre"],
  ["AL", "Alagoas"],
  ["AP", "Amapá"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["CE", "Ceará"],
  ["DF", "Distrito Federal"],
  ["ES", "Espírito Santo"],
  ["GO", "Goiás"],
  ["MA", "Maranhão"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PA", "Pará"],
  ["PB", "Paraíba"],
  ["PR", "Paraná"],
  ["PE", "Pernambuco"],
  ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "São Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
] as const;

export type BrazilStateCode = (typeof BRAZIL_STATES)[number][0];

export interface CreatorProfileVisibility {
  showAge: boolean;
  showLocation: boolean;
  showSocialLinks: boolean;
  showSubscriberCount: boolean;
  showRanking: boolean;
  showVerifiedBadge: boolean;
  showWishlist: boolean;
  showPlans: boolean;
  showComments: boolean;
  showResponseTime: boolean;
  showBio: boolean;
  showCategory: boolean;
  showLikeCount: boolean;
  showPostCount: boolean;
  showActivityStatus: boolean;
  blockedStates: BrazilStateCode[];
}

export const DEFAULT_PROFILE_VISIBILITY: CreatorProfileVisibility = {
  showAge: true,
  showLocation: true,
  showSocialLinks: true,
  showSubscriberCount: true,
  showRanking: true,
  showVerifiedBadge: true,
  showWishlist: true,
  showPlans: true,
  showComments: true,
  showResponseTime: true,
  showBio: true,
  showCategory: true,
  showLikeCount: true,
  showPostCount: true,
  showActivityStatus: true,
  blockedStates: [],
};

export const CREATOR_PROFILE_VISIBILITY_CHANGED_EVENT = "venyx:creator-profile-visibility-changed";

const DEMO_STORAGE_VERSION = "v1";

function demoStorageKey(creatorId: string) {
  return `venyx:demo-profile-visibility:${DEMO_STORAGE_VERSION}:${creatorId}`;
}

function normalizeStates(value: unknown): BrazilStateCode[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(BRAZIL_STATES.map(([code]) => code));
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toUpperCase())
        .filter((item): item is BrazilStateCode => allowed.has(item)),
    ),
  );
}

export function normalizeProfileVisibility(
  value?: Partial<CreatorProfileVisibility> | null,
): CreatorProfileVisibility {
  if (!value) return { ...DEFAULT_PROFILE_VISIBILITY, blockedStates: [] };
  const next = {
    ...DEFAULT_PROFILE_VISIBILITY,
    blockedStates: normalizeStates(value.blockedStates),
  };
  const booleanKeys = Object.keys(DEFAULT_PROFILE_VISIBILITY).filter(
    (key) => key !== "blockedStates",
  ) as Array<Exclude<keyof CreatorProfileVisibility, "blockedStates">>;
  for (const key of booleanKeys) {
    if (typeof value[key] === "boolean") next[key] = value[key];
  }
  return next;
}

export function profileVisibilityFromDatabase(
  row: Record<string, unknown> | null,
): CreatorProfileVisibility {
  if (!row) return normalizeProfileVisibility();
  return normalizeProfileVisibility({
    showAge: row.show_age as boolean,
    showLocation: row.show_location as boolean,
    showSocialLinks: row.show_social_links as boolean,
    showSubscriberCount: row.show_subscriber_count as boolean,
    showRanking: row.show_ranking as boolean,
    showVerifiedBadge: row.show_verified_badge as boolean,
    showWishlist: row.show_wishlist as boolean,
    showPlans: row.show_plans as boolean,
    showComments: row.show_comments as boolean,
    showResponseTime: row.show_response_time as boolean,
    showBio: row.show_bio as boolean,
    showCategory: row.show_category as boolean,
    showLikeCount: row.show_like_count as boolean,
    showPostCount: row.show_post_count as boolean,
    showActivityStatus: row.show_activity_status as boolean,
    blockedStates: row.blocked_states as BrazilStateCode[],
  });
}

export function profileVisibilityToDatabase(creatorId: string, value: CreatorProfileVisibility) {
  return {
    creator_id: creatorId,
    show_age: value.showAge,
    show_location: value.showLocation,
    show_social_links: value.showSocialLinks,
    show_subscriber_count: value.showSubscriberCount,
    show_ranking: value.showRanking,
    show_verified_badge: value.showVerifiedBadge,
    show_wishlist: value.showWishlist,
    show_plans: value.showPlans,
    show_comments: value.showComments,
    show_response_time: value.showResponseTime,
    show_bio: value.showBio,
    show_category: value.showCategory,
    show_like_count: value.showLikeCount,
    show_post_count: value.showPostCount,
    show_activity_status: value.showActivityStatus,
    blocked_states: value.blockedStates,
  };
}

export function readDemoProfileVisibility(creatorId: string): CreatorProfileVisibility {
  if (typeof window === "undefined") return normalizeProfileVisibility();
  try {
    const stored = window.localStorage.getItem(demoStorageKey(creatorId));
    if (stored) return normalizeProfileVisibility(JSON.parse(stored));
  } catch {
    // Corrupted demo-only preferences fall back to safe defaults.
  }
  const initial = normalizeProfileVisibility();
  window.localStorage.setItem(demoStorageKey(creatorId), JSON.stringify(initial));
  return initial;
}

export function writeDemoProfileVisibility(creatorId: string, value: CreatorProfileVisibility) {
  const next = normalizeProfileVisibility(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(demoStorageKey(creatorId), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(CREATOR_PROFILE_VISIBILITY_CHANGED_EVENT, {
        detail: { creatorId },
      }),
    );
  }
  return next;
}

export function extractBrazilState(location?: string | null): BrazilStateCode | null {
  if (!location) return null;
  const match = location
    .trim()
    .toUpperCase()
    .match(/(?:,|\s)([A-Z]{2})$/);
  if (!match) return null;
  const code = match[1];
  return BRAZIL_STATES.some(([stateCode]) => stateCode === code) ? (code as BrazilStateCode) : null;
}

export function isViewerStateBlocked(
  visibility: CreatorProfileVisibility,
  viewerLocation?: string | null,
) {
  const state = extractBrazilState(viewerLocation);
  return state ? visibility.blockedStates.includes(state) : false;
}

export function resolveOwnProfileUsername(input: {
  authenticatedUserId?: string | null;
  profileUserId?: string | null;
  profileUsername?: string | null;
  isCreator: boolean;
  demoPreviewRole?: "subscriber" | "creator" | "admin" | null;
}) {
  if (input.demoPreviewRole === "creator") return "aline";
  if (input.demoPreviewRole === "admin") return null;
  if (
    input.authenticatedUserId &&
    input.profileUserId === input.authenticatedUserId &&
    input.profileUsername
  ) {
    return input.profileUsername;
  }
  return null;
}

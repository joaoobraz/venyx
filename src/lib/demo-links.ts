import { getDemoCreator } from "./demo-creators.ts";
import {
  createEmptyPixelConfigs,
  mergePixelConfigs,
  type CreatorPixelConfig,
  type PixelProvider,
} from "./creator-pixels.ts";

export type DemoLinkButtonStyle = "rounded" | "pill" | "square" | "outline";
export type DemoLinkFont = "playfair" | "inter" | "poppins" | "cursive";
export type DemoLinkIcon =
  "instagram" | "tiktok" | "venyx" | "gift" | "campaign" | "coupon" | "globe";
export type DemoTrackingChannel =
  "instagram" | "tiktok" | "meta_ads" | "google_ads" | "campaign" | "coupon" | "custom";

export interface DemoLinkPageSettings {
  title: string;
  description: string;
  backgroundColor: string;
  buttonColor: string;
  textColor: string;
  buttonTextColor: string;
  accentColor: string;
  font: DemoLinkFont;
  buttonStyle: DemoLinkButtonStyle;
  avatarUrl: string;
  bannerUrl: string;
  showAvatar: boolean;
  isPublished: boolean;
  updatedAt: string;
}

export interface DemoPageLink {
  id: string;
  kind: "link" | "text";
  title: string;
  url: string;
  icon: DemoLinkIcon;
  active: boolean;
  featured: boolean;
  clicks: number;
}

export interface DemoTrackingLink {
  id: string;
  slug: string;
  name: string;
  channel: DemoTrackingChannel;
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  couponCode: string;
  expiresAt: string;
  active: boolean;
  clicks: number;
  conversions: number;
  createdAt: string;
}

export interface DemoLinksState {
  page: DemoLinkPageSettings;
  links: DemoPageLink[];
  trackingLinks: DemoTrackingLink[];
  pixels: CreatorPixelConfig[];
  views: number;
}

const STORAGE_KEY = "venyx:presentation:links-studio:v1";
export const DEMO_LINKS_CHANGED_EVENT = "venyx:demo-links-changed";

function id(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function slug(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  return `${normalized || "link"}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDemoLinksSeed(): DemoLinksState {
  const creator = getDemoCreator("aline");
  const avatarUrl = creator?.avatar_url ?? "";
  const bannerUrl = creator?.cover_url ?? "";
  return {
    page: {
      title: creator?.display_name ?? "Aline",
      description: creator?.bio ?? "Ensaios editoriais, bastidores e novidades toda semana.",
      backgroundColor: "#24140d",
      buttonColor: "#4a2f1d",
      textColor: "#f8e9c8",
      buttonTextColor: "#fff3d6",
      accentColor: "#d7a85d",
      font: "playfair",
      buttonStyle: "rounded",
      avatarUrl,
      bannerUrl,
      showAvatar: true,
      isPublished: true,
      updatedAt: new Date().toISOString(),
    },
    links: [
      {
        id: "demo-links-gifts",
        kind: "link",
        title: "Minha Lista de Mimos",
        url: "/gifts/aline",
        icon: "gift",
        active: true,
        featured: true,
        clicks: 486,
      },
      {
        id: "demo-links-profile",
        kind: "link",
        title: "Meu perfil na Fanlira",
        url: "/profile/aline",
        icon: "venyx",
        active: true,
        featured: true,
        clicks: 721,
      },
      {
        id: "demo-links-instagram",
        kind: "link",
        title: "Instagram",
        url: "https://instagram.com/",
        icon: "instagram",
        active: true,
        featured: false,
        clicks: 418,
      },
      {
        id: "demo-links-tiktok",
        kind: "link",
        title: "TikTok",
        url: "https://tiktok.com/",
        icon: "tiktok",
        active: true,
        featured: false,
        clicks: 217,
      },
    ],
    trackingLinks: [
      {
        id: "tracking-instagram-bio",
        slug: "instagram-bio-aline",
        name: "Bio do Instagram",
        channel: "instagram",
        destinationUrl: "/profile/aline",
        utmSource: "instagram",
        utmMedium: "social",
        utmCampaign: "",
        utmContent: "bio",
        couponCode: "",
        expiresAt: "",
        active: true,
        clicks: 384,
        conversions: 42,
        createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
      },
      {
        id: "tracking-meta-launch",
        slug: "meta-lancamento-agosto",
        name: "Anúncio Meta — Agosto",
        channel: "meta_ads",
        destinationUrl: "/profile/aline",
        utmSource: "meta",
        utmMedium: "paid_social",
        utmCampaign: "lancamento_agosto",
        utmContent: "criativo_01",
        couponCode: "",
        expiresAt: "2026-08-31",
        active: true,
        clicks: 192,
        conversions: 19,
        createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      },
      {
        id: "tracking-coupon-welcome",
        slug: "cupom-bemvinda20",
        name: "Cupom BEMVINDA20",
        channel: "coupon",
        destinationUrl: "/profile/aline",
        utmSource: "creator_link",
        utmMedium: "coupon",
        utmCampaign: "boas_vindas",
        utmContent: "",
        couponCode: "BEMVINDA20",
        expiresAt: "",
        active: true,
        clicks: 96,
        conversions: 14,
        createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
    ],
    pixels: createEmptyPixelConfigs(),
    views: 3_284,
  };
}

export function readDemoLinksState(): DemoLinksState {
  const seed = createDemoLinksSeed();
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<DemoLinksState>;
    const legacyPage = parsed.page as
      | (Partial<DemoLinkPageSettings> & {
          pixelEnabled?: boolean;
          pixelProvider?: "meta" | "google" | "tiktok";
          pixelId?: string;
        })
      | undefined;
    let pixels = mergePixelConfigs(parsed.pixels);
    if (!parsed.pixels && legacyPage?.pixelId) {
      const legacyProvider: PixelProvider =
        legacyPage.pixelProvider === "google"
          ? "google_analytics"
          : (legacyPage.pixelProvider ?? "meta");
      pixels = pixels.map((config) =>
        config.provider === legacyProvider
          ? {
              ...config,
              pixelId: legacyPage.pixelId ?? "",
              enabled: legacyPage.pixelEnabled === true,
            }
          : config,
      );
    }
    return {
      ...seed,
      ...parsed,
      page: { ...seed.page, ...(parsed.page ?? {}) },
      links: (parsed.links ?? seed.links).map((link) => ({
        ...link,
        kind: link.kind ?? "link",
      })),
      trackingLinks: parsed.trackingLinks ?? seed.trackingLinks,
      pixels,
    };
  } catch {
    return seed;
  }
}

export function writeDemoLinksState(state: DemoLinksState) {
  if (typeof window === "undefined") return state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(DEMO_LINKS_CHANGED_EVENT));
  return state;
}

export function updateDemoLinksState(update: (state: DemoLinksState) => DemoLinksState) {
  return writeDemoLinksState(update(readDemoLinksState()));
}

export function createDemoPageLink(input: Omit<DemoPageLink, "id" | "clicks">): DemoPageLink {
  return { ...input, id: id("page-link"), clicks: 0 };
}

const CHANNEL_UTM: Record<DemoTrackingChannel, { source: string; medium: string }> = {
  instagram: { source: "instagram", medium: "social" },
  tiktok: { source: "tiktok", medium: "social" },
  meta_ads: { source: "meta", medium: "paid_social" },
  google_ads: { source: "google", medium: "cpc" },
  campaign: { source: "venyx", medium: "campaign" },
  coupon: { source: "creator_link", medium: "coupon" },
  custom: { source: "creator_link", medium: "creator_link" },
};

export function createDemoTrackingLink(input: {
  name: string;
  channel: DemoTrackingChannel;
  destinationUrl: string;
  campaign?: string;
  content?: string;
  couponCode?: string;
  expiresAt?: string;
}): DemoTrackingLink {
  const defaults = CHANNEL_UTM[input.channel];
  return {
    id: id("tracking-link"),
    slug: slug(input.name),
    name: input.name.trim(),
    channel: input.channel,
    destinationUrl: input.destinationUrl.trim(),
    utmSource: defaults.source,
    utmMedium: defaults.medium,
    utmCampaign: input.campaign?.trim() ?? "",
    utmContent: input.content?.trim() ?? "",
    couponCode: input.couponCode?.trim().toUpperCase() ?? "",
    expiresAt: input.expiresAt ?? "",
    active: true,
    clicks: 0,
    conversions: 0,
    createdAt: new Date().toISOString(),
  };
}

export function buildDemoTrackingUrl(link: DemoTrackingLink, origin: string) {
  const base = link.couponCode
    ? `/c/${encodeURIComponent(link.couponCode)}`
    : link.destinationUrl || "/profile/aline";
  const target = new URL(base, origin);
  if (link.utmSource) target.searchParams.set("utm_source", link.utmSource);
  if (link.utmMedium) target.searchParams.set("utm_medium", link.utmMedium);
  if (link.utmCampaign) target.searchParams.set("utm_campaign", link.utmCampaign);
  if (link.utmContent) target.searchParams.set("utm_content", link.utmContent);
  if (link.couponCode) target.searchParams.set("coupon_code", link.couponCode);
  target.searchParams.set("link_id", link.slug);
  return target.toString();
}

export function demoTrackingLinkAvailable(link: DemoTrackingLink, today = new Date()) {
  if (!link.active) return false;
  if (!link.expiresAt) return true;
  const expires = new Date(`${link.expiresAt}T23:59:59`);
  return expires >= today;
}

export function demoLinkFontFamily(font: DemoLinkFont) {
  if (font === "inter") return "Inter, ui-sans-serif, system-ui, sans-serif";
  if (font === "poppins") return "Poppins, Inter, ui-sans-serif, sans-serif";
  if (font === "cursive") return '"Comic Sans MS", cursive';
  return '"Playfair Display", Georgia, serif';
}

export function demoLinkButtonRadius(style: DemoLinkButtonStyle) {
  if (style === "pill") return "9999px";
  if (style === "square") return "8px";
  return "18px";
}

export function recordDemoPageLinkClick(linkId: string) {
  return updateDemoLinksState((state) => ({
    ...state,
    links: state.links.map((link) =>
      link.id === linkId ? { ...link, clicks: link.clicks + 1 } : link,
    ),
  }));
}

export function recordDemoLinksPageView() {
  return updateDemoLinksState((state) => ({ ...state, views: state.views + 1 }));
}

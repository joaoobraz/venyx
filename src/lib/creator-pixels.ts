export const PIXEL_PROVIDERS = [
  "meta",
  "google_analytics",
  "google_ads",
  "tiktok",
  "pinterest",
  "snapchat",
] as const;

export type PixelProvider = (typeof PIXEL_PROVIDERS)[number];
export type CreatorPixelEvent = "page_view" | "link_click";

export interface CreatorPixelConfig {
  provider: PixelProvider;
  pixelId: string;
  enabled: boolean;
  trackPageViews: boolean;
  trackLinkClicks: boolean;
  lastValidatedAt: string;
}

export interface PixelProviderDefinition {
  provider: PixelProvider;
  label: string;
  shortLabel: string;
  placeholder: string;
  idLabel: string;
  description: string;
  helpUrl: string;
}

export const PIXEL_PROVIDER_DEFINITIONS: Record<PixelProvider, PixelProviderDefinition> = {
  meta: {
    provider: "meta",
    label: "Meta Pixel",
    shortLabel: "Meta",
    placeholder: "123456789012345",
    idLabel: "ID do Pixel",
    description: "Mede visitas e cliques para campanhas do Instagram e Facebook.",
    helpUrl: "https://www.facebook.com/business/help/952192354843755",
  },
  google_analytics: {
    provider: "google_analytics",
    label: "Google Analytics 4",
    shortLabel: "GA4",
    placeholder: "G-XXXXXXXXXX",
    idLabel: "ID de medição",
    description: "Envia visualizações e eventos personalizados para uma propriedade GA4.",
    helpUrl: "https://developers.google.com/tag-platform/gtagjs",
  },
  google_ads: {
    provider: "google_ads",
    label: "Google Ads",
    shortLabel: "Google Ads",
    placeholder: "AW-123456789",
    idLabel: "ID da tag",
    description: "Mede o tráfego das campanhas e prepara a atribuição do Google Ads.",
    helpUrl: "https://developers.google.com/tag-platform/gtagjs",
  },
  tiktok: {
    provider: "tiktok",
    label: "TikTok Pixel",
    shortLabel: "TikTok",
    placeholder: "CXXXXXXXXXXXXXXXXXXX",
    idLabel: "Pixel ID",
    description: "Mede visitas e cliques originados de campanhas no TikTok.",
    helpUrl: "https://ads.tiktok.com/help/article/get-started-pixel",
  },
  pinterest: {
    provider: "pinterest",
    label: "Pinterest Tag",
    shortLabel: "Pinterest",
    placeholder: "1234567890123",
    idLabel: "Tag ID",
    description: "Registra PageVisit e eventos personalizados de clique do Pinterest.",
    helpUrl: "https://help.pinterest.com/en/business/article/install-the-base-code",
  },
  snapchat: {
    provider: "snapchat",
    label: "Snap Pixel",
    shortLabel: "Snapchat",
    placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    idLabel: "Pixel ID",
    description: "Registra PAGE_VIEW e cliques de campanhas no Snapchat.",
    helpUrl: "https://developers.snap.com/marketing-api/Ads-API/snap-pixel",
  },
};

export function createEmptyPixelConfigs(): CreatorPixelConfig[] {
  return PIXEL_PROVIDERS.map((provider) => ({
    provider,
    pixelId: "",
    enabled: false,
    trackPageViews: true,
    trackLinkClicks: true,
    lastValidatedAt: "",
  }));
}

export function normalizePixelId(provider: PixelProvider, value: string) {
  const trimmed = value.trim();
  if (provider === "meta" || provider === "pinterest") return trimmed.replace(/[\s-]/g, "");
  return trimmed.toUpperCase().replace(/\s/g, "");
}

export function validatePixelId(provider: PixelProvider, value: string) {
  const raw = value.trim();
  const id = normalizePixelId(provider, value);
  if (!id) return { valid: false, message: "Informe o identificador fornecido pela plataforma." };
  if ((provider === "meta" || provider === "pinterest") && !/^[\d\s-]+$/.test(raw)) {
    return {
      valid: false,
      message: `Formato inválido para ${PIXEL_PROVIDER_DEFINITIONS[provider].label}.`,
    };
  }
  const valid =
    provider === "meta"
      ? /^\d{6,20}$/.test(id)
      : provider === "google_analytics"
        ? /^(?:G|GT)-[A-Z0-9]{4,20}$/.test(id)
        : provider === "google_ads"
          ? /^AW-\d{5,20}$/.test(id)
          : provider === "tiktok"
            ? /^[A-Z0-9]{10,30}$/.test(id)
            : provider === "pinterest"
              ? /^\d{5,20}$/.test(id)
              : /^[A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12}$/.test(id);
  return valid
    ? { valid: true, message: "Formato válido." }
    : {
        valid: false,
        message: `Formato inválido para ${PIXEL_PROVIDER_DEFINITIONS[provider].label}.`,
      };
}

export function mergePixelConfigs(value: CreatorPixelConfig[] | undefined) {
  const current = new Map((value ?? []).map((config) => [config.provider, config]));
  return createEmptyPixelConfigs().map((fallback) => ({
    ...fallback,
    ...(current.get(fallback.provider) ?? {}),
  }));
}

export function enabledValidPixels(configs: CreatorPixelConfig[]) {
  return configs.filter(
    (config) => config.enabled && validatePixelId(config.provider, config.pixelId).valid,
  );
}

type QueueFunction = ((...args: unknown[]) => void) & {
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  callMethod?: (...args: unknown[]) => void;
};

type TikTokQueue = unknown[] & {
  methods?: string[];
  setAndDefer?: (target: TikTokQueue, method: string) => void;
  instance?: (id: string) => TikTokQueue;
  load?: (id: string, options?: Record<string, unknown>) => void;
  page?: (...args: unknown[]) => void;
  track?: (...args: unknown[]) => void;
  _i?: Record<string, TikTokQueue>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
};

type PixelWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: QueueFunction;
  _fbq?: QueueFunction;
  TiktokAnalyticsObject?: string;
  ttq?: TikTokQueue;
  pintrk?: QueueFunction;
  snaptr?: QueueFunction;
  __venyxInitializedPixels?: Set<string>;
  __venyxPixelPageViews?: Set<string>;
};

function pixelWindow() {
  return window as PixelWindow;
}

function appendScript(id: string, source: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = source;
  script.referrerPolicy = "strict-origin-when-cross-origin";
  document.head.appendChild(script);
}

function setupMeta(pixelId: string) {
  const w = pixelWindow();
  if (!w.fbq) {
    const fbq: QueueFunction = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    w.fbq = fbq;
    w._fbq = fbq;
  }
  appendScript("venyx-pixel-meta", "https://connect.facebook.net/en_US/fbevents.js");
  w.fbq("init", pixelId);
}

function setupGoogle(tagId: string) {
  const w = pixelWindow();
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = w.gtag ?? ((...args: unknown[]) => w.dataLayer?.push(args));
  const initialized = w.__venyxInitializedPixels ?? new Set<string>();
  if (!initialized.has("google-consent")) {
    w.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
    w.gtag("js", new Date());
    initialized.add("google-consent");
  }
  w.gtag("consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
    analytics_storage: "granted",
  });
  appendScript(
    "venyx-pixel-google",
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`,
  );
  w.__venyxInitializedPixels = initialized;
  w.gtag("config", tagId, { send_page_view: false, anonymize_ip: true });
}

function setupTikTok(pixelId: string) {
  const w = pixelWindow();
  if (!w.ttq) {
    const ttq = [] as TikTokQueue;
    ttq.methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
      "holdConsent",
      "revokeConsent",
      "grantConsent",
    ];
    ttq.setAndDefer = (target, method) => {
      (target as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
        target.push([method, ...args]);
      };
    };
    for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
    ttq.instance = (id) => {
      const instance = (ttq._i?.[id] ?? []) as TikTokQueue;
      for (const method of ttq.methods ?? []) ttq.setAndDefer?.(instance, method);
      return instance;
    };
    ttq.load = (id, options = {}) => {
      ttq._i = ttq._i ?? {};
      ttq._i[id] = [] as TikTokQueue;
      ttq._t = ttq._t ?? {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o ?? {};
      ttq._o[id] = options;
      appendScript(
        `venyx-pixel-tiktok-${id}`,
        `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`,
      );
    };
    w.TiktokAnalyticsObject = "ttq";
    w.ttq = ttq;
  }
  w.ttq.load?.(pixelId);
  const consent = (w.ttq as unknown as Record<string, unknown>).grantConsent;
  if (typeof consent === "function") (consent as () => void)();
}

function setupPinterest(tagId: string) {
  const w = pixelWindow();
  if (!w.pintrk) {
    const pintrk: QueueFunction = (...args: unknown[]) => pintrk.queue?.push(args);
    pintrk.queue = [];
    pintrk.version = "3.0";
    w.pintrk = pintrk;
  }
  appendScript("venyx-pixel-pinterest", "https://s.pinimg.com/ct/core.js");
  w.pintrk("load", tagId, { fp_cookie: true });
  w.pintrk("setconsent", true);
}

function setupSnapchat(pixelId: string) {
  const w = pixelWindow();
  if (!w.snaptr) {
    const snaptr: QueueFunction = (...args: unknown[]) => snaptr.queue?.push(args);
    snaptr.queue = [];
    w.snaptr = snaptr;
  }
  appendScript("venyx-pixel-snapchat", "https://sc-static.net/scevent.min.js");
  w.snaptr("init", pixelId, {});
}

function setupPixel(config: CreatorPixelConfig) {
  const pixelId = normalizePixelId(config.provider, config.pixelId);
  if (config.provider === "meta") setupMeta(pixelId);
  else if (config.provider === "google_analytics" || config.provider === "google_ads")
    setupGoogle(pixelId);
  else if (config.provider === "tiktok") setupTikTok(pixelId);
  else if (config.provider === "pinterest") setupPinterest(pixelId);
  else setupSnapchat(pixelId);
}

function sanitizedProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => typeof value === "string" || typeof value === "number")
      .slice(0, 12)
      .map(([key, value]) => [
        key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40),
        typeof value === "string" ? value.slice(0, 100) : value,
      ]),
  );
}

export function initializeCreatorPixels(configs: CreatorPixelConfig[]) {
  if (typeof window === "undefined" || typeof document === "undefined") return [];
  const w = pixelWindow();
  const initialized = w.__venyxInitializedPixels ?? new Set<string>();
  const loaded: PixelProvider[] = [];
  for (const config of enabledValidPixels(configs)) {
    const key = `${config.provider}:${normalizePixelId(config.provider, config.pixelId)}`;
    if (!initialized.has(key)) {
      setupPixel(config);
      initialized.add(key);
    }
    loaded.push(config.provider);
  }
  w.__venyxInitializedPixels = initialized;
  return loaded;
}

export function trackCreatorPixelEvent(
  configs: CreatorPixelConfig[],
  event: CreatorPixelEvent,
  properties: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return [];
  const w = pixelWindow();
  const payload = sanitizedProperties(properties);
  const sent: PixelProvider[] = [];
  for (const config of enabledValidPixels(configs)) {
    if (event === "page_view" && !config.trackPageViews) continue;
    if (event === "link_click" && !config.trackLinkClicks) continue;
    const id = normalizePixelId(config.provider, config.pixelId);
    if (event === "page_view") {
      const pageKey = `${config.provider}:${id}:${window.location.pathname}${window.location.search}`;
      const pageViews = w.__venyxPixelPageViews ?? new Set<string>();
      if (pageViews.has(pageKey)) continue;
      pageViews.add(pageKey);
      w.__venyxPixelPageViews = pageViews;
    }
    if (config.provider === "meta")
      w.fbq?.(
        event === "page_view" ? "track" : "trackCustom",
        event === "page_view" ? "PageView" : "FanliraLinkClick",
        payload,
      );
    else if (config.provider === "google_analytics" || config.provider === "google_ads")
      w.gtag?.("event", event === "page_view" ? "page_view" : "venyx_link_click", {
        ...payload,
        send_to: id,
      });
    else if (config.provider === "tiktok")
      w.ttq?.track?.(event === "page_view" ? "ViewContent" : "ClickButton", payload);
    else if (config.provider === "pinterest")
      w.pintrk?.("track", event === "page_view" ? "PageVisit" : "FanliraLinkClick", payload);
    else w.snaptr?.("track", event === "page_view" ? "PAGE_VIEW" : "CUSTOM_EVENT_1", payload);
    sent.push(config.provider);
  }
  return sent;
}

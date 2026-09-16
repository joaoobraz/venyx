export const COOKIE_CONSENT_STORAGE_KEY = "cookie-consent-v1";
export const COOKIE_CONSENT_CHANGED_EVENT = "venyx:cookie-consent-changed";
export const OPEN_COOKIE_SETTINGS_EVENT = "venyx:open-cookie-settings";

export type CookieConsentChoice = "all" | "essential";

export interface CookieConsentRecord {
  value: CookieConsentChoice;
  at: string;
  version: 2;
}

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentRecord>;
    if (parsed.value !== "all" && parsed.value !== "essential") return null;
    return {
      value: parsed.value,
      at: typeof parsed.at === "string" ? parsed.at : "",
      version: 2,
    };
  } catch {
    return null;
  }
}

export function hasMarketingConsent() {
  return readCookieConsent()?.value === "all";
}

export function saveCookieConsent(value: CookieConsentChoice) {
  const record: CookieConsentRecord = { value, at: new Date().toISOString(), version: 2 };
  if (typeof window === "undefined") return record;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Consent remains fail-closed when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: record }));
  return record;
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

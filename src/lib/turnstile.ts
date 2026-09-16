export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? "";

export function isTurnstileEnabled() {
  return TURNSTILE_SITE_KEY.length > 0;
}

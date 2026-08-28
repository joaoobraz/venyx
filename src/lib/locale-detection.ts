export type DetectedLocale = "pt-BR" | "en" | "es";

/** Resolve a first-visit language from the browser/device language list. */
export function localeFromBrowserLanguages(languages: readonly unknown[]): DetectedLocale {
  for (const language of languages) {
    // Browsers normally provide strings, but extensions and embedded webviews
    // can expose an incomplete language list. Ignore malformed entries instead
    // of crashing the entire application during the first render.
    if (typeof language !== "string") continue;
    const normalized = language.trim().toLowerCase();
    if (normalized.startsWith("pt")) return "pt-BR";
    if (normalized.startsWith("es")) return "es";
    if (normalized.startsWith("en")) return "en";
  }
  return "pt-BR";
}

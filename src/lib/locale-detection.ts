export type DetectedLocale = "pt-BR" | "en" | "es";

/** Resolve a first-visit language from the browser/device language list. */
export function localeFromBrowserLanguages(languages: readonly string[]): DetectedLocale {
  for (const language of languages) {
    const normalized = language.trim().toLowerCase();
    if (normalized.startsWith("pt")) return "pt-BR";
    if (normalized.startsWith("es")) return "es";
    if (normalized.startsWith("en")) return "en";
  }
  return "pt-BR";
}

import { useI18n } from "@/lib/i18n";
import { Globe } from "lucide-react";

const NEXT_LOCALE = {
  "pt-BR": "en",
  en: "es",
  es: "pt-BR",
} as const;

const LOCALE_LABEL = {
  "pt-BR": "PT",
  en: "EN",
  es: "ES",
} as const;

export function LangToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      onClick={() => setLocale(NEXT_LOCALE[locale])}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
      aria-label="Toggle language"
    >
      <Globe className="h-3.5 w-3.5" />
      {LOCALE_LABEL[locale]}
    </button>
  );
}

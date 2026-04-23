import { useI18n } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LangToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      onClick={() => setLocale(locale === "pt-BR" ? "en" : "pt-BR")}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
      aria-label="Toggle language"
    >
      <Globe className="h-3.5 w-3.5" />
      {locale === "pt-BR" ? "PT" : "EN"}
    </button>
  );
}

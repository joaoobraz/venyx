import { useI18n, type Locale } from "@/lib/i18n";
import { Globe } from "lucide-react";

const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "pt-BR", label: "PT" },
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
];

export function LangToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
      aria-label="Selecionar idioma"
    >
      <Globe className="h-3.5 w-3.5" />
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="cursor-pointer bg-transparent text-xs font-semibold text-foreground outline-none"
        aria-label="Selecionar idioma"
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

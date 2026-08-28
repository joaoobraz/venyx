import { useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { Check, ChevronDown, Globe } from "lucide-react";

const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "pt-BR", label: "PT" },
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
];

export function LangToggle() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <>
      <label
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary md:hidden"
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

      <div ref={menuRef} className="relative hidden md:block">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Selecionar idioma"
        >
          <Globe className="h-3.5 w-3.5" />
          {LOCALE_OPTIONS.find((option) => option.value === locale)?.label ?? "PT"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div
            role="listbox"
            className="absolute right-0 z-50 mt-2 w-28 overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-xl shadow-black/25"
          >
            {LOCALE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={locale === option.value}
                onClick={() => {
                  setLocale(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  locale === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-popover-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {option.label}
                {locale === option.value && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

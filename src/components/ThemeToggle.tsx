import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const opts: { value: Theme; label: string; icon: any }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "auto", label: "Auto", icon: Monitor },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex items-center rounded-full border border-border/60 bg-card/60 p-0.5"
    >
      {opts.map((o) => {
        const Icon = o.icon;
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            title={o.label}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

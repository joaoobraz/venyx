import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "auto";

interface ThemeCtx {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function applyTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (resolved === "dark") {
    html.classList.add("dark");
    html.classList.remove("light");
    html.style.colorScheme = "dark";
  } else {
    html.classList.add("light");
    html.classList.remove("dark");
    html.style.colorScheme = "light";
  }
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "auto") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = (typeof window !== "undefined" ? localStorage.getItem("theme") : null) as Theme | null;
    const initial: Theme = saved && ["light", "dark", "auto"].includes(saved) ? saved : "dark";
    setThemeState(initial);
    const r = resolve(initial);
    setResolved(r);
    applyTheme(r);
  }, []);

  useEffect(() => {
    if (theme !== "auto" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const r: "light" | "dark" = mq.matches ? "light" : "dark";
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") localStorage.setItem("theme", t);
    const r = resolve(t);
    setResolved(r);
    applyTheme(r);
  };

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

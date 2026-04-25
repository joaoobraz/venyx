import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cookie-consent-v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage indisponível (modo privado / SSR) — não exibe
    }
  }, []);

  function accept(value: "all" | "essential") {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ value, at: new Date().toISOString() }),
      );
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Usamos cookies essenciais para autenticação e funcionamento do site.
            Saiba mais na{" "}
            <Link to="/privacy" className="underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={() => accept("essential")}>
              Apenas essenciais
            </Button>
            <Button size="sm" onClick={() => accept("all")}>
              Aceitar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

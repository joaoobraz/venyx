import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  saveCookieConsent,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!readCookieConsent()) setVisible(true);
    } catch {
      // localStorage indisponível (modo privado / SSR) — não exibe
    }
    const open = () => setVisible(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  function accept(value: CookieConsentChoice) {
    const previous = readCookieConsent()?.value;
    saveCookieConsent(value);
    setVisible(false);
    if (previous === "all" && value === "essential") window.location.reload();
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
          <p className="text-sm leading-5 text-muted-foreground">
            Usamos cookies essenciais para o site funcionar. Com sua autorização, pixels de
            marketing podem medir visitas, cliques e campanhas nas páginas Venyx Links. Você pode
            recusar ou alterar essa escolha depois. Saiba mais na{" "}
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
              Aceitar marketing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

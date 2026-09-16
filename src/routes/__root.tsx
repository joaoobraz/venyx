import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { localizedPathname } from "@/lib/localized-paths";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { CookieBanner } from "@/components/CookieBanner";
import { ContentProtection } from "@/components/ContentProtection";
import { Toaster } from "@/components/ui/sonner";
import { ProductTelemetry } from "@/components/ProductTelemetry";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você abriu não existe ou foi removido.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Page not found · Página no encontrada</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fanlira — Plataforma de criadoras +18" },
      { name: "description", content: "Assine, troque mensagens e desbloqueie conteúdos exclusivos das suas criadoras favoritas na Fanlira." },
      { property: "og:title", content: "Fanlira — Plataforma de criadoras +18" },
      { property: "og:description", content: "Assine, troque mensagens e desbloqueie conteúdos exclusivos das suas criadoras favoritas na Fanlira." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Fanlira — Plataforma de criadoras +18" },
      { name: "twitter:description", content: "Assine, troque mensagens e desbloqueie conteúdos exclusivos das suas criadoras favoritas na Fanlira." },
      { property: "og:image", content: "/fanlira-social-card.svg" },
      { name: "twitter:image", content: "/fanlira-social-card.svg" },
      // Rótulo padrão de conteúdo adulto (RTA), lido por controles parentais.
      { name: "rating", content: "RTA-5042-1996-1400-1577-RTA" },
      { name: "rating", content: "adult" },
      // PWA: instalável na tela inicial (Android/desktop via manifest; iOS via meta).
      { name: "theme-color", content: "#17101a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Fanlira" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme')||'dark';var r=s==='auto'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):s;var h=document.documentElement;h.classList.remove('dark','light');h.classList.add(r);h.style.colorScheme=r;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <LocalizedUrlSync />
        <AuthProvider>
          <ProductTelemetry />
          <ContentProtection />
          <PwaSetup />
          <Outlet />
          <CookieBanner />
          <InstallAppPrompt />
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

// Registra o service worker (necessário para o navegador oferecer "Instalar").
function PwaSetup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

function LocalizedUrlSync() {
  const { locale } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const nextPath = localizedPathname(location.pathname, locale);
    if (nextPath === location.pathname) return;

    void navigate({
      to: nextPath as never,
      search: location.search as never,
      hash: location.hash,
      replace: true,
    });
  }, [locale, location.hash, location.pathname, location.search, navigate]);

  return null;
}

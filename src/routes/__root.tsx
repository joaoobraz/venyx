import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { CookieBanner } from "@/components/CookieBanner";
import { ContentProtection } from "@/components/ContentProtection";
import { Toaster } from "@/components/ui/sonner";
import { ProductTelemetry } from "@/components/ProductTelemetry";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
      { title: "Venyx — Plataforma de criadoras +18" },
      { name: "description", content: "Assine, troque mensagens e desbloqueie conteúdos exclusivos das suas criadoras favoritas na Venyx." },
      { property: "og:title", content: "Venyx — Plataforma de criadoras +18" },
      { property: "og:description", content: "Assine, troque mensagens e desbloqueie conteúdos exclusivos das suas criadoras favoritas na Venyx." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Venyx — Plataforma de criadoras +18" },
      { name: "twitter:description", content: "Assine, troque mensagens e desbloqueie conteúdos exclusivos das suas criadoras favoritas na Venyx." },
      { property: "og:image", content: "/venyx-social-card.svg" },
      { name: "twitter:image", content: "/venyx-social-card.svg" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
        <AuthProvider>
          <ProductTelemetry />
          <ContentProtection />
          <Outlet />
          <CookieBanner />
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

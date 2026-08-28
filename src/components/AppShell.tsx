import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, PauseCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { localizedPathname } from "@/lib/localized-paths";

export function AppShell({ children, withSidebar = true }: { children: ReactNode; withSidebar?: boolean }) {
  const { user, demoPreviewRole, accountPaused } = useAuth();
  const { t, tr, locale } = useI18n();
  const routeTo = (pathname: string) => localizedPathname(pathname, locale) as never;
  const activeLabel =
    demoPreviewRole === "creator"
      ? t("preview.creator")
      : demoPreviewRole === "admin"
        ? t("preview.moderator")
        : t("preview.client");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {user && demoPreviewRole && (
        <div className="border-b border-primary/20 bg-primary/5 px-3 py-2 sm:px-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs">
            <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
              <Eye className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">
                {t("preview.viewAs")}: <strong>{activeLabel}</strong>
              </span>
            </span>
            <Link to="/presentation/$section" params={{ section: "overview" }} className="shrink-0 font-semibold text-primary hover:underline">
              {t("preview.openPanel")}
            </Link>
          </div>
        </div>
      )}
      {user && accountPaused && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 sm:px-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs">
            <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
              <PauseCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="truncate">
                {tr(
                  "Conta pausada: perfil oculto e novas compras e mensagens bloqueadas.",
                  "Paused account: profile hidden and new purchases and messages blocked.",
                )}
              </span>
            </span>
            <Link to={routeTo("/settings/privacy")} className="shrink-0 font-semibold text-amber-700 hover:underline dark:text-amber-300">
              {tr("Reativar", "Reactivate")}
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-4 pb-24 sm:px-4 sm:py-6 lg:pb-6">
        {withSidebar && <Sidebar />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      {user && <MobileNav />}
    </div>
  );
}

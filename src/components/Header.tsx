import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, MessageCircle, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary shadow-glow" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            lust<span className="text-primary">.</span>
          </span>
        </Link>

        {user && (
          <div className="hidden flex-1 max-w-md md:block">
            <Link
              to="/search"
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary"
            >
              <Search className="h-4 w-4" />
              {t("nav.search")}
            </Link>
          </div>
        )}

        <div className="flex items-center gap-2">
          <LangToggle />
          {user ? (
            <>
              <Link
                to="/chat"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-card hover:text-primary"
                aria-label={t("nav.chat")}
              >
                <MessageCircle className="h-5 w-5" />
              </Link>
              <Link
                to="/notifications"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-card hover:text-primary"
                aria-label={t("nav.notifications")}
              >
                <Bell className="h-5 w-5" />
              </Link>
              {profile && (
                <Link
                  to="/profile/$username"
                  params={{ username: profile.username }}
                  className="ml-1 h-9 w-9 overflow-hidden rounded-full border border-border bg-card"
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                      {profile.username[0]?.toUpperCase()}
                    </div>
                  )}
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                {t("nav.logout")}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {t("nav.signup")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

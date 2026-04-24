import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, MessageCircle, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to={user ? "/feed" : "/"} className="group flex items-center gap-2.5">
          <div className="relative h-9 w-9 rounded-xl bg-gradient-primary shadow-glow transition-transform duration-300 group-hover:scale-105">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary-glow/40 to-transparent" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Ven<span className="text-gradient-gold italic">yx</span>
          </span>
        </Link>

        {user && (
          <div className="hidden flex-1 max-w-md md:block">
            <Link
              to="/search"
              className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:bg-card hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              {t("nav.search")}
            </Link>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
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

import { Link, useLocation } from "@tanstack/react-router";
import { Bell, Compass, Home, LayoutDashboard, MessageCircle, Settings, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useUnreadCounts } from "@/lib/use-unread-counts";

export function MobileNav() {
  const { profile, demoPreviewRole } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const unread = useUnreadCounts();

  const subscriberItems = [
    { to: "/feed", label: t("nav.feed"), icon: Home },
    { to: "/explore", label: t("nav.explore"), icon: Compass },
    { to: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { to: "/notifications", label: t("nav.notifications"), icon: Bell },
  ];
  const previewItems = [
    { to: "/presentation/overview", label: t("preview.openPanel"), icon: LayoutDashboard },
    { to: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { to: "/notifications", label: t("nav.notifications"), icon: Bell },
    { to: "/settings/profile", label: t("nav.settings"), icon: Settings },
  ];
  const items = demoPreviewRole && demoPreviewRole !== "subscriber" ? previewItems : subscriberItems;

  return (
    <nav
      aria-label={t("nav.mobile")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to === "/presentation/overview" && location.pathname.startsWith("/presentation/"));
          return (
            <Link
              key={to}
              to={to as never}
              aria-label={label}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {(to === "/chat" ? unread.messages : to === "/notifications" ? unread.notifications : 0) > 0 && (
                  <span className="absolute -right-2.5 -top-2 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground">
                    {Math.min(
                      9,
                      to === "/chat" ? unread.messages : unread.notifications,
                    )}
                    {(to === "/chat" ? unread.messages : unread.notifications) > 9 ? "+" : ""}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          );
        })}
        {profile ? (
          <Link
            to="/profile/$username"
            params={{ username: profile.username }}
            aria-label={t("nav.profile")}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
              location.pathname.startsWith("/profile/") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <User className="h-5 w-5" />
            <span>{t("nav.profile")}</span>
          </Link>
        ) : (
          <Link
            to="/login"
            aria-label={t("nav.login")}
            className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"
          >
            <User className="h-5 w-5" />
            <span>{t("nav.login")}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

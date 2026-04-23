import { Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Compass,
  MessageCircle,
  Bell,
  User as UserIcon,
  Settings,
  Wallet,
  ShieldCheck,
  PenSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";

export function Sidebar() {
  const { profile, isCreator, isAdmin } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();

  const items = [
    { to: "/feed", label: t("nav.feed"), icon: Home },
    { to: "/explore", label: t("nav.explore"), icon: Compass },
    { to: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { to: "/notifications", label: t("nav.notifications"), icon: Bell },
  ];

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <nav className="sticky top-20 space-y-1">
        {items.map((it) => {
          const active = loc.pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-card hover:text-primary"
              }`}
            >
              <Icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
        {profile && (
          <Link
            to="/profile/$username"
            params={{ username: profile.username }}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card hover:text-primary"
          >
            <UserIcon className="h-5 w-5" />
            {t("nav.profile")}
          </Link>
        )}
        {isCreator && (
          <>
            <Link
              to="/creator/posts"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card hover:text-primary"
            >
              <PenSquare className="h-5 w-5" />
              Novo post
            </Link>
            <Link
              to="/creator/wallet"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card hover:text-primary"
            >
              <Wallet className="h-5 w-5" />
              {t("nav.wallet")}
            </Link>
          </>
        )}
        <Link
          to="/settings/profile"
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card hover:text-primary"
        >
          <Settings className="h-5 w-5" />
          {t("nav.settings")}
        </Link>
        {isAdmin && (
          <Link
            to="/admin/kyc"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card hover:text-primary"
          >
            <ShieldCheck className="h-5 w-5" />
            Admin KYC
          </Link>
        )}
        <div className="pt-4">
          <BecomeCreatorBanner compact />
        </div>
      </nav>
    </aside>
  );
}

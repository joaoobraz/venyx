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
  Crown,
  Tag,
  Layers,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";

export function Sidebar() {
  const { profile, isCreator, isAdmin, isAmbassador } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();

  const items = [
    { to: "/feed", label: t("nav.feed"), icon: Home },
    { to: "/explore", label: t("nav.explore"), icon: Compass },
    { to: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { to: "/notifications", label: t("nav.notifications"), icon: Bell },
  ];

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-card hover:text-primary"
    }`;

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <nav className="sticky top-20 space-y-1">
        {items.map((it) => {
          const active = loc.pathname === it.to;
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} className={linkCls(active)}>
              <Icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
        {profile && (
          <Link
            to="/profile/$username"
            params={{ username: profile.username }}
            className={linkCls(false)}
          >
            <UserIcon className="h-5 w-5" />
            {t("nav.profile")}
          </Link>
        )}
        {isCreator && (
          <>
            <Link to="/creator/posts" className={linkCls(loc.pathname === "/creator/posts")}>
              <PenSquare className="h-5 w-5" /> Novo post
            </Link>
            <Link to="/creator/wallet" className={linkCls(loc.pathname === "/creator/wallet")}>
              <Wallet className="h-5 w-5" /> {t("nav.wallet")}
            </Link>
            <Link to="/creator/analytics" className={linkCls(loc.pathname === "/creator/analytics")}>
              <BarChart3 className="h-5 w-5" /> Analytics
            </Link>
            <Link to="/creator/subscription-plans" className={linkCls(loc.pathname === "/creator/subscription-plans")}>
              <Layers className="h-5 w-5" /> Planos
            </Link>
            <Link to="/creator/coupons" className={linkCls(loc.pathname === "/creator/coupons")}>
              <Tag className="h-5 w-5" /> Cupons
            </Link>
            <Link to="/creator/dmca" className={linkCls(loc.pathname === "/creator/dmca")}>
              <ShieldAlert className="h-5 w-5" /> DMCA
            </Link>
            {isAmbassador && (
              <Link to="/creator/affiliate" className={linkCls(loc.pathname === "/creator/affiliate")}>
                <Crown className="h-5 w-5 text-accent" /> Afiliado
              </Link>
            )}
          </>
        )}
        <Link to="/settings/profile" className={linkCls(loc.pathname === "/settings/profile")}>
          <Settings className="h-5 w-5" /> {t("nav.settings")}
        </Link>
        <Link to="/settings/security" className={linkCls(loc.pathname === "/settings/security")}>
          <ShieldCheck className="h-5 w-5" /> Segurança
        </Link>
        {isAdmin && (
          <>
            <Link to="/admin/kyc" className={linkCls(loc.pathname === "/admin/kyc")}>
              <ShieldCheck className="h-5 w-5" /> Admin KYC
            </Link>
            <Link to="/admin/dmca" className={linkCls(loc.pathname === "/admin/dmca")}>
              <ShieldAlert className="h-5 w-5" /> Admin DMCA
            </Link>
          </>
        )}
        <div className="pt-4">
          <BecomeCreatorBanner compact />
        </div>
      </nav>
    </aside>
  );
}

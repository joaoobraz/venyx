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
  Mail,
  Link2,
  UserCog,
  Banknote,
  Sparkles,
  Heart,
  Trophy,
  LayoutDashboard,
  ReceiptText,
  CircleDollarSign,
  ListChecks,
  HelpCircle,
  Database,
  Gift,
  Images,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";
import { useUnreadCounts } from "@/lib/use-unread-counts";

export function Sidebar() {
  const { profile, isCreator, isAdmin, isAmbassador, demoPreviewRole } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  const unread = useUnreadCounts();

  const subscriberItems = [
    { to: "/feed", search: undefined, label: t("nav.feed"), icon: Home },
    { to: "/explore", search: undefined, label: t("nav.explore"), icon: Compass },
    { to: "/chat", search: undefined, label: t("nav.chat"), icon: MessageCircle },
    { to: "/notifications", search: undefined, label: t("nav.notifications"), icon: Bell },
    { to: "/wishlist", search: undefined, label: t("nav.wishlist"), icon: Heart },
    { to: "/loyalty", search: undefined, label: t("nav.loyalty"), icon: Trophy },
  ];
  const creatorPreviewItems = [
    {
      to: "/presentation/overview",
      search: undefined,
      label: t("preview.openPanel"),
      icon: LayoutDashboard,
    },
    { to: "/presentation/posts", search: undefined, label: t("nav.newPost"), icon: PenSquare },
    { to: "/presentation/media-library", search: undefined, label: "Acervo", icon: Images },
    { to: "/presentation/analytics", search: undefined, label: "Analytics", icon: BarChart3 },
    { to: "/presentation/wallet", search: undefined, label: t("nav.wallet"), icon: Wallet },
    { to: "/presentation/subscriptions", search: undefined, label: t("nav.plans"), icon: Layers },
    { to: "/presentation/links", search: undefined, label: t("nav.linkTree"), icon: Link2 },
    { to: "/presentation/gifts", search: undefined, label: t("nav.gifts"), icon: Gift },
    { to: "/presentation/mailing", search: undefined, label: t("nav.mailing"), icon: Mail },
    { to: "/presentation/coupons", search: undefined, label: t("nav.coupons"), icon: Tag },
    { to: "/presentation/loyalty", search: undefined, label: t("nav.loyalty"), icon: Trophy },
    {
      to: "/presentation/moderation",
      search: undefined,
      label: t("nav.commentModeration"),
      icon: UserCog,
    },
  ];
  const moderatorPreviewItems = [
    {
      to: "/presentation/overview",
      search: undefined,
      label: t("preview.openPanel"),
      icon: LayoutDashboard,
    },
    {
      to: "/presentation/reports",
      search: undefined,
      label: t("preview.reports"),
      icon: ShieldAlert,
    },
    { to: "/presentation/users", search: undefined, label: t("preview.users"), icon: UserCog },
    { to: "/presentation/kyc", search: undefined, label: "KYC", icon: ShieldCheck },
    { to: "/presentation/dmca", search: undefined, label: "DMCA", icon: ShieldAlert },
    {
      to: "/presentation/reconciliation",
      search: undefined,
      label: "Conciliação PIX",
      icon: CircleDollarSign,
    },
    { to: "/presentation/audit", search: undefined, label: t("preview.audit"), icon: BarChart3 },
    {
      to: "/presentation/moderation",
      search: undefined,
      label: t("preview.moderation"),
      icon: ShieldCheck,
    },
  ];
  const items =
    demoPreviewRole === "creator"
      ? creatorPreviewItems
      : demoPreviewRole === "admin"
        ? moderatorPreviewItems
        : subscriberItems;

  const linkCls = (active: boolean) =>
    `group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_var(--primary)]"
        : "text-foreground/80 hover:bg-card/70 hover:text-primary hover:translate-x-0.5"
    }`;

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <nav className="sticky top-20 space-y-1">
        {items.map((it) => {
          const active = loc.pathname === it.to;
          const Icon = it.icon;
          return (
            <Link key={`${it.to}-${it.label}`} to={it.to as never} className={linkCls(active)}>
              <Icon className="h-5 w-5" />
              <span className="min-w-0 flex-1">{it.label}</span>
              {(it.to === "/chat"
                ? unread.messages
                : it.to === "/notifications"
                  ? unread.notifications
                  : 0) > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground">
                  {(it.to === "/chat" ? unread.messages : unread.notifications) > 99
                    ? "99+"
                    : it.to === "/chat"
                      ? unread.messages
                      : unread.notifications}
                </span>
              )}
            </Link>
          );
        })}
        {profile && demoPreviewRole !== "admin" && (
          <Link
            to="/profile/$username"
            params={{ username: profile.username }}
            className={linkCls(false)}
          >
            <UserIcon className="h-5 w-5" />
            {t("nav.profile")}
          </Link>
        )}
        {isCreator && !demoPreviewRole && (
          <>
            <Link
              to="/creator/onboarding"
              className={linkCls(loc.pathname === "/creator/onboarding")}
            >
              <ListChecks className="h-5 w-5" /> {t("nav.settings")}
            </Link>
            <Link to="/creator/posts" className={linkCls(loc.pathname === "/creator/posts")}>
              <PenSquare className="h-5 w-5" /> {t("nav.newPost")}
            </Link>
            <Link
              to="/creator/media-library"
              className={linkCls(loc.pathname === "/creator/media-library")}
            >
              <Images className="h-5 w-5" /> Acervo
            </Link>
            <Link to="/creator/wallet" className={linkCls(loc.pathname === "/creator/wallet")}>
              <Wallet className="h-5 w-5" /> {t("nav.wallet")}
            </Link>
            <Link
              to="/creator/analytics"
              className={linkCls(loc.pathname === "/creator/analytics")}
            >
              <BarChart3 className="h-5 w-5" /> Analytics
            </Link>
            <Link
              to="/creator/subscription-plans"
              className={linkCls(loc.pathname === "/creator/subscription-plans")}
            >
              <Layers className="h-5 w-5" /> {t("nav.plans")}
            </Link>
            <Link to="/creator/coupons" className={linkCls(loc.pathname === "/creator/coupons")}>
              <Tag className="h-5 w-5" /> {t("nav.coupons")}
            </Link>
            <Link to="/creator/upsells" className={linkCls(loc.pathname === "/creator/upsells")}>
              <Sparkles className="h-5 w-5" /> Bumps & Upsells
            </Link>
            <Link to="/creator/mailing" className={linkCls(loc.pathname === "/creator/mailing")}>
              <Mail className="h-5 w-5" /> {t("nav.mailing")}
            </Link>
            <Link to="/creator/loyalty" className={linkCls(loc.pathname === "/creator/loyalty")}>
              <Trophy className="h-5 w-5" /> {t("nav.topFans")}
            </Link>
            <Link to="/creator/links" className={linkCls(loc.pathname === "/creator/links")}>
              <Link2 className="h-5 w-5" /> {t("nav.linkTree")}
            </Link>
            <Link to="/creator/gifts" className={linkCls(loc.pathname === "/creator/gifts")}>
              <Gift className="h-5 w-5" /> {t("nav.gifts")}
            </Link>
            <Link to="/creator/dmca" className={linkCls(loc.pathname === "/creator/dmca")}>
              <ShieldAlert className="h-5 w-5" /> DMCA
            </Link>
            <Link
              to="/creator/moderation"
              className={linkCls(loc.pathname === "/creator/moderation")}
            >
              <UserCog className="h-5 w-5" /> {t("nav.commentModeration")}
            </Link>
            {isAmbassador && (
              <Link
                to="/creator/affiliate"
                className={linkCls(loc.pathname === "/creator/affiliate")}
              >
                <Crown className="h-5 w-5 text-accent" /> {t("nav.affiliate")}
              </Link>
            )}
          </>
        )}
        {isAdmin && !demoPreviewRole && (
          <Link to="/admin" className={linkCls(loc.pathname.startsWith("/admin"))}>
            <ShieldCheck className="h-5 w-5" /> {t("preview.moderator")}
          </Link>
        )}
        <Link to="/settings/profile" className={linkCls(loc.pathname === "/settings/profile")}>
          <Settings className="h-5 w-5" /> {t("nav.settings")}
        </Link>
        <Link to="/settings/payments" className={linkCls(loc.pathname === "/settings/payments")}>
          <ReceiptText className="h-5 w-5" /> {t("nav.payments")}
        </Link>
        <Link to="/settings/security" className={linkCls(loc.pathname === "/settings/security")}>
          <ShieldCheck className="h-5 w-5" /> {t("nav.security")}
        </Link>
        <Link to="/settings/privacy" className={linkCls(loc.pathname === "/settings/privacy")}>
          <Database className="h-5 w-5" /> Privacidade
        </Link>
        <Link to="/help" className={linkCls(loc.pathname === "/help")}>
          <HelpCircle className="h-5 w-5" /> Ajuda
        </Link>
        {!demoPreviewRole && (
          <div className="pt-4">
            <BecomeCreatorBanner compact />
          </div>
        )}
      </nav>
    </aside>
  );
}

import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  CircleDollarSign,
  Compass,
  Crown,
  Database,
  Eye,
  Gift,
  HelpCircle,
  Heart,
  History,
  Home,
  Images,
  Layers,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Mail,
  Megaphone,
  MessageCircle,
  PenSquare,
  ReceiptText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  Trophy,
  User as UserIcon,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { BecomeCreatorBanner } from "@/components/BecomeCreatorBanner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/lib/auth";
import { CLIENT_PROFILE_PREVIEW } from "@/lib/creator-profile-preview";
import { useI18n } from "@/lib/i18n";
import { resolveOwnProfileUsername } from "@/lib/profile-visibility";
import { useUnreadCounts } from "@/lib/use-unread-counts";

type NavItem = {
  id: string;
  to: string;
  label: string;
  icon: LucideIcon;
  activePath?: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export function Sidebar() {
  const { user, profile, isCreator, isAdmin, isAmbassador, demoPreviewRole } = useAuth();
  const { t, tr } = useI18n();
  const loc = useLocation();
  const unread = useUnreadCounts();
  const ownProfileUsername = resolveOwnProfileUsername({
    authenticatedUserId: user?.id,
    profileUserId: profile?.user_id,
    profileUsername: profile?.username,
    isCreator,
    demoPreviewRole,
  });
  const creatorDemo = demoPreviewRole === "creator";
  const creatorNavigation = creatorDemo || (isCreator && !demoPreviewRole);
  const clientNavigation =
    demoPreviewRole === "subscriber" || (!demoPreviewRole && !isCreator && !isAdmin);
  const creatorPrefix = creatorDemo ? "/presentation" : "/creator";

  const ownProfileItem = (preview = false): NavItem => ({
    id: preview ? "profile-preview" : "profile",
    to: ownProfileUsername ? "/profile/$username" : "/settings/profile",
    activePath: ownProfileUsername ? `/profile/${ownProfileUsername}` : "/settings/profile",
    params: ownProfileUsername ? { username: ownProfileUsername } : undefined,
    search: preview ? { preview: CLIENT_PROFILE_PREVIEW } : undefined,
    label: preview ? tr("Visualizar como cliente", "View as client") : t("nav.profile"),
    icon: preview ? Eye : UserIcon,
  });

  const creatorRoutes = {
    overview: creatorDemo ? "/presentation/overview" : "/creator/analytics",
    analytics: creatorDemo ? "/presentation/analytics" : "/creator/analytics",
    posts: "/creator/posts",
    media: `${creatorPrefix}/media-library`,
    wallet: `${creatorPrefix}/wallet`,
    plans: creatorDemo ? "/presentation/subscriptions" : "/creator/subscription-plans",
    links: `${creatorPrefix}/links`,
    gifts: `${creatorPrefix}/gifts`,
    mailing: `${creatorPrefix}/mailing`,
    coupons: `${creatorPrefix}/coupons`,
    loyalty: `${creatorPrefix}/loyalty`,
    moderation: `${creatorPrefix}/moderation`,
  };

  const creatorQuickItems: NavItem[] = [
    {
      id: "quick-overview",
      to: creatorRoutes.overview,
      label: tr("Visão geral", "Overview"),
      icon: LayoutDashboard,
    },
    {
      id: "quick-post",
      to: creatorRoutes.posts,
      label: t("nav.newPost"),
      icon: PenSquare,
    },
    { id: "quick-chat", to: "/chat", label: t("nav.chat"), icon: MessageCircle },
  ];

  const creatorGroups: NavGroup[] = [
    {
      id: "start",
      label: tr("Início", "Home"),
      icon: Home,
      items: [
        {
          id: "overview",
          to: creatorRoutes.overview,
          label: tr("Visão geral", "Overview"),
          icon: LayoutDashboard,
        },
        {
          id: "metrics",
          to: creatorRoutes.analytics,
          label: tr("Métricas", "Metrics"),
          icon: BarChart3,
        },
        {
          id: "recent-activity",
          to: "/notifications",
          label: tr("Atividades recentes", "Recent activity"),
          icon: Activity,
        },
      ],
    },
    {
      id: "content",
      label: tr("Conteúdo", "Content"),
      icon: Images,
      items: [
        {
          id: "posts",
          to: creatorRoutes.posts,
          label: tr("Publicações", "Posts"),
          icon: PenSquare,
        },
        { id: "media", to: creatorRoutes.media, label: tr("Acervo", "Library"), icon: Images },
        { id: "ppv", to: "/chat", label: "PPV", icon: LockKeyhole },
        {
          id: "mailing",
          to: creatorRoutes.mailing,
          label: t("nav.mailing"),
          icon: Mail,
        },
      ],
    },
    {
      id: "sales",
      label: tr("Assinaturas e vendas", "Subscriptions & sales"),
      icon: Layers,
      items: [
        { id: "plans", to: creatorRoutes.plans, label: t("nav.plans"), icon: Layers },
        { id: "coupons", to: creatorRoutes.coupons, label: t("nav.coupons"), icon: Tag },
        {
          id: "subscribers",
          to: creatorRoutes.plans,
          label: tr("Assinantes", "Subscribers"),
          icon: Users,
        },
        { id: "gifts", to: creatorRoutes.gifts, label: t("nav.gifts"), icon: Gift },
        { id: "loyalty", to: creatorRoutes.loyalty, label: t("nav.loyalty"), icon: Trophy },
        ...(!creatorDemo
          ? [
              {
                id: "upsells",
                to: "/creator/upsells",
                label: "Bumps & Upsells",
                icon: ShoppingBag,
              } satisfies NavItem,
            ]
          : []),
      ],
    },
    {
      id: "communication",
      label: tr("Comunicação", "Communication"),
      icon: MessageCircle,
      items: [
        { id: "chat", to: "/chat", label: t("nav.chat"), icon: MessageCircle },
        {
          id: "notifications",
          to: "/notifications",
          label: t("nav.notifications"),
          icon: Bell,
        },
        {
          ...ownProfileItem(true),
          id: "comments",
          label: tr("Comentários", "Comments"),
          icon: MessageCircle,
        },
        {
          id: "moderation",
          to: creatorRoutes.moderation,
          label: t("nav.commentModeration"),
          icon: UserCog,
        },
      ],
    },
    {
      id: "growth",
      label: tr("Crescimento", "Growth"),
      icon: Megaphone,
      items: [
        { id: "links", to: creatorRoutes.links, label: t("nav.linkTree"), icon: Link2 },
        {
          id: "origins",
          to: creatorRoutes.analytics,
          label: tr("Origem das visitas", "Visit sources"),
          icon: Compass,
        },
        {
          id: "campaigns",
          to: creatorRoutes.mailing,
          label: tr("Campanhas", "Campaigns"),
          icon: Megaphone,
        },
        {
          id: "reports",
          to: creatorRoutes.analytics,
          label: tr("Relatórios", "Reports"),
          icon: BarChart3,
        },
        ...(!creatorDemo && isAmbassador
          ? [
              {
                id: "affiliate",
                to: "/creator/affiliate",
                label: t("nav.affiliate"),
                icon: Crown,
              } satisfies NavItem,
            ]
          : []),
      ],
    },
    {
      id: "financial",
      label: tr("Financeiro", "Financial"),
      icon: Wallet,
      items: [
        {
          id: "balance",
          to: creatorRoutes.wallet,
          label: tr("Saldo", "Balance"),
          icon: Wallet,
        },
        {
          id: "withdrawals",
          to: creatorRoutes.wallet,
          label: tr("Saques", "Withdrawals"),
          icon: CircleDollarSign,
        },
        {
          id: "history",
          to: creatorRoutes.wallet,
          label: tr("Histórico financeiro", "Financial history"),
          icon: History,
        },
        {
          id: "payment-settings",
          to: "/settings/payments",
          label: t("nav.payments"),
          icon: ReceiptText,
        },
      ],
    },
    {
      id: "profile-group",
      label: tr("Perfil", "Profile"),
      icon: UserIcon,
      items: [
        {
          id: "edit-profile",
          to: creatorDemo ? "/settings/profile" : "/creator/onboarding",
          label: tr("Editar perfil", "Edit profile"),
          icon: UserIcon,
        },
        {
          id: "customization",
          to: "/settings/profile",
          label: tr("Personalização", "Customization"),
          icon: SlidersHorizontal,
        },
        ownProfileItem(true),
      ],
    },
    {
      id: "settings-group",
      label: t("nav.settings"),
      icon: Settings,
      items: [
        { id: "security", to: "/settings/security", label: t("nav.security"), icon: ShieldCheck },
        {
          id: "privacy",
          to: "/settings/privacy",
          label: tr("Privacidade", "Privacy"),
          icon: Database,
        },
        { id: "account", to: "/settings/profile", label: tr("Conta", "Account"), icon: Settings },
        ...(!creatorDemo
          ? [
              {
                id: "dmca",
                to: "/creator/dmca",
                label: "DMCA",
                icon: ShieldAlert,
              } satisfies NavItem,
            ]
          : []),
        { id: "help", to: "/help", label: tr("Ajuda", "Help"), icon: HelpCircle },
      ],
    },
  ];

  const clientQuickItems: NavItem[] = [
    { id: "client-quick-feed", to: "/feed", label: t("nav.feed"), icon: Home },
    {
      id: "client-quick-explore",
      to: "/explore",
      label: t("nav.explore"),
      icon: Compass,
    },
    {
      id: "client-quick-chat",
      to: "/chat",
      label: t("nav.chat"),
      icon: MessageCircle,
    },
  ];

  const clientGroups: NavGroup[] = [
    {
      id: "client-start",
      label: tr("Início", "Home"),
      icon: Home,
      items: [
        { id: "client-feed", to: "/feed", label: t("nav.feed"), icon: Home },
        { id: "client-explore", to: "/explore", label: t("nav.explore"), icon: Compass },
        { id: "client-wishlist", to: "/wishlist", label: t("nav.wishlist"), icon: Heart },
      ],
    },
    {
      id: "client-subscriptions",
      label: tr("Assinaturas e benefícios", "Subscriptions & benefits"),
      icon: Layers,
      items: [
        {
          id: "client-payments",
          to: "/settings/payments",
          label: tr("Pagamentos e assinaturas", "Payments & subscriptions"),
          icon: ReceiptText,
        },
        {
          id: "client-loyalty",
          to: "/loyalty",
          label: t("nav.loyalty"),
          icon: Trophy,
        },
      ],
    },
    {
      id: "client-communication",
      label: tr("Comunicação", "Communication"),
      icon: MessageCircle,
      items: [
        { id: "client-chat", to: "/chat", label: t("nav.chat"), icon: MessageCircle },
        {
          id: "client-notifications",
          to: "/notifications",
          label: t("nav.notifications"),
          icon: Bell,
        },
      ],
    },
    {
      id: "client-profile",
      label: tr("Perfil", "Profile"),
      icon: UserIcon,
      items: [
        ownProfileItem(),
        {
          id: "client-profile-edit",
          to: "/settings/profile",
          label: tr("Editar perfil", "Edit profile"),
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      id: "client-settings",
      label: t("nav.settings"),
      icon: Settings,
      items: [
        {
          id: "client-security",
          to: "/settings/security",
          label: t("nav.security"),
          icon: ShieldCheck,
        },
        {
          id: "client-privacy",
          to: "/settings/privacy",
          label: tr("Privacidade", "Privacy"),
          icon: Database,
        },
        {
          id: "client-help",
          to: "/help",
          label: tr("Ajuda", "Help"),
          icon: HelpCircle,
        },
      ],
    },
  ];

  const subscriberItems: NavItem[] = [
    { id: "feed", to: "/feed", label: t("nav.feed"), icon: Home },
    { id: "explore", to: "/explore", label: t("nav.explore"), icon: Compass },
    { id: "chat", to: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { id: "notifications", to: "/notifications", label: t("nav.notifications"), icon: Bell },
    { id: "wishlist", to: "/wishlist", label: t("nav.wishlist"), icon: Heart },
    { id: "loyalty", to: "/loyalty", label: t("nav.loyalty"), icon: Trophy },
  ];

  const moderatorItems: NavItem[] = [
    {
      id: "admin-overview",
      to: "/presentation/overview",
      label: t("preview.openPanel"),
      icon: LayoutDashboard,
    },
    {
      id: "admin-reports",
      to: "/presentation/reports",
      label: t("preview.reports"),
      icon: ShieldAlert,
    },
    { id: "admin-users", to: "/presentation/users", label: t("preview.users"), icon: UserCog },
    { id: "admin-kyc", to: "/presentation/kyc", label: "KYC", icon: ShieldCheck },
    { id: "admin-dmca", to: "/presentation/dmca", label: "DMCA", icon: ShieldAlert },
    {
      id: "admin-pix",
      to: "/presentation/reconciliation",
      label: tr("Conciliação PIX", "PIX reconciliation"),
      icon: CircleDollarSign,
    },
    { id: "admin-audit", to: "/presentation/audit", label: t("preview.audit"), icon: BarChart3 },
    {
      id: "admin-moderation",
      to: "/presentation/moderation",
      label: t("preview.moderation"),
      icon: ShieldCheck,
    },
  ];

  const isActive = (item: NavItem) => loc.pathname === (item.activePath ?? item.to);
  const linkCls = (active: boolean, nested = false) =>
    `group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${nested ? "pl-3 pr-2" : "px-4"} ${
      active
        ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_var(--primary)]"
        : "text-foreground/80 hover:translate-x-0.5 hover:bg-card/70 hover:text-primary"
    }`;

  const renderItem = (item: NavItem, nested = false, activeOverride?: boolean) => {
    const Icon = item.icon;
    const count =
      item.to === "/chat"
        ? unread.messages
        : item.to === "/notifications"
          ? unread.notifications
          : 0;
    return (
      <Link
        key={item.id}
        to={item.to as never}
        params={item.params as never}
        search={item.search as never}
        className={linkCls(activeOverride ?? isActive(item), nested)}
      >
        <Icon className={nested ? "h-4 w-4" : "h-5 w-5"} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {count > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    );
  };

  const flatItems = demoPreviewRole === "admin" ? moderatorItems : subscriberItems;
  const activeCreatorGroupId = creatorGroups.find((group) => group.items.some(isActive))?.id;
  const activeClientGroupId = clientGroups.find((group) => group.items.some(isActive))?.id;

  const renderGroupedNavigation = (
    quickItems: NavItem[],
    groups: NavGroup[],
    activeGroupId?: string,
  ) => (
    <>
      <p className="px-4 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {tr("Mais usados", "Most used")}
      </p>
      {quickItems.map((item) => renderItem(item))}
      <div className="my-3 border-t border-border/60" />
      <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {tr("Menu completo", "Full menu")}
      </p>
      <Accordion
        key={activeGroupId ?? "no-active-group"}
        type="single"
        collapsible
        defaultValue={activeGroupId}
        className="space-y-0.5"
      >
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const groupActive = group.id === activeGroupId;
          const activeItemId = group.items.find(isActive)?.id;
          return (
            <AccordionItem key={group.id} value={group.id} className="border-0">
              <AccordionTrigger
                className={`w-full gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:no-underline [&>svg]:ml-auto ${
                  groupActive
                    ? "bg-card text-primary"
                    : "text-foreground/80 hover:bg-card/70 hover:text-primary"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <GroupIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">{group.label}</span>
              </AccordionTrigger>
              <AccordionContent className="ml-6 space-y-0.5 border-l border-border/70 pb-1 pl-2">
                {group.items.map((item) =>
                  renderItem(item, true, groupActive && item.id === activeItemId),
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <nav className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-1 overflow-y-auto pr-1">
        {creatorNavigation ? (
          renderGroupedNavigation(creatorQuickItems, creatorGroups, activeCreatorGroupId)
        ) : clientNavigation ? (
          <>
            {renderGroupedNavigation(clientQuickItems, clientGroups, activeClientGroupId)}
            {!demoPreviewRole && (
              <div className="pt-4">
                <BecomeCreatorBanner compact />
              </div>
            )}
          </>
        ) : (
          <>
            {flatItems.map((item) => renderItem(item))}
            {ownProfileUsername && demoPreviewRole !== "admin" && renderItem(ownProfileItem())}
            {isAdmin &&
              !demoPreviewRole &&
              renderItem({
                id: "admin",
                to: "/admin",
                label: t("preview.moderator"),
                icon: ShieldCheck,
              })}
            {renderItem({
              id: "settings",
              to: "/settings/profile",
              label: t("nav.settings"),
              icon: Settings,
            })}
            {renderItem({
              id: "payments",
              to: "/settings/payments",
              label: t("nav.payments"),
              icon: ReceiptText,
            })}
            {renderItem({
              id: "security",
              to: "/settings/security",
              label: t("nav.security"),
              icon: ShieldCheck,
            })}
            {renderItem({
              id: "privacy",
              to: "/settings/privacy",
              label: tr("Privacidade", "Privacy"),
              icon: Database,
            })}
            {renderItem({ id: "help", to: "/help", label: tr("Ajuda", "Help"), icon: HelpCircle })}
            {!demoPreviewRole && !isCreator && !isAdmin && (
              <div className="pt-4">
                <BecomeCreatorBanner compact />
              </div>
            )}
          </>
        )}
      </nav>
    </aside>
  );
}

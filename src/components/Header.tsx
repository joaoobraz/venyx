import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Eye,
  Heart,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PenSquare,
  Search,
  Settings,
  ShieldCheck,
  ReceiptText,
  Trophy,
  Wallet,
} from "lucide-react";
import { useAuth, type DemoPreviewRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUnreadCounts } from "@/lib/use-unread-counts";

export function Header() {
  const {
    user,
    profile,
    signOut,
    isCreator,
    canUseDemoPreview,
    demoPreviewRole,
    setDemoPreviewRole,
  } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const unread = useUnreadCounts();
  const roleSelect = (className: string) => (
    <select
      value={demoPreviewRole ?? ""}
      onChange={(event) => {
        const role = (event.target.value || null) as DemoPreviewRole | null;
        setDemoPreviewRole(role);
        navigate({ to: role ? "/presentation" : "/feed" });
      }}
      className={className}
      aria-label={t("preview.viewAs")}
    >
      <option value="">{t("preview.realAccount")}</option>
      <option value="subscriber">{t("preview.client")}</option>
      <option value="creator">{t("preview.creator")}</option>
      <option value="admin">{t("preview.moderator")}</option>
    </select>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
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

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          {canUseDemoPreview && (
            <div className="hidden items-center gap-2 rounded-full border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-[11px] text-muted-foreground lg:flex">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">{t("preview.viewAs")}</span>
              {roleSelect(
                "rounded-full border-none bg-transparent text-xs font-semibold text-foreground outline-none",
              )}
            </div>
          )}
          <LangToggle />
          {user ? (
            <>
              <Link
                to="/search"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-card hover:text-primary md:hidden"
                aria-label={t("nav.search")}
              >
                <Search className="h-5 w-5" />
              </Link>
              <Link
                to="/chat"
                className="relative hidden rounded-full p-2 text-muted-foreground transition-colors hover:bg-card hover:text-primary md:inline-flex"
                aria-label={t("nav.chat")}
              >
                <MessageCircle className="h-5 w-5" />
                {unread.messages > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground">
                    {unread.messages > 9 ? "9+" : unread.messages}
                  </span>
                )}
              </Link>
              <Link
                to="/notifications"
                className="relative hidden rounded-full p-2 text-muted-foreground transition-colors hover:bg-card hover:text-primary md:inline-flex"
                aria-label={t("nav.notifications")}
              >
                <Bell className="h-5 w-5" />
                {unread.notifications > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground">
                    {unread.notifications > 9 ? "9+" : unread.notifications}
                  </span>
                )}
              </Link>
              {profile && (
                <Link
                  to="/profile/$username"
                  params={{ username: profile.username }}
                  className="ml-1 hidden h-9 w-9 overflow-hidden rounded-full border border-border bg-card md:block"
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
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
                className="hidden lg:inline-flex"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                {t("nav.logout")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("nav.menu")}>
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[75vh] w-64 overflow-y-auto">
                  <DropdownMenuLabel>{profile?.display_name || profile?.username || t("nav.account")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canUseDemoPreview && (
                    <>
                      <div className="space-y-2 px-2 py-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                          <Eye className="h-4 w-4 text-primary" />
                          {t("preview.viewAs")}
                        </div>
                        {roleSelect(
                          "w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none",
                        )}
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                          {t("preview.safety")}
                        </p>
                      </div>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {demoPreviewRole && (
                    <DropdownMenuItem asChild>
                      <Link to="/presentation">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {t("preview.openPanel")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/wishlist"><Heart className="mr-2 h-4 w-4" />{t("nav.wishlist")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/loyalty"><Trophy className="mr-2 h-4 w-4" />{t("nav.loyalty")}</Link>
                  </DropdownMenuItem>
                  {isCreator && !demoPreviewRole && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{t("nav.creatorArea")}</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link to="/creator/posts"><PenSquare className="mr-2 h-4 w-4" />{t("nav.newPost")}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/creator/wallet"><Wallet className="mr-2 h-4 w-4" />{t("nav.wallet")}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/creator/analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/creator/subscription-plans"><Layers className="mr-2 h-4 w-4" />{t("nav.plans")}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/creator/moderation"><ShieldCheck className="mr-2 h-4 w-4" />{t("nav.commentModeration")}</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings/profile"><Settings className="mr-2 h-4 w-4" />{t("nav.settings")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings/payments"><ReceiptText className="mr-2 h-4 w-4" />{t("nav.payments")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings/security"><ShieldCheck className="mr-2 h-4 w-4" />{t("nav.security")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      await signOut();
                      navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />{t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

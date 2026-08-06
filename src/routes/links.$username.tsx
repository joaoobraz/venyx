import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Instagram,
  Music2,
  Twitter,
  Youtube,
  Send,
  Globe,
  Gift,
  Heart,
  ShoppingBag,
  Crown,
  Pin,
  ExternalLink,
} from "lucide-react";
import { DEMO_MODE, getDemoCreator } from "@/lib/demo-creators";
import { normalizeCreatorLinkUrl } from "@/lib/creator-link-url";
import { recordPublicLinkEvent } from "@/lib/link-analytics";
import { withVenyxLinkAttribution } from "@/lib/visit-attribution";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  hasMarketingConsent,
  openCookieSettings,
} from "@/lib/cookie-consent";
import { initializeCreatorPixels, trackCreatorPixelEvent } from "@/lib/creator-pixels";
import {
  DEMO_LINKS_CHANGED_EVENT,
  demoLinkButtonRadius,
  demoLinkFontFamily,
  readDemoLinksState,
  recordDemoPageLinkClick,
  recordDemoLinksPageView,
  type DemoLinksState,
} from "@/lib/demo-links";

export const Route = createFileRoute("/links/$username")({
  component: PublicLinksPage,
});

interface LinkRow {
  id: string;
  kind?: "link" | "text";
  title: string;
  url: string;
  icon: string | null;
  is_featured: boolean;
}

interface PageRow {
  user_id: string;
  bio: string | null;
  theme: string;
  button_style: string;
  cover_url: string | null;
  avatar_url: string | null;
  show_avatar: boolean;
  is_published: boolean;
}

interface ProfileLite {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

function getIcon(id: string | null) {
  switch (id) {
    case "instagram":
      return Instagram;
    case "tiktok":
      return Music2;
    case "twitter":
      return Twitter;
    case "youtube":
      return Youtube;
    case "telegram":
      return Send;
    case "spotify":
      return Music2;
    case "venyx":
      return Crown;
    case "heart":
      return Heart;
    case "gift":
      return Gift;
    case "shopping":
      return ShoppingBag;
    default:
      return Globe;
  }
}

const THEMES: Record<
  string,
  { bg: string; text: string; btn: string; btnText: string; ring: string }
> = {
  champagne: {
    bg: "linear-gradient(160deg, #1a0e0a 0%, #2a1b14 60%, #3a2418 100%)",
    text: "#F8E9C8",
    btn: "rgba(232, 184, 109, 0.12)",
    btnText: "#F8E9C8",
    ring: "rgba(232, 184, 109, 0.45)",
  },
  midnight: {
    bg: "linear-gradient(160deg, #08050a 0%, #14081a 100%)",
    text: "#EADBF0",
    btn: "rgba(180, 160, 220, 0.10)",
    btnText: "#EADBF0",
    ring: "rgba(180, 160, 220, 0.4)",
  },
  rose: {
    bg: "linear-gradient(160deg, #2a0f1e 0%, #4a1a32 100%)",
    text: "#FFE0EE",
    btn: "rgba(255, 192, 215, 0.14)",
    btnText: "#FFE0EE",
    ring: "rgba(255, 192, 215, 0.5)",
  },
  minimal: {
    bg: "linear-gradient(160deg, #FAF6EE 0%, #F0E8D9 100%)",
    text: "#2A1A14",
    btn: "rgba(184, 137, 62, 0.10)",
    btnText: "#2A1A14",
    ring: "rgba(184, 137, 62, 0.4)",
  },
};

function buttonRadius(style: string) {
  switch (style) {
    case "pill":
      return "9999px";
    case "square":
      return "8px";
    case "outline":
      return "16px";
    default:
      return "20px";
  }
}

function safePublicLinkUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return normalizeCreatorLinkUrl(value);
}

function PublicLinksPage() {
  const { username } = Route.useParams();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [page, setPage] = useState<PageRow | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [demoLinksState, setDemoLinksState] = useState<DemoLinksState | null>(null);
  const [giftListPublished, setGiftListPublished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const demo = DEMO_MODE ? getDemoCreator(username) : null;
    if (demo) {
      const applyDemoLinks = (studio = readDemoLinksState()) => {
        if (cancelled) return;
        setDemoLinksState(studio);
        setProfile({
          ...demo,
          display_name: studio.page.title || demo.display_name,
          avatar_url: studio.page.avatarUrl || demo.avatar_url,
          bio: studio.page.description || demo.bio,
        });
        setPage({
          user_id: demo.user_id,
          bio: studio.page.description,
          theme: "custom",
          button_style: studio.page.buttonStyle,
          cover_url: studio.page.bannerUrl,
          avatar_url: studio.page.avatarUrl,
          show_avatar: studio.page.showAvatar,
          is_published: studio.page.isPublished,
        });
        setLinks(
          studio.links
            .filter((link) => link.active)
            .map((link) => ({
              id: link.id,
              kind: link.kind,
              title: link.title,
              url: link.url,
              icon: link.icon,
              is_featured: link.featured,
            })),
        );
        setGiftListPublished(false);
        setLoading(false);
      };
      const syncDemoLinks = () => applyDemoLinks();
      applyDemoLinks(recordDemoLinksPageView());
      window.addEventListener(DEMO_LINKS_CHANGED_EVENT, syncDemoLinks);
      return () => {
        cancelled = true;
        window.removeEventListener(DEMO_LINKS_CHANGED_EVENT, syncDemoLinks);
      };
    }

    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id,username,display_name,avatar_url,bio")
        .eq("username", username)
        .maybeSingle();
      if (!prof || cancelled) {
        setLoading(false);
        return;
      }
      setProfile(prof as ProfileLite);
      const [{ data: pg }, { data: lks }, { data: gifts }] = await Promise.all([
        supabase.from("creator_link_pages").select("*").eq("user_id", prof.user_id).maybeSingle(),
        supabase
          .from("creator_links")
          .select("id,title,url,icon,is_featured")
          .eq("user_id", prof.user_id)
          .eq("is_active", true)
          .order("position"),
        supabase
          .from("creator_gift_settings")
          .select("is_published")
          .eq("creator_id", prof.user_id)
          .eq("is_published", true)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setPage((pg as PageRow) ?? null);
      setLinks((lks as LinkRow[]) ?? []);
      setGiftListPublished(!!gifts);
      setLoading(false);
      if (pg) {
        recordPublicLinkEvent({ eventType: "view", creatorId: prof.user_id });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!demoLinksState) return;
    const activatePixels = () => {
      if (!hasMarketingConsent()) return;
      initializeCreatorPixels(demoLinksState.pixels);
      trackCreatorPixelEvent(demoLinksState.pixels, "page_view", {
        page_type: "venyx_links",
        creator_username: username,
      });
    };
    activatePixels();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, activatePixels);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, activatePixels);
  }, [demoLinksState, username]);

  const trackClick = (id: string, title: string, destination: string) => {
    if (!profile) return;
    if (demoLinksState && hasMarketingConsent()) {
      initializeCreatorPixels(demoLinksState.pixels);
      trackCreatorPixelEvent(demoLinksState.pixels, "link_click", {
        link_title: title,
        link_type: destination.startsWith("/") ? "venyx" : "external",
        creator_username: username,
      });
    }
    if (profile.user_id.startsWith("demo-")) {
      setDemoLinksState(recordDemoPageLinkClick(id));
      return;
    }
    recordPublicLinkEvent({ eventType: "click", creatorId: profile.user_id, linkId: id });
  };
  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "https://venyx.app";

  if (loading) {
    return (
      <div
        style={{
          background: "#1a0e0a",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#F8E9C8",
        }}
      >
        Carregando…
      </div>
    );
  }

  if (!profile || !page || !page.is_published) {
    return (
      <div
        style={{
          background: "#1a0e0a",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#F8E9C8",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700 }}>Página não encontrada</h1>
          <p style={{ marginTop: 8, opacity: 0.7 }}>
            Esta criadora ainda não publicou sua página de links.
          </p>
        </div>
      </div>
    );
  }

  const t = demoLinksState
    ? {
        bg: demoLinksState.page.backgroundColor,
        text: demoLinksState.page.textColor,
        btn: demoLinksState.page.buttonColor,
        btnText: demoLinksState.page.buttonTextColor,
        ring: demoLinksState.page.accentColor,
      }
    : (THEMES[page.theme] ?? THEMES.champagne);
  const radius = demoLinksState
    ? demoLinkButtonRadius(demoLinksState.page.buttonStyle)
    : buttonRadius(page.button_style);
  const isOutline = page.button_style === "outline";
  const fontFamily = demoLinksState
    ? demoLinkFontFamily(demoLinksState.page.font)
    : "Inter, ui-sans-serif, system-ui, sans-serif";

  return (
    <div
      style={{
        background: t.bg,
        minHeight: "100vh",
        color: t.text,
        padding: "48px 16px 80px",
        fontFamily,
      }}
    >
      <main
        style={{
          maxWidth: 520,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {page.cover_url && (
          <img
            src={page.cover_url}
            alt="Banner da página"
            style={{
              width: "100%",
              height: 180,
              borderRadius: 24,
              objectFit: "cover",
              border: `1px solid ${t.ring}`,
            }}
          />
        )}
        {page.show_avatar && (page.avatar_url || profile.avatar_url) && (
          <img
            src={page.avatar_url || profile.avatar_url || ""}
            alt=""
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${t.ring}`,
              boxShadow: `0 0 30px ${t.ring}`,
              marginTop: page.cover_url ? -72 : 0,
            }}
          />
        )}
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>
            {profile.display_name ?? `@${profile.username}`}
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>@{profile.username}</p>
          {(page.bio || profile.bio) && (
            <p
              style={{ fontSize: 15, marginTop: 12, opacity: 0.9, lineHeight: 1.5, maxWidth: 380 }}
            >
              {page.bio ?? profile.bio}
            </p>
          )}
        </div>

        <nav
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}
        >
          {giftListPublished && (
            <a
              href={withVenyxLinkAttribution(`/gifts/${profile.username}`, siteOrigin)}
              onClick={() =>
                trackClick(
                  `gift-list-${profile.username}`,
                  "Minha Lista de Mimos",
                  `/gifts/${profile.username}`,
                )
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: t.btn,
                color: t.btnText,
                border: `1.5px solid ${t.ring}`,
                borderRadius: radius,
                padding: "16px 20px",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 15,
                boxShadow: `0 8px 24px -6px ${t.ring}`,
              }}
            >
              <Heart size={20} fill="currentColor" />
              <span style={{ flex: 1 }}>Minha Lista de Mimos</span>
              <Pin size={16} fill="currentColor" />
            </a>
          )}
          {links.length === 0 && !giftListPublished && (
            <p style={{ textAlign: "center", opacity: 0.6, padding: 24 }}>Sem links ainda.</p>
          )}
          {links.map((l) => {
            if (l.kind === "text") {
              return (
                <p
                  key={l.id}
                  style={{
                    margin: "4px 18px",
                    textAlign: "center",
                    fontSize: 14,
                    lineHeight: 1.55,
                    opacity: 0.78,
                  }}
                >
                  {l.title}
                </p>
              );
            }
            const Icon = getIcon(l.icon);
            const safeUrl = safePublicLinkUrl(l.url);
            if (!safeUrl) return null;
            const attributedUrl = withVenyxLinkAttribution(safeUrl, siteOrigin);
            return (
              <a
                key={l.id}
                href={attributedUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackClick(l.id, l.title, l.url)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: isOutline ? "transparent" : t.btn,
                  color: t.btnText,
                  border: `1.5px solid ${l.is_featured ? t.ring : isOutline ? t.ring : "transparent"}`,
                  borderRadius: radius,
                  padding: "16px 20px",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 15,
                  transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
                  boxShadow: l.is_featured ? `0 8px 24px -6px ${t.ring}` : "none",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = `0 8px 28px -6px ${t.ring}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = l.is_featured
                    ? `0 8px 24px -6px ${t.ring}`
                    : "none";
                }}
              >
                <Icon size={20} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{l.title}</span>
                {l.is_featured && <Pin size={16} fill="currentColor" />}
                <ExternalLink size={14} style={{ opacity: 0.5 }} />
              </a>
            );
          })}
        </nav>

        <footer style={{ marginTop: 40, fontSize: 11, opacity: 0.6, textAlign: "center" }}>
          <div>
            feito com{" "}
            <a href="/" style={{ color: t.text, textDecoration: "underline", fontWeight: 600 }}>
              Venyx
            </a>
          </div>
          <button
            type="button"
            onClick={openCookieSettings}
            style={{
              marginTop: 10,
              padding: 0,
              border: 0,
              background: "transparent",
              color: t.text,
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Privacidade e cookies
          </button>
        </footer>
      </main>
    </div>
  );
}

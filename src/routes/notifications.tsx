import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AtSign,
  Bell,
  CheckCheck,
  DollarSign,
  Heart,
  MessageCircle,
  MessagesSquare,
  Reply,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";
import { notifyUnreadCountsChanged } from "@/lib/use-unread-counts";
import { DEMO_MODE } from "@/lib/demo-creators";
import {
  DEMO_NOTIFICATIONS_CHANGED_EVENT,
  markAllDemoNotificationsRead,
  markDemoNotificationRead,
  readDemoNotifications,
} from "@/lib/demo-notifications";

export const Route = createFileRoute("/notifications")({
  component: NotifPage,
});

type Notification = {
  id: string;
  type: string;
  title: string;
  title_en?: string;
  body: string | null;
  body_en?: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

function metadataString(notification: Notification, key: string) {
  const value = notification.metadata?.[key];
  return typeof value === "string" && value ? value : null;
}

function iconFor(type: string) {
  switch (type) {
    case "withdrawal":
      return Wallet;
    case "sale":
      return DollarSign;
    case "post_like":
      return Heart;
    case "post_comment":
      return MessageCircle;
    case "comment_reply":
      return Reply;
    case "comment_mention":
      return AtSign;
    case "chat_message":
      return MessagesSquare;
    default:
      return Bell;
  }
}

export function NotifPage() {
  const { user } = useAuth();
  const { t, tr, locale } = useI18n();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    if (DEMO_MODE) {
      setItems(readDemoNotifications(user.id));
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as Notification[];
    const chatNotifications = rows.filter(
      (notification) =>
        notification.type === "chat_message" && metadataString(notification, "thread_id"),
    );
    const threadIds = Array.from(
      new Set(chatNotifications.map((notification) => metadataString(notification, "thread_id")!)),
    );
    if (threadIds.length) {
      const { data: existingThreads, error } = await supabase
        .from("chat_threads")
        .select("id")
        .in("id", threadIds);
      if (!error) {
        const existingIds = new Set((existingThreads ?? []).map((thread) => thread.id));
        const staleIds = chatNotifications
          .filter((notification) => !existingIds.has(metadataString(notification, "thread_id")!))
          .map((notification) => notification.id);
        if (staleIds.length) {
          await supabase
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .in("id", staleIds);
          notifyUnreadCountsChanged();
          setItems(rows.filter((notification) => !staleIds.includes(notification.id)));
          setLoading(false);
          return;
        }
      }
    }
    setItems(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!DEMO_MODE) return;
    const onChange = () => load();
    window.addEventListener(DEMO_NOTIFICATIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DEMO_NOTIFICATIONS_CHANGED_EVENT, onChange);
  }, [load]);

  const markAllRead = async () => {
    if (!user) return;
    if (DEMO_MODE) {
      setItems(markAllDemoNotificationsRead(user.id));
      notifyUnreadCountsChanged();
      return;
    }
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    notifyUnreadCountsChanged();
    load();
  };

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = async (id: string) => {
    if (!user) return;
    if (DEMO_MODE) {
      setItems(markDemoNotificationRead(user.id, id));
      notifyUnreadCountsChanged();
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item,
      ),
    );
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    notifyUnreadCountsChanged();
  };

  const displayTitle = (notification: Notification) => {
    const actor =
      typeof notification.metadata?.actor_username === "string"
        ? notification.metadata.actor_username
        : null;
    if (!actor) return notification.title;
    switch (notification.type) {
      case "post_like":
        return tr(`@${actor} curtiu sua publicação`, `@${actor} liked your post`);
      case "post_comment":
        return tr(`@${actor} comentou na sua publicação`, `@${actor} commented on your post`);
      case "comment_reply":
        return tr(`@${actor} respondeu ao seu comentário`, `@${actor} replied to your comment`);
      case "comment_mention":
        return tr(`@${actor} mencionou você`, `@${actor} mentioned you`);
      case "chat_message":
        return tr(`Nova mensagem de @${actor}`, `New message from @${actor}`);
      default:
        return notification.title;
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Bell className="h-5 w-5 text-primary" /> {t("nav.notifications")}
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-4 w-4" />{" "}
              {tr("Marcar todas como lidas", "Mark all as read")}
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
            {tr("Sem notificações por enquanto.", "No notifications yet.")}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card">
            {items.map((n) => {
              const Icon = iconFor(n.type);
              const chatThreadId =
                n.type === "chat_message" ? metadataString(n, "thread_id") : null;
              const safeLink = n.link?.startsWith("/") ? n.link : null;
              const content = (
                <div
                  className={`flex items-start gap-3 border-b border-border p-4 last:border-0 ${
                    !n.read_at ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{displayTitle(n)}</p>
                    {(locale === "en" ? n.body_en ?? n.body : n.body) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {locale === "en" ? n.body_en ?? n.body : n.body}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), {
                      locale: locale === "en" ? enUS : ptBR,
                      addSuffix: false,
                    })}
                  </div>
                </div>
              );
              return chatThreadId ? (
                <Link
                  key={n.id}
                  to="/chat"
                  search={{ thread: chatThreadId }}
                  onClick={() => markRead(n.id)}
                >
                  {content}
                </Link>
              ) : safeLink ? (
                <Link key={n.id} to={safeLink as never} onClick={() => markRead(n.id)}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

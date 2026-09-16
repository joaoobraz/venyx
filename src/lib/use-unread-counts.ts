import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/demo-creators";
import { countDemoUnreadMessages } from "@/lib/demo-chat";
import { countDemoUnreadNotifications } from "@/lib/demo-notifications";

export function notifyUnreadCountsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("venyx:unread-counts-changed"));
  }
}

export function useUnreadCounts() {
  const { user, demoPreviewRole } = useAuth();
  const channelSuffix = useRef(Math.random().toString(36).slice(2));
  const [messages, setMessages] = useState(0);
  const [notifications, setNotifications] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      setMessages(0);
      setNotifications(0);
      return;
    }
    if (DEMO_MODE) {
      setMessages(
        countDemoUnreadMessages(
          user.id,
          demoPreviewRole === "creator" ? "creator" : "subscriber",
        ),
      );
      setNotifications(countDemoUnreadNotifications(user.id));
      return;
    }
    const [{ count: notificationCount }, { data: threadRows }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
      supabase.from("chat_threads").select("id").or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
    ]);
    const threadIds = (threadRows ?? []).map((thread) => thread.id);
    const { count: messageCount } = threadIds.length
      ? await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .in("thread_id", threadIds)
          .neq("sender_id", user.id)
          .is("read_at", null)
      : { count: 0 };
    setNotifications(notificationCount ?? 0);
    setMessages(messageCount ?? 0);
  }, [demoPreviewRole, user]);

  useEffect(() => {
    load();
    if (!user) return;
    if (DEMO_MODE) {
      const onLocalChange = () => load();
      window.addEventListener("venyx:unread-counts-changed", onLocalChange);
      return () => window.removeEventListener("venyx:unread-counts-changed", onLocalChange);
    }
    const channel = supabase
      .channel(`unread-counts-${user.id}-${channelSuffix.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        load,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, load)
      .subscribe();
    const onLocalChange = () => load();
    window.addEventListener("venyx:unread-counts-changed", onLocalChange);
    return () => {
      window.removeEventListener("venyx:unread-counts-changed", onLocalChange);
      supabase.removeChannel(channel);
    };
  }, [load, user]);

  return { messages, notifications, refresh: load };
}

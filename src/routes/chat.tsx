import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Search as SearchIcon,
  Send,
  DollarSign,
  Image as ImageIcon,
  Lock,
  Crown,
  Loader2,
  ArrowLeft,
  Check,
  Pencil,
  X,
  Gift,
  BadgeCheck,
  Clock3,
  PauseCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { createChatPpvPixCharge } from "@/_server/checkout.functions";
import { getChatMediaUrl } from "@/_server/media.functions";
import { editChatMessage, sendChatMessage } from "@/_server/chat.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TipModal } from "@/components/TipModal";
import { PixCheckoutModal, type PixCharge } from "@/components/PixCheckoutModal";
import { TranslateButton } from "@/components/TranslateButton";
import { detectExternalContact, contactBlockMessage } from "@/lib/contact-guard";
import { SafetyMenu } from "@/components/SafetyMenu";
import { DEMO_MODE } from "@/lib/demo-creators";
import { NotificationMuteButton } from "@/components/NotificationMuteButton";
import { notifyUnreadCountsChanged } from "@/lib/use-unread-counts";
import { moderateBeforeUpload } from "@/lib/moderation";
import {
  demoChatMediaPath,
  demoThreadDetails,
  isDemoChatThreadId,
  isDemoChatMediaPath,
  localizedDemoMessageBody,
  readDemoChatMediaUrl,
  readDemoChatMessages,
  saveDemoChatMedia,
  writeDemoChatMessages,
  type DemoChatMessage,
} from "@/lib/demo-chat";
import { recordDemoPurchase } from "@/lib/demo-operations";
import { addDemoNotification } from "@/lib/demo-notifications";
import { CreatorMediaLibrary } from "@/components/CreatorMediaLibrary";
import {
  importCreatorMediaFile,
  materializeCreatorMediaAsset,
  type CreatorMediaAsset,
} from "@/lib/media-library";
import { getDemoFanLoyalty } from "@/lib/demo-loyalty";
import { TIER_META, loyaltyTierFromPoints, loyaltyTierRank, type LoyaltyTier } from "@/lib/loyalty";

export type ChatSearch = { with?: string; thread?: string; segment?: "gold_plus" | "vip" };

export const chatSearchValidator = (search: Record<string, unknown>): ChatSearch => ({
    with: typeof search.with === "string" ? search.with : undefined,
    thread: typeof search.thread === "string" ? search.thread : undefined,
    segment:
      search.segment === "gold_plus" || search.segment === "vip" ? search.segment : undefined,
});

export const Route = createFileRoute("/chat")({
  validateSearch: chatSearchValidator,
  component: ChatPage,
});

interface Thread {
  id: string;
  actor_id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
  other_id: string;
  other_username: string;
  other_name: string;
  other_avatar: string | null;
  subscribed: boolean;
  last_preview: string;
  unread_count: number;
  is_demo: boolean;
  global_loyalty_tier?: LoyaltyTier | null;
  creator_loyalty_tier?: LoyaltyTier | null;
  creator_loyalty_points?: number;
  other_paused?: boolean;
}

type Message = DemoChatMessage;

function mergeMessages(...lists: Message[][]) {
  return Array.from(new Map(lists.flat().map((message) => [message.id, message])).values()).sort(
    (first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
  );
}

function giftAmountFromBody(body: string | null) {
  const value = body?.match(/enviou um mimo de R\$\s*([\d.,]+)/i)?.[1];
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed * 100) : null;
}

export function ChatPage() {
  const {
    with: requestedUserId,
    thread: requestedThreadId,
    segment: requestedSegment,
  } = useSearch({ strict: false }) as ChatSearch;
  const { user, session, loading, isCreator, demoPreviewRole, accountPaused } = useAuth();
  const { t, tr, locale } = useI18n();
  const nav = useNavigate();
  const unlockChatFn = useServerFn(createChatPpvPixCharge);
  const chatMediaFn = useServerFn(getChatMediaUrl);
  const sendMessageFn = useServerFn(sendChatMessage);
  const editMessageFn = useServerFn(editChatMessage);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [tipOpen, setTipOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ppvPrice, setPpvPrice] = useState("");
  const [ppvPriceDraft, setPpvPriceDraft] = useState("9.90");
  const [ppvMessage, setPpvMessage] = useState("");
  const [ppvMessageDraft, setPpvMessageDraft] = useState("");
  const [ppvPriceOpen, setPpvPriceOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [demoUnlockMessage, setDemoUnlockMessage] = useState<Message | null>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageEditDraft, setMessageEditDraft] = useState("");
  const deviceFileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const loadThreads = async () => {
    if (!user) return;
    if (DEMO_MODE) {
      const perspective = demoPreviewRole === "creator" ? "creator" : "subscriber";
      const presentationThreads: Thread[] = demoThreadDetails(user.id, perspective)
        .flatMap((item) => {
          const counterpart = perspective === "creator" ? item.lead : item.creator;
          if (!counterpart || !item.creator || !item.lastMessage) return [];
          const locallyBlocked =
            localStorage.getItem(`venyx:demo:block:${user.id}:${counterpart.user_id}`) === "1";
          if (locallyBlocked) return [];
          const fanLoyalty =
            perspective === "creator" ? getDemoFanLoyalty(user.id, item.lead.user_id) : null;
          return [
            {
              id: item.id,
              actor_id: item.actorId,
              user_a: item.creatorId,
              user_b: item.lead.user_id,
              last_message_at: item.lastMessage.created_at,
              other_id: counterpart.user_id,
              other_username: counterpart.username,
              other_name: counterpart.display_name,
              other_avatar: counterpart.avatar_url,
              subscribed: perspective === "creator" ? item.lead.subscribed : item.subscribed,
              last_preview:
                localizedDemoMessageBody(item.lastMessage, locale) ?? tr("Mídia", "Media"),
              unread_count: item.unreadCount,
              is_demo: true,
              global_loyalty_tier: fanLoyalty
                ? loyaltyTierFromPoints(fanLoyalty.globalPoints)
                : null,
              creator_loyalty_tier: fanLoyalty
                ? loyaltyTierFromPoints(fanLoyalty.creatorPoints)
                : null,
              creator_loyalty_points: fanLoyalty?.creatorPoints ?? 0,
              other_paused: false,
            },
          ];
        })
        .sort(
          (first, second) =>
            new Date(second.last_message_at).getTime() - new Date(first.last_message_at).getTime(),
        );
      if (requestedThreadId) {
        const requested = presentationThreads.find((thread) => thread.id === requestedThreadId);
        if (requested) setActiveId(requested.id);
      }
      setThreads(presentationThreads);
      return;
    }
    const { data: ths } = await supabase
      .from("chat_threads")
      .select("*")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    const list = (ths ?? []) as {
      id: string;
      user_a: string;
      user_b: string;
      last_message_at: string;
    }[];
    if (list.length === 0 && !requestedUserId && !requestedThreadId) {
      setThreads([]);
      return;
    }
    const { data: recentMessages } = list.length
      ? await supabase
          .from("chat_messages")
          .select("id, thread_id, sender_id, body, mime_type, read_at, created_at")
          .in(
            "thread_id",
            list.map((thread) => thread.id),
          )
          .order("created_at", { ascending: false })
          .limit(1000)
      : { data: [] };
    const lastByThread = new Map<
      string,
      {
        sender_id: string;
        body: string | null;
        mime_type: string | null;
        read_at: string | null;
        created_at: string;
      }
    >();
    const unreadByThread = new Map<string, number>();
    for (const message of recentMessages ?? []) {
      if (!lastByThread.has(message.thread_id)) {
        lastByThread.set(message.thread_id, message);
      }
      if (message.sender_id !== user.id && !message.read_at) {
        unreadByThread.set(message.thread_id, (unreadByThread.get(message.thread_id) ?? 0) + 1);
      }
    }
    const otherIds = Array.from(
      new Set([
        ...list.map((thread) => (thread.user_a === user.id ? thread.user_b : thread.user_a)),
        ...(requestedUserId ? [requestedUserId] : []),
      ]),
    );
    const [
      { data: profs },
      { data: subs },
      { data: blockRows },
      { data: localLoyaltyRows },
      { data: globalLoyaltyRows },
      { data: lifecycleRows },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", otherIds),
      isCreator
        ? supabase
            .from("subscriptions")
            .select("creator_id,subscriber_id")
            .eq("creator_id", user.id)
            .eq("status", "active")
        : supabase
            .from("subscriptions")
            .select("creator_id,subscriber_id")
            .eq("subscriber_id", user.id)
            .eq("status", "active"),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
      isCreator
        ? supabase
            .from("loyalty_points")
            .select("user_id,points,tier")
            .eq("creator_id", user.id)
            .in("user_id", otherIds)
        : Promise.resolve({ data: [] }),
      isCreator
        ? supabase
            .from("loyalty_global_points")
            .select("user_id,points,tier")
            .in("user_id", otherIds)
        : Promise.resolve({ data: [] }),
      (supabase as any)
        .from("account_lifecycle")
        .select("user_id,status")
        .in("user_id", otherIds)
        .eq("status", "paused"),
    ]);
    const profMap = new Map(
      (
        (profs ?? []) as {
          user_id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
        }[]
      ).map((p) => [p.user_id, p]),
    );
    const subSet = new Set(
      ((subs ?? []) as { creator_id: string; subscriber_id: string }[]).map((subscription) =>
        isCreator ? subscription.subscriber_id : subscription.creator_id,
      ),
    );
    const localLoyaltyMap = new Map(
      ((localLoyaltyRows ?? []) as { user_id: string; points: number; tier: string }[]).map(
        (row) => [row.user_id, row],
      ),
    );
    const globalLoyaltyMap = new Map(
      ((globalLoyaltyRows ?? []) as { user_id: string; points: number; tier: string }[]).map(
        (row) => [row.user_id, row],
      ),
    );
    const blockedSet = new Set(
      ((blockRows ?? []) as { blocked_id: string }[]).map((block) => block.blocked_id),
    );
    const pausedSet = new Set<string>(
      ((lifecycleRows ?? []) as { user_id: string }[]).map((row) => row.user_id),
    );
    let nextThreads: Thread[] = list
      .filter((thread) => {
        const otherId = thread.user_a === user.id ? thread.user_b : thread.user_a;
        return !blockedSet.has(otherId);
      })
      .map((t) => {
        const other_id = t.user_a === user.id ? t.user_b : t.user_a;
        const p = profMap.get(other_id);
        const localLoyalty = localLoyaltyMap.get(other_id);
        const globalLoyalty = globalLoyaltyMap.get(other_id);
        const lastMessage = lastByThread.get(t.id);
        const preview = lastMessage?.body?.trim()
          ? lastMessage.body.trim()
          : lastMessage?.mime_type?.startsWith("video/")
            ? tr("Vídeo", "Video")
            : lastMessage
              ? tr("Mídia", "Media")
              : `@${p?.username ?? "usuario"}`;
        return {
          id: t.id,
          actor_id: user.id,
          user_a: t.user_a,
          user_b: t.user_b,
          last_message_at: t.last_message_at,
          other_id,
          other_username: p?.username ?? "?",
          other_name: p?.display_name || p?.username || "?",
          other_avatar: p?.avatar_url ?? null,
          subscribed: subSet.has(other_id),
          last_preview: preview,
          unread_count: unreadByThread.get(t.id) ?? 0,
          is_demo: false,
          global_loyalty_tier: globalLoyalty?.tier as LoyaltyTier | undefined,
          creator_loyalty_tier: localLoyalty?.tier as LoyaltyTier | undefined,
          creator_loyalty_points: localLoyalty?.points ?? 0,
          other_paused: pausedSet.has(other_id),
        };
      });

    if (requestedUserId && requestedUserId !== user.id) {
      let requestedThread = nextThreads.find((thread) => thread.other_id === requestedUserId);
      if (!requestedThread && !blockedSet.has(requestedUserId)) {
        const [userA, userB] = [user.id, requestedUserId].sort();
        const { data: created, error } = await supabase
          .from("chat_threads")
          .insert({ user_a: userA, user_b: userB })
          .select("id, user_a, user_b, last_message_at")
          .single();
        if (!error && created) {
          const requestedProfile = profMap.get(requestedUserId);
          requestedThread = {
            id: created.id,
            actor_id: user.id,
            user_a: created.user_a,
            user_b: created.user_b,
            last_message_at: created.last_message_at,
            other_id: requestedUserId,
            other_username: requestedProfile?.username ?? "?",
            other_name: requestedProfile?.display_name || requestedProfile?.username || "?",
            other_avatar: requestedProfile?.avatar_url ?? null,
            subscribed: subSet.has(requestedUserId),
            last_preview: `@${requestedProfile?.username ?? "usuario"}`,
            unread_count: 0,
            is_demo: false,
            other_paused: pausedSet.has(requestedUserId),
          };
          nextThreads = [requestedThread, ...nextThreads];
        }
      }
      if (requestedThread) setActiveId(requestedThread.id);
    }
    if (requestedThreadId) {
      const requestedThread = nextThreads.find((thread) => thread.id === requestedThreadId);
      if (requestedThread) setActiveId(requestedThread.id);
    }
    setThreads(nextThreads);
  };

  const loadMessages = async (threadId: string) => {
    if (!user) return;
    if (DEMO_MODE && isDemoChatThreadId(threadId)) {
      const actorId = threads.find((thread) => thread.id === threadId)?.actor_id ?? user.id;
      const readAt = new Date().toISOString();
      const demoRows = readDemoChatMessages(user.id, threadId).map((message) =>
        message.sender_id !== actorId && !message.read_at
          ? { ...message, read_at: readAt }
          : message,
      );
      writeDemoChatMessages(user.id, threadId, demoRows);
      setMessages(demoRows);
      setThreads((current) =>
        current.map((thread) => (thread.id === threadId ? { ...thread, unread_count: 0 } : thread)),
      );
      notifyUnreadCountsChanged();
      return;
    }
    // Usa RPC segura: mascara media_path/mime_type para PPV não desbloqueado
    // ou subscribers_only sem assinatura ativa.
    const { data: msgs, error } = await supabase.rpc("list_thread_messages_verified", {
      _thread_id: threadId,
    });
    if (error) {
      console.error("[chat.loadMessages]", error);
      const missingVerifiedRpc =
        error.code === "PGRST202" || error.message.includes("list_thread_messages_verified");
      if (DEMO_MODE && missingVerifiedRpc) {
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from("chat_messages")
          .select(
            "id, thread_id, sender_id, body, ppv_price_cents, subscribers_only, read_at, created_at",
          )
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true });
        if (!fallbackError) {
          const safeMessages: Message[] = (fallbackRows ?? []).map((message) => ({
            ...message,
            media_path: null,
            mime_type: null,
            ppv_paid_at: null,
            unlocked: false,
            edited_at: null,
          }));
          setMessages(safeMessages);
          await supabase
            .from("chat_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("thread_id", threadId)
            .neq("sender_id", user.id)
            .is("read_at", null);
          setThreads((current) =>
            current.map((thread) =>
              thread.id === threadId ? { ...thread, unread_count: 0 } : thread,
            ),
          );
          notifyUnreadCountsChanged();
          return;
        }
      }
      toast.error(
        import.meta.env.DEV
          ? `${tr("Não foi possível carregar esta conversa", "Could not load this conversation")}: ${error.message}`
          : tr("Não foi possível carregar esta conversa.", "Could not load this conversation."),
      );
      return;
    }
    const messageIds = (msgs ?? []).map((message) => message.id);
    const { data: editRows } = messageIds.length
      ? await supabase.from("chat_messages").select("id, edited_at").in("id", messageIds)
      : { data: [] };
    const editedById = new Map((editRows ?? []).map((row) => [row.id, row.edited_at]));
    const persisted = (
      (msgs ?? []) as Array<Omit<Message, "unlocked" | "edited_at"> & { unlocked: boolean }>
    ).map((m) => ({
      ...m,
      unlocked: m.unlocked,
      edited_at: editedById.get(m.id) ?? null,
    }));
    setMessages(persisted);
    await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .neq("sender_id", user.id)
      .is("read_at", null);
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, unread_count: 0 } : thread)),
    );
    notifyUnreadCountsChanged();
  };

  useEffect(() => {
    if (user) loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, requestedUserId, requestedThreadId, demoPreviewRole]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () =>
        loadThreads(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (activeId) {
      setMessages([]);
      loadMessages(activeId);
    }
  }, [activeId]);

  useEffect(() => {
    if (!activeId || !user) return;
    if (DEMO_MODE && isDemoChatThreadId(activeId)) {
      setOtherOnline(activeId.endsWith("101"));
      setOtherTyping(false);
      activeChannelRef.current = null;
      return;
    }
    const otherId = threads.find((thread) => thread.id === activeId)?.other_id;
    if (!otherId) return;
    setOtherOnline(false);
    setOtherTyping(false);
    const ch = supabase
      .channel(`thread-${activeId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: user.id },
        },
      })
      .on("broadcast", { event: "new_message" }, () => {
        loadMessages(activeId);
        loadThreads();
      })
      .on("broadcast", { event: "message_updated" }, () => loadMessages(activeId))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if ((payload as { user_id?: string }).user_id === otherId) {
          setOtherTyping(Boolean((payload as { typing?: boolean }).typing));
        }
      })
      .on("presence", { event: "sync" }, () => {
        const presences = Object.values(ch.presenceState()).flat() as Array<{
          user_id?: string;
        }>;
        setOtherOnline(presences.some((presence) => presence.user_id === otherId));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });
    activeChannelRef.current = ch;
    return () => {
      activeChannelRef.current = null;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.id]);

  useEffect(() => {
    const channel = activeChannelRef.current;
    if (!channel || !activeId || !user) return;
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id, typing: Boolean(draft.trim()) },
    });
    typingTimerRef.current = window.setTimeout(() => {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: user.id, typing: false },
      });
    }, 1200);
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, [activeId, draft, user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const chatPaused = accountPaused || !!active?.other_paused;
  const canSetPpv = demoPreviewRole === "creator" || (!demoPreviewRole && isCreator);
  const dateLocale = locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR";

  const confirmTipInChat = () => {
    if (!active) return;
    void loadMessages(active.id);
    void loadThreads();
  };

  const send = async () => {
    if (!user || !active || !draft.trim() || busy) return;
    if (chatPaused) {
      toast.info(
        tr(
          "Esta conversa está somente para leitura enquanto uma das contas estiver pausada.",
          "This conversation is read-only while either account is paused.",
        ),
      );
      return;
    }
    const body = draft.trim();

    // Bloqueio anti-bypass: detectar telefone, WhatsApp, Telegram, redes sociais, etc.
    const detection = detectExternalContact(body);
    if (detection.blocked) {
      toast.error(contactBlockMessage(detection, locale), { duration: 6000 });
      if (!DEMO_MODE) {
        await supabase.from("moderation_logs").insert({
          user_id: user.id,
          surface: "chat",
          category: "contact_share",
          reason: detection.matches
            .map((m) => `${m.label}: ${m.sample}`)
            .join(" | ")
            .slice(0, 500),
        });
      }
      return;
    }

    if (DEMO_MODE && active.is_demo) {
      const demoMessage: Message = {
        id: crypto.randomUUID(),
        thread_id: active.id,
        sender_id: active.actor_id,
        body,
        media_path: null,
        mime_type: null,
        ppv_price_cents: 0,
        subscribers_only: false,
        unlocked: true,
        read_at: null,
        edited_at: null,
        created_at: new Date().toISOString(),
      };
      const stored = mergeMessages(readDemoChatMessages(user.id, active.id), [demoMessage]);
      writeDemoChatMessages(user.id, active.id, stored);
      setMessages(stored);
      setDraft("");
      setThreads((current) =>
        current
          .map((thread) =>
            thread.id === active.id
              ? {
                  ...thread,
                  last_message_at: demoMessage.created_at,
                  last_preview: body,
                  unread_count: 0,
                }
              : thread,
          )
          .sort(
            (first, second) =>
              new Date(second.last_message_at).getTime() -
              new Date(first.last_message_at).getTime(),
          ),
      );
      notifyUnreadCountsChanged();
      return;
    }

    setBusy(true);
    try {
      const headers = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : null;
      if (!headers) throw new Error(tr("Faça login novamente.", "Sign in again."));
      const result = await sendMessageFn({
        data: { threadId: active.id, body },
        headers,
      });
      setMessages((current) => mergeMessages(current, [result.message as Message]));
      setDraft("");
      setThreads((current) =>
        current
          .map((thread) =>
            thread.id === active.id
              ? {
                  ...thread,
                  last_message_at: result.message.created_at,
                  last_preview: body,
                  unread_count: 0,
                }
              : thread,
          )
          .sort(
            (first, second) =>
              new Date(second.last_message_at).getTime() -
              new Date(first.last_message_at).getTime(),
          ),
      );
      // Notifica o destinatário via broadcast (sem expor conteúdo)
      await activeChannelRef.current?.send({
        type: "broadcast",
        event: "new_message",
        payload: {},
      });
      await activeChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: user.id, typing: false },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const startMessageEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setMessageEditDraft(message.body ?? "");
  };

  const cancelMessageEdit = () => {
    setEditingMessageId(null);
    setMessageEditDraft("");
  };

  const saveMessageEdit = async (message: Message) => {
    const body = messageEditDraft.trim();
    if (!user || !active || !body || busy) return;
    const detection = detectExternalContact(body);
    if (detection.blocked) {
      toast.error(contactBlockMessage(detection, locale), { duration: 6000 });
      return;
    }
    if (DEMO_MODE && active.is_demo) {
      if (Date.now() - new Date(message.created_at).getTime() > 15 * 60_000) {
        toast.error(
          tr(
            "O prazo de 15 minutos para editar esta mensagem terminou.",
            "The 15-minute edit window has ended.",
          ),
        );
        return;
      }
      const editedAt = new Date().toISOString();
      const stored = readDemoChatMessages(user.id, active.id).map((item) =>
        item.id === message.id ? { ...item, body, edited_at: editedAt } : item,
      );
      writeDemoChatMessages(user.id, active.id, stored);
      setMessages(stored);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === active.id ? { ...thread, last_preview: body } : thread,
        ),
      );
      cancelMessageEdit();
      return;
    }
    setBusy(true);
    try {
      const headers = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : null;
      if (!headers) throw new Error(tr("Faça login novamente.", "Sign in again."));
      const result = await editMessageFn({
        data: { messageId: message.id, body },
        headers,
      });
      setMessages((current) => mergeMessages(current, [result.message as Message]));
      setThreads((current) =>
        current.map((thread) =>
          thread.id === active.id ? { ...thread, last_preview: body } : thread,
        ),
      );
      cancelMessageEdit();
      await activeChannelRef.current?.send({
        type: "broadcast",
        event: "message_updated",
        payload: {},
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const sendMediaFile = async (f: File) => {
    if (chatPaused) {
      toast.info(
        tr(
          "O envio de mídia fica bloqueado durante a pausa da conta.",
          "Media sending is blocked while the account is paused.",
        ),
      );
      return;
    }
    if (!user || !active) return;
    const parsedPpvPrice = Number(ppvPrice.replace(",", "."));
    const ppvCents = canSetPpv && ppvPrice ? Math.round(parsedPpvPrice * 100) : 0;
    const ppvBody = ppvCents > 0 ? ppvMessage.trim() : "";
    if (ppvPrice && (!Number.isFinite(ppvCents) || ppvCents < 100)) {
      toast.error(tr("O preço mínimo do PPV é R$ 1,00.", "Minimum PPV price is BRL 1.00."));
      return;
    }
    const ppvMessageDetection = detectExternalContact(ppvBody);
    if (ppvMessageDetection.blocked) {
      toast.error(contactBlockMessage(ppvMessageDetection, locale), { duration: 6000 });
      return;
    }
    if (active.is_demo) {
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
        toast.error(tr("Escolha uma imagem ou vídeo.", "Choose an image or video."));
        return;
      }
      if (f.size > 50 * 1024 * 1024) {
        toast.error(tr("O arquivo deve ter no máximo 50 MB.", "File must be at most 50 MB."));
        return;
      }
      setBusy(true);
      try {
        const messageId = crypto.randomUUID();
        await saveDemoChatMedia(messageId, f);
        if (ppvCents > 0) {
          await importCreatorMediaFile(user.id, f, {
            id: `chat-ppv-${messageId}`,
            category: "chat_ppv",
            sourceMessageId: messageId,
            title: `PPV enviado para ${active.other_name}`,
          });
        }
        const demoMessage: Message = {
          id: messageId,
          thread_id: active.id,
          sender_id: active.actor_id,
          body: ppvBody || null,
          media_path: demoChatMediaPath(messageId),
          mime_type: f.type,
          ppv_price_cents: ppvCents,
          ppv_paid_at: null,
          subscribers_only: false,
          unlocked: ppvCents === 0,
          read_at: null,
          edited_at: null,
          created_at: new Date().toISOString(),
        };
        const stored = mergeMessages(readDemoChatMessages(user.id, active.id), [demoMessage]);
        writeDemoChatMessages(user.id, active.id, stored);
        setMessages(stored);
        setMediaUrls((current) => ({ ...current, [messageId]: URL.createObjectURL(f) }));
        setThreads((current) =>
          current.map((thread) =>
            thread.id === active.id
              ? {
                  ...thread,
                  last_message_at: demoMessage.created_at,
                  last_preview: ppvCents
                    ? `${tr("Conteúdo PPV", "PPV content")} · R$ ${(ppvCents / 100).toFixed(2)}`
                    : tr("Mídia", "Media"),
                }
              : thread,
          ),
        );
        setPpvPrice("");
        setPpvMessage("");
        setPpvMessageDraft("");
        toast.success(
          ppvCents
            ? tr(
                `Mídia PPV enviada por R$ ${(ppvCents / 100).toFixed(2)}.`,
                `PPV media sent for BRL ${(ppvCents / 100).toFixed(2)}.`,
              )
            : tr("Mídia enviada.", "Media sent."),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : tr("Não foi possível salvar a mídia.", "Couldn't save the media."),
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const moderation = await moderateBeforeUpload(f, "chat", user.id);
      if (!moderation.allowed) {
        toast.error(
          moderation.reason ||
            tr("Não foi possível aprovar esta mídia.", "This media could not be approved."),
        );
        return;
      }
      const ext = f.name.split(".").pop() || "bin";
      const path = `${user.id}/${active.id}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage
        .from("chat-media")
        .upload(path, f, { contentType: f.type });
      if (ue) throw ue;
      const { error: ie } = await supabase.from("chat_messages").insert({
        thread_id: active.id,
        sender_id: user.id,
        media_path: path,
        mime_type: f.type,
        ppv_price_cents: ppvCents,
        body: ppvBody || null,
      });
      if (ie) throw ie;
      setPpvPrice("");
      setPpvMessage("");
      setPpvMessageDraft("");
      toast.success(
        ppvCents
          ? tr(
              `Mídia PPV enviada (R$ ${(ppvCents / 100).toFixed(2)})`,
              `PPV media sent (BRL ${(ppvCents / 100).toFixed(2)})`,
              `Medio PPV enviado (R$ ${(ppvCents / 100).toFixed(2)})`,
            )
          : tr("Mídia enviada", "Media sent", "Medio enviado"),
      );
      await supabase.channel(`thread-${active.id}`).send({
        type: "broadcast",
        event: "new_message",
        payload: {},
      });
      await loadMessages(active.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const chooseLibraryAsset = async (asset: CreatorMediaAsset) => {
    setMediaPickerOpen(false);
    setBusy(true);
    try {
      const file = await materializeCreatorMediaAsset(asset);
      await sendMediaFile(file);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível usar esta mídia.", "Couldn't use this media."),
      );
    } finally {
      setBusy(false);
    }
  };

  const chooseDeviceFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void sendMediaFile(file);
  };

  const unlock = async (m: Message) => {
    if (!user || !active) return;
    if (chatPaused) {
      toast.info(
        tr(
          "Compras ficam bloqueadas enquanto uma das contas estiver pausada.",
          "Purchases are blocked while either account is paused.",
        ),
      );
      return;
    }
    if (DEMO_MODE && active.is_demo) {
      setDemoUnlockMessage(m);
      return;
    }
    const headers = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
    if (!headers) {
      toast.error(tr("Faça login.", "Sign in."));
      return;
    }
    setBusy(true);
    try {
      const res = await unlockChatFn({ data: { messageId: m.id }, headers });
      if ("alreadyUnlocked" in res && res.alreadyUnlocked) {
        toast.success("Já desbloqueado");
        loadMessages(active.id);
        return;
      }
      if ("ok" in res && res.ok === false) {
        toast.error(res.error || "Não foi possível gerar o Pix.");
        return;
      }
      if ("chargeId" in res && res.chargeId) {
        setPixCharge({
          chargeId: res.chargeId,
          qrCode: res.qrCode ?? null,
          qrCodeBase64: res.qrCodeBase64 ?? null,
          amountCents: res.amountCents ?? m.ppv_price_cents,
        });
        setPixOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDemoUnlock = () => {
    if (!user || !active || !demoUnlockMessage) return;
    const paidAt = new Date().toISOString();
    const unlockedRows = readDemoChatMessages(user.id, active.id).map((message) =>
      message.id === demoUnlockMessage.id
        ? { ...message, unlocked: true, ppv_paid_at: paidAt }
        : message,
    );
    writeDemoChatMessages(user.id, active.id, unlockedRows);
    setMessages(unlockedRows);
    recordDemoPurchase({
      kind: "ppv",
      buyer_id: user.id,
      creator_id: demoUnlockMessage.sender_id,
      creator_name: active.other_name,
      reference_id: demoUnlockMessage.id,
      label: tr("PPV no chat", "Chat PPV"),
      amount_cents: demoUnlockMessage.ppv_price_cents,
    });
    addDemoNotification(user.id, {
      type: "sale",
      title: "Conteúdo do chat desbloqueado",
      title_en: "Chat content unlocked",
      body: `${active.other_name} · R$ ${(demoUnlockMessage.ppv_price_cents / 100).toFixed(2)}`,
      body_en: `${active.other_name} · BRL ${(demoUnlockMessage.ppv_price_cents / 100).toFixed(2)}`,
      link: `/chat?thread=${active.id}`,
      metadata: { message_id: demoUnlockMessage.id, thread_id: active.id },
    });
    setDemoUnlockMessage(null);
    toast.success(
      tr(
        "Pagamento demonstrativo confirmado. Mídia desbloqueada!",
        "Demo payment confirmed. Media unlocked!",
      ),
    );
  };

  // Buscar URLs assinadas para as mídias visíveis
  useEffect(() => {
    if (!user) return;
    const toFetch = messages.filter(
      (m) =>
        m.media_path &&
        !mediaUrls[m.id] &&
        (m.sender_id === active?.actor_id ||
          m.unlocked ||
          (m.subscribers_only && active?.subscribed)),
    );
    if (toFetch.length === 0) return;
    let cancel = false;
    Promise.all(
      toFetch.map(async (m) => {
        try {
          if (isDemoChatMediaPath(m.media_path)) {
            const url = await readDemoChatMediaUrl(m.id);
            return [m.id, url ?? ""] as const;
          }
          const headers = session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined;
          if (!headers) return [m.id, ""] as const;
          const r = await chatMediaFn({ data: { messageId: m.id }, headers });
          return [m.id, r.url] as const;
        } catch {
          return [m.id, ""] as const;
        }
      }),
    ).then((entries) => {
      if (cancel) return;
      setMediaUrls((prev) => {
        const next = { ...prev };
        entries.forEach(([id, url]) => {
          if (url) next[id] = url;
        });
        return next;
      });
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user, active]);

  const filtered = threads.filter((thread) => {
    const matchesQuery = query
      ? thread.other_name.toLowerCase().includes(query.toLowerCase())
      : true;
    if (!matchesQuery || !requestedSegment) return matchesQuery;
    const globalTier = thread.global_loyalty_tier ?? "bronze";
    return requestedSegment === "vip"
      ? globalTier === "vip"
      : loyaltyTierRank(globalTier) >= loyaltyTierRank("gold");
  });

  if (!user) return null;

  return (
    <AppShell withSidebar={false}>
      <div className="grid h-[calc(100dvh-9rem)] grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-border bg-card md:h-[calc(100vh-7rem)] md:grid-cols-[320px_1fr]">
        <aside
          className={`${active ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r border-border`}
        >
          <div className="border-b border-border p-3">
            {requestedSegment && canSetPpv && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] text-accent">
                <Crown className="h-3.5 w-3.5" />
                <span className="font-semibold">
                  {requestedSegment === "vip"
                    ? tr("Segmento: fãs VIP", "Segment: VIP fans")
                    : tr("Segmento: fãs Ouro+", "Segment: Gold+ fans")}
                </span>
                <Link to="/chat" className="ml-auto text-muted-foreground hover:text-foreground">
                  {tr("Limpar", "Clear")}
                </Link>
              </div>
            )}
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("chat.search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {t("chat.noConversations")}
              </div>
            ) : (
              filtered.map((th) => (
                <button
                  key={th.id}
                  onClick={() => {
                    setActiveId(th.id);
                    setThreads((current) =>
                      current.map((thread) =>
                        thread.id === th.id ? { ...thread, unread_count: 0 } : thread,
                      ),
                    );
                  }}
                  className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted ${
                    activeId === th.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="h-11 w-11 overflow-hidden rounded-full bg-muted">
                    {th.other_avatar ? (
                      <img src={th.other_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                        {th.other_username[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span className="truncate">{th.other_name}</span>
                      {canSetPpv && th.global_loyalty_tier && (
                        <span
                          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${TIER_META[th.global_loyalty_tier].bg} ${TIER_META[th.global_loyalty_tier].color}`}
                          title={`${tr("Nível Fanlira", "Fanlira tier")}: ${TIER_META[th.global_loyalty_tier].label}`}
                        >
                          {TIER_META[th.global_loyalty_tier].emoji}{" "}
                          {TIER_META[th.global_loyalty_tier].label}
                        </span>
                      )}
                    </div>
                    <div
                      className={`truncate text-xs ${
                        th.unread_count > 0
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {th.last_preview}
                    </div>
                  </div>
                  {th.unread_count > 0 && (
                    <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-bold leading-5 text-primary-foreground">
                      {th.unread_count > 99 ? "99+" : th.unread_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className={`${active ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
          {active ? (
            <>
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-2 md:hidden"
                  onClick={() => setActiveId(null)}
                  aria-label={t("common.back")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                  {active.other_avatar ? (
                    <img src={active.other_avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                      {active.other_username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {active.other_name}
                    {active.subscribed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Crown className="h-3 w-3" /> {t("chat.activeSubscriber")}
                      </span>
                    )}
                    {canSetPpv && active.global_loyalty_tier && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${TIER_META[active.global_loyalty_tier].bg} ${TIER_META[active.global_loyalty_tier].color}`}
                        title={tr(
                          "Nível geral calculado sem revelar gastos ou outras assinaturas",
                          "Global tier calculated without revealing spending or other subscriptions",
                        )}
                      >
                        Fanlira {TIER_META[active.global_loyalty_tier].emoji}{" "}
                        {TIER_META[active.global_loyalty_tier].label}
                      </span>
                    )}
                    {canSetPpv && active.creator_loyalty_tier && (
                      <span
                        className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold xl:inline-flex ${TIER_META[active.creator_loyalty_tier].bg} ${TIER_META[active.creator_loyalty_tier].color}`}
                      >
                        {TIER_META[active.creator_loyalty_tier].emoji}{" "}
                        {TIER_META[active.creator_loyalty_tier].label} {tr("com você", "with you")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>@{active.other_username}</span>
                    <span aria-hidden>·</span>
                    <span className={otherTyping || otherOnline ? "text-emerald-500" : ""}>
                      {otherTyping
                        ? tr("digitando…", "typing…")
                        : otherOnline
                          ? tr("online", "online")
                          : tr("offline", "offline")}
                    </span>
                  </div>
                </div>
                {!canSetPpv && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                    onClick={() => setTipOpen(true)}
                    aria-label={t("feed.tip")}
                  >
                    <DollarSign className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">{t("feed.tip")}</span>
                  </Button>
                )}
                <NotificationMuteButton targetType="thread" targetId={active.id} compact />
                <SafetyMenu
                  targetType="conversation"
                  targetId={active.id}
                  targetUserId={active.other_id}
                  targetLabel={`@${active.other_username}`}
                  onBlocked={() => {
                    setActiveId(null);
                    loadThreads();
                  }}
                />
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto bg-background/30 p-4">
                {messages.map((m) => {
                  const fromMe = m.sender_id === active.actor_id;
                  const isLockedMedia =
                    !fromMe &&
                    !m.unlocked &&
                    (m.ppv_price_cents > 0 || (m.subscribers_only && !active.subscribed));
                  // Auto-libera para assinantes ativos
                  const subUnlocked = m.subscribers_only && active.subscribed;
                  const showMedia = m.media_path && (fromMe || m.unlocked || subUnlocked);
                  const hasMediaCard = Boolean(m.media_path || isLockedMedia);
                  const giftAmountCents = m.gift_amount_cents ?? giftAmountFromBody(m.body);
                  const isGiftCard = m.message_kind === "gift" || giftAmountCents !== null;
                  const isPaidPpv =
                    m.ppv_price_cents > 0 &&
                    Boolean(m.ppv_paid_at || (active.is_demo && m.unlocked));
                  const formattedPpvPrice = new Intl.NumberFormat(
                    dateLocale,
                    { style: "currency", currency: "BRL" },
                  ).format(m.ppv_price_cents / 100);
                  const canEditMessage =
                    fromMe &&
                    Boolean(m.body) &&
                    !m.media_path &&
                    !isGiftCard &&
                    Date.now() - new Date(m.created_at).getTime() <= 15 * 60_000;
                  if (isGiftCard && giftAmountCents) {
                    const formattedGiftAmount = new Intl.NumberFormat(
                      dateLocale,
                      { style: "currency", currency: "BRL" },
                    ).format(giftAmountCents / 100);
                    return (
                      <div
                        key={m.id}
                        className="relative mx-auto my-3 w-full max-w-[460px] overflow-hidden rounded-2xl border border-amber-400/35 bg-card shadow-[0_12px_32px_-24px_rgba(245,158,11,0.6)]"
                      >
                        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-amber-300/10 blur-2xl" />
                        <div className="relative border-b border-amber-400/20 bg-gradient-to-r from-amber-500/16 via-primary/10 to-transparent px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-sm shadow-amber-500/15">
                              <Gift className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-500">
                                Fanlira Gifts
                              </div>
                              <div className="mt-0.5 text-base font-bold text-foreground">
                                {tr("Mimo confirmado", "Gift confirmed")}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-500">
                              <BadgeCheck className="h-3 w-3" />
                              {tr("Pago", "Paid")}
                            </div>
                          </div>
                        </div>
                        <div className="relative space-y-3 px-4 py-4">
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {tr("Valor enviado", "Amount sent")}
                            </div>
                            <div className="mt-0.5 text-2xl font-black tracking-tight text-amber-500">
                              {formattedGiftAmount}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                            <div className="text-[13px] font-semibold leading-relaxed text-foreground">
                              {m.body?.replace(/^🎁\s*/, "")}
                            </div>
                            {m.gift_message && (
                              <div className="mt-2 border-l-2 border-amber-400 pl-3 text-xs italic leading-relaxed text-muted-foreground">
                                “{m.gift_message}”
                              </div>
                            )}
                          </div>
                          <div className="-mt-1 text-right text-[10px] text-muted-foreground/70">
                            {new Date(m.created_at).toLocaleTimeString(
                              dateLocale,
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={m.id}
                      className={`${hasMediaCard ? "w-72 max-w-[78%]" : "max-w-[78%]"} overflow-hidden rounded-2xl shadow-card ${fromMe ? "ml-auto bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
                    >
                      {showMedia && m.media_path && (
                        <div className="relative">
                          {mediaUrls[m.id] ? (
                            m.mime_type?.startsWith("video/") ? (
                              <video
                                src={mediaUrls[m.id]}
                                controls
                                className="aspect-square w-72 max-w-full object-cover"
                              />
                            ) : (
                              <img
                                src={mediaUrls[m.id]}
                                alt=""
                                className="aspect-square w-72 max-w-full object-cover"
                              />
                            )
                          ) : (
                            <div className="flex aspect-square w-72 max-w-full items-center justify-center bg-muted">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          {fromMe && m.ppv_price_cents > 0 && (
                            <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
                              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-black/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300 shadow-sm backdrop-blur-sm">
                                <Lock className="h-3 w-3" />
                                PPV · {formattedPpvPrice}
                              </div>
                              <div
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide shadow-sm backdrop-blur-sm ${
                                  isPaidPpv
                                    ? "border-emerald-300/40 bg-emerald-950/85 text-emerald-300"
                                    : "border-amber-300/40 bg-black/80 text-amber-200"
                                }`}
                                title={
                                  isPaidPpv
                                    ? tr("Pagamento confirmado", "Payment confirmed")
                                    : tr(
                                        "Pagamento ainda não confirmado",
                                        "Payment not confirmed yet",
                                      )
                                }
                              >
                                {isPaidPpv ? (
                                  <BadgeCheck className="h-3 w-3" />
                                ) : (
                                  <Clock3 className="h-3 w-3" />
                                )}
                                {isPaidPpv
                                  ? tr("Pago", "Paid")
                                  : tr("Aguardando pagamento", "Awaiting payment")}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {isLockedMedia && (
                        <div className="relative">
                          <div className="aspect-square w-72 max-w-full bg-muted" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                            <Lock className="h-7 w-7 text-primary" />
                            {m.ppv_price_cents > 0 ? (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => unlock(m)}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                {busy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  `${t("feed.unlock")} R$ ${(m.ppv_price_cents / 100).toFixed(2)}`
                                )}
                              </Button>
                            ) : (
                              <span className="rounded-full bg-primary/90 px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                                {t("feed.subscribers")}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {m.body && editingMessageId === m.id ? (
                        <div className="flex items-center gap-1.5 px-3 py-2">
                          <Input
                            value={messageEditDraft}
                            onChange={(event) => setMessageEditDraft(event.target.value)}
                            maxLength={2000}
                            autoFocus
                            disabled={busy}
                            className="h-8 min-w-0 flex-1 bg-background text-foreground"
                            onKeyDown={(event) => {
                              if (event.key === "Escape") cancelMessageEdit();
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                saveMessageEdit(m);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => saveMessageEdit(m)}
                            disabled={busy || !messageEditDraft.trim()}
                            aria-label={tr("Salvar edição", "Save edit")}
                            className="rounded-full p-1.5 text-primary-foreground hover:bg-primary-foreground/10 disabled:opacity-40"
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={cancelMessageEdit}
                            aria-label={tr("Cancelar edição", "Cancel edit")}
                            className="rounded-full p-1.5 text-primary-foreground hover:bg-primary-foreground/10"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : m.body ? (
                        <div
                          data-user-content
                          className={`px-4 py-2 text-sm ${fromMe ? "" : "text-foreground"}`}
                        >
                          {m.id && isDemoChatThreadId(m.thread_id)
                            ? localizedDemoMessageBody(m, locale)
                            : m.body}
                        </div>
                      ) : null}
                      {m.body && !fromMe && editingMessageId !== m.id && (
                        <div className="px-4 pb-1">
                          <TranslateButton text={localizedDemoMessageBody(m, locale) ?? m.body} />
                        </div>
                      )}
                      <div
                        className={`flex items-center justify-end gap-1 px-3 pb-1.5 text-[10px] ${fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        <span>
                          {new Date(m.created_at).toLocaleTimeString(
                            dateLocale,
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                        {m.edited_at && <span>{tr("editada", "edited")}</span>}
                        {canEditMessage && editingMessageId !== m.id && (
                          <button
                            type="button"
                            onClick={() => startMessageEdit(m)}
                            title={tr("Editar mensagem", "Edit message")}
                            aria-label={tr("Editar mensagem", "Edit message")}
                            className="rounded-full p-0.5 hover:bg-primary-foreground/10"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {fromMe && (
                          <span
                            title={m.read_at ? tr("Lida", "Read") : tr("Enviada", "Sent")}
                            aria-label={
                              m.read_at
                                ? tr("Mensagem lida", "Message read")
                                : tr("Mensagem enviada", "Message sent")
                            }
                          >
                            {m.read_at ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <footer className="space-y-2 border-t border-border p-3">
                {chatPaused && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    <PauseCircle className="h-4 w-4 shrink-0" />
                    {accountPaused
                      ? tr(
                          "Sua conta está pausada. O histórico foi preservado, mas esta conversa está somente para leitura.",
                          "Your account is paused. History is preserved, but this conversation is read-only.",
                        )
                      : tr(
                          "Esta conta está pausada. Você ainda pode consultar o histórico, mas não pode enviar novas mensagens.",
                          "This account is paused. You can still read history, but cannot send new messages.",
                        )}
                  </div>
                )}
                {ppvPrice && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent">
                    🔒 {tr("Próxima mídia será PPV", "Next media will be PPV")}: R${" "}
                    {Number(ppvPrice.replace(",", ".") || "0").toFixed(2)}
                    {ppvMessage && (
                      <span className="max-w-[260px] truncate text-muted-foreground">
                        “{ppvMessage}”
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setMediaPickerOpen(true)}
                      className="rounded-full bg-accent px-2.5 py-1 font-semibold text-accent-foreground"
                    >
                      {tr("Escolher mídia", "Choose media")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPpvPrice("");
                        setPpvMessage("");
                        setPpvMessageDraft("");
                      }}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      aria-label={tr("Cancelar PPV", "Cancel PPV")}
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      canSetPpv ? setMediaPickerOpen(true) : deviceFileRef.current?.click()
                    }
                    disabled={busy || chatPaused}
                    className="rounded-full p-2 text-muted-foreground hover:text-primary disabled:opacity-40"
                    aria-label="media"
                    title={tr("Enviar foto ou vídeo", "Send photo or video")}
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  <input
                    ref={deviceFileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={chooseDeviceFile}
                  />
                  {canSetPpv && (
                    <button
                      type="button"
                      disabled={busy || chatPaused}
                      onClick={() => {
                        setPpvPriceDraft(ppvPrice || "9.90");
                        setPpvMessageDraft(ppvMessage);
                        setPpvPriceOpen(true);
                      }}
                      className={`rounded-full p-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        ppvPrice
                          ? "bg-accent/15 text-accent"
                          : "text-muted-foreground hover:text-accent"
                      }`}
                      aria-label={tr(
                        "Cobrar para desbloquear a próxima mídia (PPV)",
                        "Charge to unlock the next media (PPV)",
                      )}
                      title={tr(
                        "Conteúdo pago: defina o preço para desbloquear a próxima mídia",
                        "Paid content: set the price to unlock the next media",
                      )}
                    >
                      <Lock className="h-5 w-5" />
                    </button>
                  )}
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={
                      chatPaused
                        ? tr("Conta pausada — histórico somente para leitura", "Paused account — read-only history")
                        : t("chat.placeholder")
                    }
                    disabled={chatPaused}
                    className="h-10 flex-1"
                  />
                  <Button
                    onClick={send}
                    disabled={chatPaused || busy || !draft.trim() || detectExternalContact(draft).blocked}
                    aria-label={tr("Enviar mensagem", "Send message")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {draft.trim().length > 3 && detectExternalContact(draft).blocked && (
                  <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                    ⚠️{" "}
                    {tr(
                      "Compartilhar contato externo (WhatsApp, Telegram, telefone ou redes sociais) é proibido.",
                      "Sharing external contact details (WhatsApp, Telegram, phone or social media) is prohibited.",
                    )}
                  </div>
                )}
              </footer>

              <Dialog open={ppvPriceOpen} onOpenChange={setPpvPriceOpen}>
                <DialogContent className="w-[calc(100%-2rem)] max-w-md">
                  <DialogHeader>
                    <DialogTitle>{tr("Enviar mídia paga", "Send paid media")}</DialogTitle>
                    <DialogDescription>
                      {tr(
                        "Defina quanto o lead pagará. Depois escolha a foto ou o vídeo que ficará bloqueado.",
                        "Set the price the lead will pay, then choose the photo or video that will be locked.",
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <label className="block text-sm text-foreground">
                    {tr("Preço para desbloquear", "Unlock price")}
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        min="1"
                        step="0.10"
                        value={ppvPriceDraft}
                        onChange={(event) => setPpvPriceDraft(event.target.value)}
                        className="border-0 px-0 shadow-none focus-visible:ring-0"
                        aria-label={tr("Preço para desbloquear", "Unlock price")}
                        autoFocus
                      />
                    </div>
                  </label>
                  <label className="block text-sm text-foreground">
                    {tr("Mensagem do PPV (opcional)", "PPV message (optional)")}
                    <Textarea
                      value={ppvMessageDraft}
                      onChange={(event) => setPpvMessageDraft(event.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder={tr(
                        "Ex.: Preparei algo especial para você…",
                        "Example: I prepared something special for you…",
                      )}
                      className="mt-2 resize-none"
                      aria-label={tr("Mensagem opcional do PPV", "Optional PPV message")}
                    />
                    <span className="mt-1 block text-right text-[10px] text-muted-foreground">
                      {ppvMessageDraft.length}/500
                    </span>
                  </label>
                  {ppvMessageDraft.trim().length > 3 &&
                    detectExternalContact(ppvMessageDraft).blocked && (
                      <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {tr(
                          "A mensagem contém contato externo e não poderá ser enviada.",
                          "The message contains external contact details and cannot be sent.",
                        )}
                      </div>
                    )}
                  <div className="rounded-xl bg-accent/10 p-3 text-xs text-muted-foreground">
                    <strong className="text-accent">🔒 PPV</strong>{" "}
                    {tr(
                      "A mídia original só será liberada para o lead depois da confirmação do pagamento.",
                      "The original media is released to the lead only after payment is confirmed.",
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPpvPriceOpen(false)}>
                      {tr("Cancelar", "Cancel")}
                    </Button>
                    <Button
                      onClick={() => {
                        const parsed = Number(ppvPriceDraft.replace(",", "."));
                        if (!Number.isFinite(parsed) || parsed < 1) {
                          toast.error(
                            tr(
                              "O preço mínimo do PPV é R$ 1,00.",
                              "Minimum PPV price is BRL 1.00.",
                            ),
                          );
                          return;
                        }
                        const detection = detectExternalContact(ppvMessageDraft.trim());
                        if (detection.blocked) {
                          toast.error(contactBlockMessage(detection, locale), { duration: 6000 });
                          return;
                        }
                        setPpvPrice(parsed.toFixed(2));
                        setPpvMessage(ppvMessageDraft.trim());
                        setPpvPriceOpen(false);
                        setMediaPickerOpen(true);
                      }}
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {tr("Escolher foto ou vídeo", "Choose photo or video")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen}>
                <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {ppvPrice
                        ? tr("Escolher mídia para o PPV", "Choose media for the PPV")
                        : tr("Enviar foto ou vídeo", "Send photo or video")}
                    </DialogTitle>
                    <DialogDescription>
                      {ppvPrice
                        ? tr(
                            `Esta mídia será enviada como PPV por R$ ${Number(ppvPrice.replace(",", ".")).toFixed(2)}.`,
                            `This media will be sent as a PPV for BRL ${Number(ppvPrice.replace(",", ".")).toFixed(2)}.`,
                          )
                        : tr(
                            "Escolha algo já salvo no acervo ou importe do celular/computador.",
                            "Choose something from the library or import it from your device.",
                          )}
                    </DialogDescription>
                  </DialogHeader>
                  {user && (
                    <CreatorMediaLibrary
                      userId={user.id}
                      mode="pick"
                      onSelectAsset={(asset) => void chooseLibraryAsset(asset)}
                    />
                  )}
                </DialogContent>
              </Dialog>

              <Dialog
                open={Boolean(demoUnlockMessage)}
                onOpenChange={(open) => {
                  if (!open) setDemoUnlockMessage(null);
                }}
              >
                <DialogContent className="w-[calc(100%-2rem)] max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {tr("Desbloquear mídia do chat", "Unlock chat media")}
                    </DialogTitle>
                    <DialogDescription>
                      {tr(
                        "Pagamento demonstrativo: nenhum Pix ou cobrança real será criado.",
                        "Demo payment: no real Pix charge or payment will be created.",
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  {demoUnlockMessage && (
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-sm font-semibold text-foreground">
                        {active.other_name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {tr("Foto ou vídeo exclusivo no chat", "Exclusive photo or video in chat")}
                      </div>
                      <div className="mt-4 text-2xl font-bold text-primary">
                        R$ {(demoUnlockMessage.ppv_price_cents / 100).toFixed(2)}
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDemoUnlockMessage(null)}>
                      {tr("Cancelar", "Cancel")}
                    </Button>
                    <Button onClick={confirmDemoUnlock}>
                      {tr("Confirmar pagamento simulado", "Confirm demo payment")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {!canSetPpv && (
                <TipModal
                  open={tipOpen}
                  onOpenChange={setTipOpen}
                  creatorId={active.other_id}
                  creatorName={active.other_name}
                  onConfirmed={confirmTipInChat}
                />
              )}
              <PixCheckoutModal
                open={pixOpen}
                onOpenChange={setPixOpen}
                title={tr("Desbloquear mídia", "Unlock media")}
                charge={pixCharge}
                onPaid={() => {
                  setPixCharge(null);
                  if (active) loadMessages(active.id);
                }}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("chat.empty")}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, type ChangeEvent } from "react";
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
import { Button } from "@/components/ui/button";
import { TipModal } from "@/components/TipModal";
import { PixCheckoutModal, type PixCharge } from "@/components/PixCheckoutModal";
import { TranslateButton } from "@/components/TranslateButton";
import { detectExternalContact, contactBlockMessage } from "@/lib/contact-guard";
import { SafetyMenu } from "@/components/SafetyMenu";
import { DEMO_MODE, getDemoAsset } from "@/lib/demo-creators";
import { NotificationMuteButton } from "@/components/NotificationMuteButton";
import { notifyUnreadCountsChanged } from "@/lib/use-unread-counts";
import { moderateBeforeUpload } from "@/lib/moderation";
import {
  demoThreadDetails,
  isDemoChatThreadId,
  localizedDemoMessageBody,
  readDemoChatMessages,
  writeDemoChatMessages,
  type DemoChatMessage,
} from "@/lib/demo-chat";

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): { with?: string; thread?: string } => ({
    with: typeof search.with === "string" ? search.with : undefined,
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  component: ChatPage,
});

interface Thread {
  id: string;
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
}

type Message = DemoChatMessage;

function mergeMessages(...lists: Message[][]) {
  return Array.from(new Map(lists.flat().map((message) => [message.id, message])).values()).sort(
    (first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
  );
}

function ChatPage() {
  const { with: requestedUserId, thread: requestedThreadId } = Route.useSearch();
  const { user, session, loading } = useAuth();
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
  const [pixOpen, setPixOpen] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageEditDraft, setMessageEditDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const loadThreads = async () => {
    if (!user) return;
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
    if (list.length === 0 && !requestedUserId && !requestedThreadId && !DEMO_MODE) {
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
    const [{ data: profs }, { data: subs }, { data: blockRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", otherIds),
      supabase
        .from("subscriptions")
        .select("creator_id")
        .eq("subscriber_id", user.id)
        .eq("status", "active"),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
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
    const subSet = new Set(((subs ?? []) as { creator_id: string }[]).map((s) => s.creator_id));
    const blockedSet = new Set(
      ((blockRows ?? []) as { blocked_id: string }[]).map((block) => block.blocked_id),
    );
    let nextThreads = list
      .filter((thread) => {
        const otherId = thread.user_a === user.id ? thread.user_b : thread.user_a;
        const locallyBlocked =
          DEMO_MODE && localStorage.getItem(`venyx:demo:block:${user.id}:${otherId}`) === "1";
        return !blockedSet.has(otherId) && !locallyBlocked;
      })
      .map((t) => {
        const other_id = t.user_a === user.id ? t.user_b : t.user_a;
        const p = profMap.get(other_id);
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
          user_a: t.user_a,
          user_b: t.user_b,
          last_message_at: t.last_message_at,
          other_id,
          other_username: p?.username ?? "?",
          other_name: p?.display_name || p?.username || "?",
          other_avatar:
            DEMO_MODE && p?.username
              ? getDemoAsset(p.username).avatar_url
              : (p?.avatar_url ?? null),
          subscribed: subSet.has(other_id),
          last_preview: preview,
          unread_count: unreadByThread.get(t.id) ?? 0,
          is_demo: false,
        };
      });

    if (DEMO_MODE) {
      const demoThreads: Thread[] = demoThreadDetails(user.id).flatMap((demo) => {
        if (!demo.creator || !demo.lastMessage) return [];
        return [
          {
            id: demo.id,
            user_a: user.id,
            user_b: demo.creatorId,
            last_message_at: demo.lastMessage.created_at,
            other_id: demo.creatorId,
            other_username: demo.creator.username,
            other_name: demo.creator.display_name,
            other_avatar: demo.creator.avatar_url,
            subscribed: demo.subscribed,
            last_preview:
              localizedDemoMessageBody(demo.lastMessage, locale) ?? tr("Mídia", "Media"),
            unread_count: demo.unreadCount,
            is_demo: true,
          },
        ];
      });
      nextThreads = [...nextThreads, ...demoThreads].sort(
        (first, second) =>
          new Date(second.last_message_at).getTime() - new Date(first.last_message_at).getTime(),
      );
    }

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
            user_a: created.user_a,
            user_b: created.user_b,
            last_message_at: created.last_message_at,
            other_id: requestedUserId,
            other_username: requestedProfile?.username ?? "?",
            other_name: requestedProfile?.display_name || requestedProfile?.username || "?",
            other_avatar:
              DEMO_MODE && requestedProfile?.username
                ? getDemoAsset(requestedProfile.username).avatar_url
                : (requestedProfile?.avatar_url ?? null),
            subscribed: subSet.has(requestedUserId),
            last_preview: `@${requestedProfile?.username ?? "usuario"}`,
            unread_count: 0,
            is_demo: false,
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
      const readAt = new Date().toISOString();
      const demoRows = readDemoChatMessages(user.id, threadId).map((message) =>
        message.sender_id !== user.id && !message.read_at
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
  }, [user, requestedUserId, requestedThreadId]);

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

  const send = async () => {
    if (!user || !active || !draft.trim() || busy) return;
    const body = draft.trim();

    // Bloqueio anti-bypass: detectar telefone, WhatsApp, Telegram, redes sociais, etc.
    const detection = detectExternalContact(body);
    if (detection.blocked) {
      toast.error(contactBlockMessage(detection), { duration: 6000 });
      // registrar tentativa para auditoria do admin
      await supabase.from("moderation_logs").insert({
        user_id: user.id,
        surface: "chat",
        category: "contact_share",
        reason: detection.matches
          .map((m) => `${m.label}: ${m.sample}`)
          .join(" | ")
          .slice(0, 500),
      });
      return;
    }

    if (DEMO_MODE && active.is_demo) {
      const demoMessage: Message = {
        id: crypto.randomUUID(),
        thread_id: active.id,
        sender_id: user.id,
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
      toast.error(contactBlockMessage(detection), { duration: 6000 });
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

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user || !active) return;
    const f = e.target.files?.[0];
    if (!f) return;
    if (active.is_demo) {
      toast.info(
        tr(
          "O envio de mídia real fica desativado nesta conversa de demonstração.",
          "Real media uploads are disabled in this demo conversation.",
        ),
      );
      e.target.value = "";
      return;
    }
    const ppvCents = ppvPrice ? Math.round(parseFloat(ppvPrice) * 100) : 0;
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
      });
      if (ie) throw ie;
      setPpvPrice("");
      toast.success(
        ppvCents ? `Mídia PPV enviada (R$ ${(ppvCents / 100).toFixed(2)})` : "Mídia enviada",
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
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const unlock = async (m: Message) => {
    if (!user || !active) return;
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

  // Buscar URLs assinadas para as mídias visíveis
  useEffect(() => {
    if (!user) return;
    const toFetch = messages.filter(
      (m) =>
        m.media_path &&
        !mediaUrls[m.id] &&
        (m.sender_id === user.id || m.unlocked || (m.subscribers_only && active?.subscribed)),
    );
    if (toFetch.length === 0) return;
    let cancel = false;
    Promise.all(
      toFetch.map(async (m) => {
        try {
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

  const filtered = threads.filter((t) =>
    query ? t.other_name.toLowerCase().includes(query.toLowerCase()) : true,
  );

  if (!user) return null;

  return (
    <AppShell withSidebar={false}>
      <div className="grid h-[calc(100dvh-9rem)] grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-border bg-card md:h-[calc(100vh-7rem)] md:grid-cols-[320px_1fr]">
        <aside
          className={`${active ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r border-border`}
        >
          <div className="border-b border-border p-3">
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
                      {th.is_demo && (
                        <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                          {tr("Demo", "Demo")}
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
                    {active.is_demo && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        {tr("Demonstração", "Demo")}
                      </span>
                    )}
                    {active.subscribed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Crown className="h-3 w-3" /> {t("chat.activeSubscriber")}
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
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  disabled={active.is_demo}
                  title={
                    active.is_demo
                      ? tr("Indisponível na demonstração", "Unavailable in the demo")
                      : undefined
                  }
                  onClick={() => setTipOpen(true)}
                >
                  <DollarSign className="mr-1 h-3.5 w-3.5" /> {t("feed.tip")}
                </Button>
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
                {active.is_demo && (
                  <div className="mx-auto mb-3 max-w-lg rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-center text-[11px] text-muted-foreground">
                    {tr(
                      "Conversa fictícia para demonstrar envio, leitura e edição. Ela fica salva somente neste navegador.",
                      "Fictional conversation demonstrating send, read and edit states. It is stored only in this browser.",
                    )}
                  </div>
                )}
                {messages.map((m) => {
                  const fromMe = m.sender_id === user.id;
                  const isLockedMedia =
                    m.media_path &&
                    !m.unlocked &&
                    (m.ppv_price_cents > 0 || (m.subscribers_only && !active.subscribed));
                  // Auto-libera para assinantes ativos
                  const subUnlocked = m.subscribers_only && active.subscribed;
                  const showMedia = m.media_path && (m.unlocked || subUnlocked);
                  const canEditMessage =
                    fromMe &&
                    Boolean(m.body) &&
                    !m.media_path &&
                    Date.now() - new Date(m.created_at).getTime() <= 15 * 60_000;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[78%] overflow-hidden rounded-2xl shadow-card ${fromMe ? "ml-auto bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
                    >
                      {showMedia &&
                        m.media_path &&
                        (mediaUrls[m.id] ? (
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
                        ))}
                      {isLockedMedia && m.media_path && (
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
                            locale === "en" ? "en-US" : "pt-BR",
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
                {ppvPrice && (
                  <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent">
                    🔒 {tr("Próxima mídia será PPV", "Next media will be PPV")}: R${" "}
                    {parseFloat(ppvPrice || "0").toFixed(2)}
                    <button
                      onClick={() => setPpvPrice("")}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={active.is_demo}
                    className="rounded-full p-2 text-muted-foreground hover:text-primary"
                    aria-label="media"
                    title={
                      active.is_demo
                        ? tr("Indisponível na demonstração", "Unavailable in the demo")
                        : undefined
                    }
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={onFile}
                  />
                  <button
                    type="button"
                    disabled={active.is_demo}
                    onClick={() => {
                      const v = prompt(
                        tr(
                          "Preço PPV em R$ (ou cancele para mídia grátis):",
                          "PPV price in R$ (or cancel for free media):",
                        ),
                        "9.90",
                      );
                      if (v) setPpvPrice(v);
                    }}
                    className="rounded-full p-2 text-muted-foreground hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="ppv"
                    title={tr(
                      "Definir preço PPV para próxima mídia",
                      "Set PPV price for next media",
                    )}
                  >
                    <Lock className="h-5 w-5" />
                  </button>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={t("chat.placeholder")}
                    className="h-10 flex-1"
                  />
                  <Button
                    onClick={send}
                    disabled={busy || !draft.trim() || detectExternalContact(draft).blocked}
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

              <TipModal
                open={tipOpen}
                onOpenChange={setTipOpen}
                creatorId={active.other_id}
                creatorName={active.other_name}
              />
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

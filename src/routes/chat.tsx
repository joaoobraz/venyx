import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { Search as SearchIcon, Send, DollarSign, Image as ImageIcon, Lock, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TipModal } from "@/components/TipModal";
import { TranslateButton } from "@/components/TranslateButton";
import { detectExternalContact, contactBlockMessage } from "@/lib/contact-guard";

export const Route = createFileRoute("/chat")({
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
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  media_path: string | null;
  mime_type: string | null;
  ppv_price_cents: number;
  subscribers_only: boolean;
  unlocked: boolean;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function chatMediaUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/chat-media/${path}`;
}

function ChatPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [tipOpen, setTipOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ppvPrice, setPpvPrice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
    const list = (ths ?? []) as { id: string; user_a: string; user_b: string; last_message_at: string }[];
    if (list.length === 0) {
      setThreads([]);
      return;
    }
    const otherIds = list.map((t) => (t.user_a === user.id ? t.user_b : t.user_a));
    const [{ data: profs }, { data: subs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", otherIds),
      supabase
        .from("subscriptions")
        .select("creator_id")
        .eq("subscriber_id", user.id)
        .eq("status", "active"),
    ]);
    const profMap = new Map(
      ((profs ?? []) as { user_id: string; username: string; display_name: string | null; avatar_url: string | null }[]).map(
        (p) => [p.user_id, p],
      ),
    );
    const subSet = new Set(((subs ?? []) as { creator_id: string }[]).map((s) => s.creator_id));
    setThreads(
      list.map((t) => {
        const other_id = t.user_a === user.id ? t.user_b : t.user_a;
        const p = profMap.get(other_id);
        return {
          id: t.id,
          user_a: t.user_a,
          user_b: t.user_b,
          last_message_at: t.last_message_at,
          other_id,
          other_username: p?.username ?? "?",
          other_name: p?.display_name || p?.username || "?",
          other_avatar: p?.avatar_url ?? null,
          subscribed: subSet.has(other_id),
        };
      }),
    );
  };

  const loadMessages = async (threadId: string) => {
    if (!user) return;
    const [{ data: msgs }, { data: unlocks }] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true }),
      supabase.from("chat_ppv_unlocks").select("message_id").eq("user_id", user.id),
    ]);
    const unlockSet = new Set(((unlocks ?? []) as { message_id: string }[]).map((u) => u.message_id));
    setMessages(
      ((msgs ?? []) as Omit<Message, "unlocked">[]).map((m) => ({
        ...m,
        unlocked: m.sender_id === user.id || unlockSet.has(m.id) || m.ppv_price_cents === 0,
      })),
    );
  };

  useEffect(() => {
    if (user) loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  // Realtime
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`thread-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${activeId}` },
        () => loadMessages(activeId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const active = threads.find((t) => t.id === activeId) ?? null;

  const send = async () => {
    if (!user || !active || !draft.trim()) return;
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
        reason: detection.matches.map((m) => `${m.label}: ${m.sample}`).join(" | ").slice(0, 500),
      });
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        thread_id: active.id,
        sender_id: user.id,
        body,
      });
      if (error) throw error;
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user || !active) return;
    const f = e.target.files?.[0];
    if (!f) return;
    const ppvCents = ppvPrice ? Math.round(parseFloat(ppvPrice) * 100) : 0;
    setBusy(true);
    try {
      const ext = f.name.split(".").pop() || "bin";
      const path = `${user.id}/${active.id}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from("chat-media").upload(path, f, { contentType: f.type });
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
      toast.success(ppvCents ? `Mídia PPV enviada (R$ ${(ppvCents / 100).toFixed(2)})` : "Mídia enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const unlock = async (m: Message) => {
    if (!user || !active) return;
    setBusy(true);
    try {
      const { error: te } = await supabase.from("transactions").insert({
        payer_id: user.id,
        payee_id: active.other_id,
        type: "chat_ppv",
        status: "paid",
        amount_cents: m.ppv_price_cents,
        reference_id: m.id,
        gateway: "mock",
      });
      if (te) throw te;
      const { error: ue } = await supabase
        .from("chat_ppv_unlocks")
        .insert({ message_id: m.id, user_id: user.id, amount_cents: m.ppv_price_cents });
      if (ue) throw ue;
      toast.success("Mídia desbloqueada!");
      loadMessages(active.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg.includes("duplicate")) loadMessages(active.id);
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const filtered = threads.filter((t) =>
    query ? t.other_name.toLowerCase().includes(query.toLowerCase()) : true,
  );

  if (!user) return null;

  return (
    <AppShell withSidebar={false}>
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[320px_1fr]">
        <aside className="flex min-h-0 flex-col border-r border-border">
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
              <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma conversa ainda.</div>
            ) : (
              filtered.map((th) => (
                <button
                  key={th.id}
                  onClick={() => setActiveId(th.id)}
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
                    <div className="truncate text-sm font-semibold text-foreground">{th.other_name}</div>
                    <div className="truncate text-xs text-muted-foreground">@{th.other_username}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {active ? (
            <>
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
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
                        <Crown className="h-3 w-3" /> Assinante ativo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">@{active.other_username}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTipOpen(true)}>
                  <DollarSign className="mr-1 h-3.5 w-3.5" /> {t("feed.tip")}
                </Button>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto bg-background/30 p-4">
                {messages.map((m) => {
                  const fromMe = m.sender_id === user.id;
                  const isLockedMedia = m.media_path && !m.unlocked && (m.ppv_price_cents > 0 || (m.subscribers_only && !active.subscribed));
                  // Auto-libera para assinantes ativos
                  const subUnlocked = m.subscribers_only && active.subscribed;
                  const showMedia = m.media_path && (m.unlocked || subUnlocked);
                  return (
                    <div key={m.id} className={`max-w-[78%] overflow-hidden rounded-2xl shadow-card ${fromMe ? "ml-auto bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>
                      {showMedia && m.media_path && (
                        m.mime_type?.startsWith("video/") ? (
                          <video src={chatMediaUrl(m.media_path)} controls className="aspect-square w-72 max-w-full object-cover" />
                        ) : (
                          <img src={chatMediaUrl(m.media_path)} alt="" className="aspect-square w-72 max-w-full object-cover" />
                        )
                      )}
                      {isLockedMedia && m.media_path && (
                        <div className="relative">
                          <img src={chatMediaUrl(m.media_path)} alt="" className="aspect-square w-72 max-w-full scale-110 object-cover blur-2xl" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                            <Lock className="h-7 w-7 text-primary" />
                            {m.ppv_price_cents > 0 ? (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => unlock(m)}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `${t("feed.unlock")} R$ ${(m.ppv_price_cents / 100).toFixed(2)}`}
                              </Button>
                            ) : (
                              <span className="rounded-full bg-primary/90 px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                                Apenas assinantes
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {m.body && <div className={`px-4 py-2 text-sm ${fromMe ? "" : "text-foreground"}`}>{m.body}</div>}
                      {m.body && !fromMe && (
                        <div className="px-4 pb-1">
                          <TranslateButton text={m.body} />
                        </div>
                      )}
                      <div className={`px-3 pb-1.5 text-[10px] ${fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <footer className="space-y-2 border-t border-border p-3">
                {ppvPrice && (
                  <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent">
                    🔒 Próxima mídia será PPV: R$ {parseFloat(ppvPrice || "0").toFixed(2)}
                    <button onClick={() => setPpvPrice("")} className="ml-auto text-muted-foreground hover:text-foreground">×</button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full p-2 text-muted-foreground hover:text-primary"
                    aria-label="media"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
                  <button
                    onClick={() => {
                      const v = prompt("Preço PPV em R$ (ou cancele para mídia grátis):", "9.90");
                      if (v) setPpvPrice(v);
                    }}
                    className="rounded-full p-2 text-muted-foreground hover:text-accent"
                    aria-label="ppv"
                    title="Definir preço PPV para próxima mídia"
                  >
                    <Lock className="h-5 w-5" />
                  </button>
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={t("chat.placeholder")}
                    className="h-10 flex-1"
                  />
                  <Button onClick={send} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </footer>

              <TipModal
                open={tipOpen}
                onOpenChange={setTipOpen}
                creatorId={active.other_id}
                creatorName={active.other_name}
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

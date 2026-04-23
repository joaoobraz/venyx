import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, Send, DollarSign, Image as ImageIcon, Lock, Circle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

interface Conv {
  id: string;
  name: string;
  username: string;
  avatar: string;
  online: boolean;
  lastMsg: string;
  lastTime: string;
  unread: number;
}

interface Msg {
  id: string;
  fromMe: boolean;
  text?: string;
  ppvCents?: number;
  image?: string;
  unlocked?: boolean;
  time: string;
}

const CONVS: Conv[] = [
  { id: "1", name: "Aline", username: "aline", avatar: "https://i.pravatar.cc/100?img=47", online: true, lastMsg: "Te mando agora ❤", lastTime: "12:04", unread: 2 },
  { id: "2", name: "Lara", username: "lara", avatar: "https://i.pravatar.cc/100?img=32", online: true, lastMsg: "Adorei seu mimo!", lastTime: "11:20", unread: 0 },
  { id: "3", name: "Bia", username: "bia", avatar: "https://i.pravatar.cc/100?img=20", online: false, lastMsg: "Vídeo PPV liberado 🎬", lastTime: "Ontem", unread: 0 },
];

const MESSAGES: Record<string, Msg[]> = {
  "1": [
    { id: "a", fromMe: false, text: "Oi amor 😘", time: "12:00" },
    { id: "b", fromMe: true, text: "Oii, tudo bem?", time: "12:01" },
    { id: "c", fromMe: false, text: "Te mando uma surpresa", time: "12:03" },
    { id: "d", fromMe: false, ppvCents: 990, image: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600", time: "12:04" },
  ],
  "2": [{ id: "a", fromMe: false, text: "Adorei seu mimo!", time: "11:20" }],
  "3": [{ id: "a", fromMe: false, text: "Vídeo PPV liberado 🎬", time: "Ontem" }],
};

function ChatPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [activeId, setActiveId] = useState<string>("1");
  const [filterOnline, setFilterOnline] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<Msg[]>(MESSAGES["1"]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    setThread(MESSAGES[activeId] ?? []);
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const convs = useMemo(() => {
    return CONVS.filter((c) => (filterOnline ? c.online : true)).filter((c) =>
      query ? c.name.toLowerCase().includes(query.toLowerCase()) : true,
    );
  }, [filterOnline, query]);

  const active = CONVS.find((c) => c.id === activeId);

  const send = () => {
    if (!draft.trim()) return;
    setThread((t) => [...t, { id: String(Date.now()), fromMe: true, text: draft, time: "agora" }]);
    setDraft("");
  };

  if (!user) return null;

  return (
    <AppShell withSidebar={false}>
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[320px_1fr]">
        {/* Conv list */}
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
            <button
              onClick={() => setFilterOnline((v) => !v)}
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterOnline ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Circle className="h-2 w-2 fill-current" /> {t("chat.online")}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convs.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted ${
                  activeId === c.id ? "bg-muted" : ""
                }`}
              >
                <div className="relative">
                  <img src={c.avatar} alt="" className="h-11 w-11 rounded-full" />
                  {c.online && (
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card"
                      style={{ backgroundColor: "oklch(0.72 0.18 145)" }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">{c.lastTime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs text-muted-foreground">{c.lastMsg}</span>
                    {c.unread > 0 && (
                      <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Thread */}
        <section className="flex min-h-0 flex-col">
          {active ? (
            <>
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <img src={active.avatar} alt="" className="h-9 w-9 rounded-full" />
                <div>
                  <div className="text-sm font-semibold text-foreground">{active.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {active.online ? t("chat.online") : "@" + active.username}
                  </div>
                </div>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto bg-background/30 p-4">
                {thread.map((m) => (
                  <MsgBubble key={m.id} msg={m} />
                ))}
                <div ref={endRef} />
              </div>
              <footer className="flex items-center gap-2 border-t border-border p-3">
                <button className="rounded-full p-2 text-muted-foreground hover:text-primary" aria-label="media">
                  <ImageIcon className="h-5 w-5" />
                </button>
                <button className="rounded-full p-2 text-muted-foreground hover:text-primary" aria-label="tip">
                  <DollarSign className="h-5 w-5" />
                </button>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={t("chat.placeholder")}
                  className="h-10 flex-1"
                />
                <Button onClick={send} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Send className="h-4 w-4" />
                </Button>
              </footer>
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

function MsgBubble({ msg }: { msg: Msg }) {
  const { t } = useI18n();
  const cls = msg.fromMe
    ? "ml-auto bg-primary text-primary-foreground"
    : "bg-card text-foreground";

  if (msg.ppvCents && msg.image && !msg.unlocked) {
    return (
      <div className={`max-w-[78%] overflow-hidden rounded-2xl shadow-card ${msg.fromMe ? "ml-auto" : ""}`}>
        <div className="relative">
          <img src={msg.image} alt="" className="aspect-square w-72 max-w-full scale-110 object-cover blur-2xl" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
            <Lock className="h-7 w-7 text-primary" />
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              {t("feed.unlock")} R$ {(msg.ppvCents / 100).toFixed(2)}
            </Button>
          </div>
        </div>
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground">{msg.time}</div>
      </div>
    );
  }

  return (
    <div className={`max-w-[78%] rounded-2xl px-4 py-2 shadow-card ${cls}`}>
      <div className="text-sm">{msg.text}</div>
      <div className={`mt-0.5 text-[10px] ${msg.fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        {msg.time}
      </div>
    </div>
  );
}

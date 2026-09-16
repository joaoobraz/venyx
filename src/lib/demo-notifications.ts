import { getDemoChatThreadForCreator } from "@/lib/demo-chat";

export interface DemoNotification {
  id: string;
  type: string;
  title: string;
  title_en: string;
  body: string | null;
  body_en: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

const STORAGE_VERSION = "v1";
export const DEMO_NOTIFICATIONS_CHANGED_EVENT = "venyx:demo-notifications-changed";

function storageKey(userId: string) {
  return `venyx:presentation:notifications:${STORAGE_VERSION}:${userId}`;
}

function minutesAgo(value: number) {
  return new Date(Date.now() - value * 60_000).toISOString();
}

function seedNotifications(): DemoNotification[] {
  const alineThread = getDemoChatThreadForCreator("demo-aline");
  const laraThread = getDemoChatThreadForCreator("demo-lara");
  const camilaThread = getDemoChatThreadForCreator("demo-camila");
  return [
    {
      id: "demo-notification-chat-aline",
      type: "chat_message",
      title: "Nova mensagem de @aline",
      title_en: "New message from @aline",
      body: "Acabei de publicar um novo bastidor.",
      body_en: "I just published new behind-the-scenes content.",
      link: alineThread ? `/chat?thread=${alineThread.id}` : "/chat",
      read_at: null,
      created_at: minutesAgo(7),
      metadata: { actor_username: "aline", thread_id: alineThread?.id },
    },
    {
      id: "demo-notification-chat-lara",
      type: "chat_message",
      title: "Nova mensagem de @lara",
      title_en: "New message from @lara",
      body: "Hoje tem uma sessão especial.",
      body_en: "There is a special session today.",
      link: laraThread ? `/chat?thread=${laraThread.id}` : "/chat",
      read_at: null,
      created_at: minutesAgo(16),
      metadata: { actor_username: "lara", thread_id: laraThread?.id },
    },
    {
      id: "demo-notification-post-camila",
      type: "post_like",
      title: "Sua atividade com @camila foi registrada",
      title_en: "Your activity with @camila was recorded",
      body: "Você acompanha as novidades desta criadora.",
      body_en: "You follow this creator's latest updates.",
      link: "/profile/camila",
      read_at: null,
      created_at: minutesAgo(38),
      metadata: { actor_username: "camila" },
    },
    {
      id: "demo-notification-reply-duda",
      type: "comment_reply",
      title: "@duda respondeu ao seu comentário",
      title_en: "@duda replied to your comment",
      body: "Obrigada por acompanhar meu trabalho!",
      body_en: "Thank you for following my work!",
      link: "/saved/demo-post-duda-editorial",
      read_at: minutesAgo(52),
      created_at: minutesAgo(55),
      metadata: { actor_username: "duda" },
    },
    {
      id: "demo-notification-chat-camila",
      type: "chat_message",
      title: "Mensagem de @camila",
      title_en: "Message from @camila",
      body: "Obrigada por estar por aqui.",
      body_en: "Thank you for being here.",
      link: camilaThread ? `/chat?thread=${camilaThread.id}` : "/chat",
      read_at: minutesAgo(70),
      created_at: minutesAgo(74),
      metadata: { actor_username: "camila", thread_id: camilaThread?.id },
    },
  ];
}

export function readDemoNotifications(userId: string) {
  if (typeof window === "undefined") return [] as DemoNotification[];
  const key = storageKey(userId);
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return JSON.parse(existing) as DemoNotification[];
  } catch {
    // Invalid local-only data is replaced by the seed below.
  }
  const seeded = seedNotifications();
  window.localStorage.setItem(key, JSON.stringify(seeded));
  return seeded;
}

export function writeDemoNotifications(userId: string, items: DemoNotification[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, 100)));
  window.dispatchEvent(new Event(DEMO_NOTIFICATIONS_CHANGED_EVENT));
  window.dispatchEvent(new Event("venyx:unread-counts-changed"));
}

export function addDemoNotification(
  userId: string,
  input: Pick<DemoNotification, "type" | "title" | "title_en" | "body" | "body_en" | "link"> & {
    metadata?: Record<string, unknown>;
  },
) {
  const item: DemoNotification = {
    ...input,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `notification-${Date.now()}`,
    read_at: null,
    created_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
  writeDemoNotifications(userId, [item, ...readDemoNotifications(userId)]);
  return item;
}

export function countDemoUnreadNotifications(userId: string) {
  return readDemoNotifications(userId).filter((item) => !item.read_at).length;
}

export function markDemoNotificationRead(userId: string, id: string) {
  const items = readDemoNotifications(userId).map((item) =>
    item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item,
  );
  writeDemoNotifications(userId, items);
  return items;
}

export function markAllDemoNotificationsRead(userId: string) {
  const now = new Date().toISOString();
  const items = readDemoNotifications(userId).map((item) => ({
    ...item,
    read_at: item.read_at ?? now,
  }));
  writeDemoNotifications(userId, items);
  return items;
}

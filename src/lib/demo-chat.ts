import { getDemoCreator } from "@/lib/demo-creators";

export interface DemoChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  media_path: string | null;
  mime_type: string | null;
  ppv_price_cents: number;
  subscribers_only: boolean;
  unlocked: boolean;
  read_at: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface DemoChatThread {
  id: string;
  creatorId: string;
  username: string;
  subscribed: boolean;
}

export const DEMO_CHAT_THREADS: DemoChatThread[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    creatorId: "demo-aline",
    username: "aline",
    subscribed: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    creatorId: "demo-duda",
    username: "duda",
    subscribed: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    creatorId: "demo-lara",
    username: "lara",
    subscribed: false,
  },
];

const STORAGE_VERSION = "v2";

const DEMO_MESSAGE_COPY: Record<string, { "pt-BR": string; en: string }> = {
  "10000000-0000-4000-8000-000000001011": {
    "pt-BR": "Oi, Aline! Conheci seu perfil hoje 😊",
    en: "Hi, Aline! I found your profile today 😊",
  },
  "10000000-0000-4000-8000-000000001012": {
    "pt-BR": "Oi! Que bom ter você por aqui 💕",
    en: "Hi! It's great to have you here 💕",
  },
  "10000000-0000-4000-8000-000000001013": {
    "pt-BR": "Preparei algumas novidades para esta semana.",
    en: "I prepared some new content for this week.",
  },
  "10000000-0000-4000-8000-000000001014": {
    "pt-BR": "Depois me conta qual conteúdo você mais gostou!",
    en: "Later, tell me which content you liked the most!",
  },
  "10000000-0000-4000-8000-000000001021": {
    "pt-BR": "Bem-vindo ao meu espaço!",
    en: "Welcome to my space!",
  },
  "10000000-0000-4000-8000-000000001022": {
    "pt-BR": "Obrigado, Duda! Já estou explorando o perfil.",
    en: "Thanks, Duda! I'm already exploring your profile.",
  },
  "10000000-0000-4000-8000-000000001023": {
    "pt-BR": "Qualquer dúvida, pode falar comigo por aqui.",
    en: "If you have any questions, you can message me here.",
  },
  "10000000-0000-4000-8000-000000001031": {
    "pt-BR": "Oi, Lara! Tudo bem?",
    en: "Hi, Lara! How are you?",
  },
  "10000000-0000-4000-8000-000000001032": {
    "pt-BR": "Tudo ótimo! Obrigada pela mensagem ✨",
    en: "I'm great! Thanks for the message ✨",
  },
};

export function localizedDemoMessageBody(
  message: Pick<DemoChatMessage, "id" | "body">,
  locale: "pt-BR" | "en",
) {
  return DEMO_MESSAGE_COPY[message.id]?.[locale] ?? message.body;
}

export function demoChatStoragePrefix(userId: string) {
  return `venyx-demo-chat:${STORAGE_VERSION}:${userId}:`;
}

export function demoChatStorageKey(userId: string, threadId: string) {
  return `${demoChatStoragePrefix(userId)}${threadId}`;
}

export function isDemoChatThreadId(threadId: string) {
  return DEMO_CHAT_THREADS.some((thread) => thread.id === threadId);
}

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function initialMessages(userId: string, thread: DemoChatThread): DemoChatMessage[] {
  const message = (
    suffix: number,
    senderId: string,
    body: string,
    minutesAgo: number,
    readAt: string | null,
  ): DemoChatMessage => ({
    id: `10000000-0000-4000-8000-${String(thread.id.slice(-3) + suffix).padStart(12, "0")}`,
    thread_id: thread.id,
    sender_id: senderId,
    body,
    media_path: null,
    mime_type: null,
    ppv_price_cents: 0,
    subscribers_only: false,
    unlocked: true,
    read_at: readAt,
    edited_at: null,
    created_at: isoMinutesAgo(minutesAgo),
  });

  if (thread.username === "aline") {
    return [
      message(1, userId, "Oi, Aline! Conheci seu perfil hoje 😊", 22, isoMinutesAgo(20)),
      message(2, thread.creatorId, "Oi! Que bom ter você por aqui 💜", 18, isoMinutesAgo(17)),
      message(3, thread.creatorId, "Preparei algumas novidades para esta semana.", 6, null),
      message(4, thread.creatorId, "Depois me conta qual conteúdo você mais gostou!", 4, null),
    ];
  }

  if (thread.username === "duda") {
    return [
      message(1, thread.creatorId, "Bem-vindo ao meu espaço!", 75, isoMinutesAgo(74)),
      message(2, userId, "Obrigado, Duda! Já estou explorando o perfil.", 70, isoMinutesAgo(68)),
      message(
        3,
        thread.creatorId,
        "Qualquer dúvida, pode falar comigo por aqui.",
        64,
        isoMinutesAgo(63),
      ),
    ];
  }

  return [
    message(1, userId, "Oi, Lara! Tudo bem?", 14, isoMinutesAgo(12)),
    message(2, thread.creatorId, "Tudo ótimo! Obrigada pela mensagem ✨", 10, null),
  ];
}

function removeLegacyDemoMessages(userId: string) {
  const marker = `venyx-demo-chat:${STORAGE_VERSION}:migrated:${userId}`;
  if (localStorage.getItem(marker) === "1") return;

  const currentPrefix = `venyx-demo-chat:${STORAGE_VERSION}:`;
  const staleKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("venyx-demo-chat:") && !key.startsWith(currentPrefix)) {
      staleKeys.push(key);
    }
  }
  staleKeys.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(marker, "1");
}

export function readDemoChatMessages(userId: string, threadId: string): DemoChatMessage[] {
  if (typeof window === "undefined" || !isDemoChatThreadId(threadId)) return [];
  try {
    const value = JSON.parse(localStorage.getItem(demoChatStorageKey(userId, threadId)) ?? "[]");
    return Array.isArray(value) ? (value as DemoChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function writeDemoChatMessages(
  userId: string,
  threadId: string,
  messages: DemoChatMessage[],
) {
  if (typeof window === "undefined" || !isDemoChatThreadId(threadId)) return;
  localStorage.setItem(demoChatStorageKey(userId, threadId), JSON.stringify(messages.slice(-500)));
}

export function ensureDemoChatSeed(userId: string) {
  if (typeof window === "undefined") return;
  removeLegacyDemoMessages(userId);
  for (const thread of DEMO_CHAT_THREADS) {
    const key = demoChatStorageKey(userId, thread.id);
    if (!localStorage.getItem(key)) {
      writeDemoChatMessages(userId, thread.id, initialMessages(userId, thread));
    }
  }
}

export function countDemoUnreadMessages(userId: string) {
  if (typeof window === "undefined") return 0;
  ensureDemoChatSeed(userId);
  return DEMO_CHAT_THREADS.reduce(
    (total, thread) =>
      total +
      readDemoChatMessages(userId, thread.id).filter(
        (message) => message.sender_id !== userId && !message.read_at,
      ).length,
    0,
  );
}

export function demoThreadDetails(userId: string) {
  ensureDemoChatSeed(userId);
  return DEMO_CHAT_THREADS.map((thread) => {
    const creator = getDemoCreator(thread.username);
    const messages = readDemoChatMessages(userId, thread.id);
    const lastMessage = messages.at(-1);
    return {
      ...thread,
      creator,
      messages,
      lastMessage,
      unreadCount: messages.filter((message) => message.sender_id !== userId && !message.read_at)
        .length,
    };
  });
}

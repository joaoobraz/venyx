import { DEMO_CREATORS, getDemoCreator } from "@/lib/demo-creators";
import { isDemoSubscribed } from "@/lib/demo-content";

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

export interface DemoChatLead {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: null;
  subscribed: boolean;
}

export const DEMO_CHAT_THREADS: DemoChatThread[] = DEMO_CREATORS.map((item, index) => ({
  id: `00000000-0000-4000-8000-${String(101 + index).padStart(12, "0")}`,
  creatorId: item.user_id,
  username: item.username,
  subscribed: ["aline", "camila", "valentina"].includes(item.username),
}));

const LEAD_NAMES = [
  ["joao_silva", "João Silva"],
  ["lucas_mendes", "Lucas Mendes"],
  ["felipe_alves", "Felipe Alves"],
  ["bruno_costa", "Bruno Costa"],
  ["rafael_lima", "Rafael Lima"],
  ["diego_rocha", "Diego Rocha"],
  ["andre_souza", "André Souza"],
  ["pedro_martins", "Pedro Martins"],
  ["gustavo_nunes", "Gustavo Nunes"],
  ["henrique_melo", "Henrique Melo"],
  ["caio_ramos", "Caio Ramos"],
  ["matheus_freitas", "Matheus Freitas"],
  ["thiago_cardoso", "Thiago Cardoso"],
  ["eduardo_reis", "Eduardo Reis"],
  ["daniel_araujo", "Daniel Araújo"],
] as const;

export const DEMO_CHAT_LEADS: DemoChatLead[] = LEAD_NAMES.map(
  ([username, displayName], index) => ({
    user_id: `demo-lead-${index + 1}`,
    username,
    display_name: displayName,
    avatar_url: null,
    subscribed: index < 8 || index % 3 === 0,
  }),
);

const STORAGE_VERSION = "v3";

const BODY_TRANSLATIONS: Record<string, string> = {
  "Oi, Aline! Conheci seu perfil hoje 😊": "Hi, Aline! I found your profile today 😊",
  "Oi! Que bom ter você por aqui 💕": "Hi! It's great to have you here 💕",
  "Preparei algumas novidades para esta semana.": "I prepared some new content for this week.",
  "Acabei de publicar um bastidor exclusivo para assinantes.":
    "I just published exclusive behind-the-scenes content for subscribers.",
  "Bem-vindo ao meu espaço!": "Welcome to my space!",
  "Obrigado, Duda! Já estou explorando o perfil.":
    "Thanks, Duda! I'm already exploring your profile.",
  "Qualquer dúvida, pode falar comigo por aqui.":
    "If you have any questions, you can message me here.",
  "Oi, Lara! Tudo bem?": "Hi, Lara! How are you?",
  "Tudo ótimo! Obrigada pela mensagem ✨": "I'm great! Thanks for the message ✨",
  "Hoje estou liberando uma sessão especial para quem acompanha de perto.":
    "Today I'm releasing a special session for my closest followers.",
  "Oi! Sua presença já está anotada no meu calendário ✨":
    "Hi! Your presence is already on my calendar ✨",
  "Fico feliz! Quero acompanhar seu conteúdo com mais calma.":
    "I'm glad! I want to follow your content more closely.",
  "Perfeito. Também gosto de conversar antes de cada lançamento.":
    "Perfect. I also enjoy chatting before each release.",
  "Tenho uma novidade para você hoje.": "I have something new for you today.",
  "Que ótimo, Marina! Estou curiosa para ver.": "That's great, Marina! I'm curious to see it.",
  "Vou enviar um convite para o conteúdo mais recente assim que estiver pronto.":
    "I'll send an invitation to the latest content as soon as it's ready.",
  "Oi, Valentina! Adorei a energia do seu perfil.":
    "Hi, Valentina! I loved the energy of your profile.",
  "Que carinho! Gosto de manter uma comunicação próxima.":
    "That's so kind! I like to keep communication close.",
  "Posso indicar as melhores formas de acompanhar meus novos posts.":
    "I can suggest the best ways to follow my new posts.",
  "Obrigada por acompanhar meu trabalho.": "Thank you for following my work.",
  "Eu que agradeço. Gostei muito das novidades.": "Thank you. I really enjoyed the updates.",
  "Amanhã teremos uma nova publicação por aqui.": "There will be a new post here tomorrow.",
  "Espero que sua semana esteja indo bem!": "I hope your week is going well!",
  "Está sim. Obrigada pela atenção.": "It is. Thank you for checking in.",
  "Quando quiser conversar, estarei por aqui.": "Whenever you want to chat, I'll be here.",
};

export function localizedDemoMessageBody(
  message: Pick<DemoChatMessage, "body">,
  locale: "pt-BR" | "en",
) {
  if (!message.body || locale === "pt-BR") return message.body;
  return BODY_TRANSLATIONS[message.body] ?? message.body;
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

export function getDemoChatThreadForCreator(creatorId: string) {
  return DEMO_CHAT_THREADS.find((thread) => thread.creatorId === creatorId) ?? null;
}

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function initialMessages(userId: string, thread: DemoChatThread): DemoChatMessage[] {
  const threadIndex = DEMO_CHAT_THREADS.findIndex((item) => item.id === thread.id);
  const message = (
    index: number,
    senderId: string,
    body: string,
    minutesAgo: number,
    readAt: string | null,
  ): DemoChatMessage => ({
    id: `10000000-0000-4000-8000-${String((101 + threadIndex) * 10 + index).padStart(12, "0")}`,
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
      message(1, userId, "Oi, Aline! Conheci seu perfil hoje 😊", 42, isoMinutesAgo(40)),
      message(2, thread.creatorId, "Oi! Que bom ter você por aqui 💕", 37, isoMinutesAgo(35)),
      message(3, thread.creatorId, "Preparei algumas novidades para esta semana.", 20, isoMinutesAgo(18)),
      message(4, thread.creatorId, "Acabei de publicar um bastidor exclusivo para assinantes.", 7, null),
    ];
  }

  if (thread.username === "duda") {
    return [
      message(1, thread.creatorId, "Bem-vindo ao meu espaço!", 88, isoMinutesAgo(86)),
      message(2, userId, "Obrigado, Duda! Já estou explorando o perfil.", 81, isoMinutesAgo(79)),
      message(3, thread.creatorId, "Qualquer dúvida, pode falar comigo por aqui.", 64, isoMinutesAgo(62)),
    ];
  }

  if (thread.username === "lara") {
    return [
      message(1, userId, "Oi, Lara! Tudo bem?", 54, isoMinutesAgo(52)),
      message(2, thread.creatorId, "Tudo ótimo! Obrigada pela mensagem ✨", 36, isoMinutesAgo(34)),
      message(3, thread.creatorId, "Hoje estou liberando uma sessão especial para quem acompanha de perto.", 16, null),
    ];
  }

  if (thread.username === "camila") {
    return [
      message(1, thread.creatorId, "Oi! Sua presença já está anotada no meu calendário ✨", 76, isoMinutesAgo(74)),
      message(2, userId, "Fico feliz! Quero acompanhar seu conteúdo com mais calma.", 60, isoMinutesAgo(58)),
      message(3, thread.creatorId, "Perfeito. Também gosto de conversar antes de cada lançamento.", 28, null),
    ];
  }

  if (thread.username === "marina") {
    return [
      message(1, thread.creatorId, "Tenho uma novidade para você hoje.", 118, isoMinutesAgo(116)),
      message(2, userId, "Que ótimo, Marina! Estou curiosa para ver.", 94, isoMinutesAgo(92)),
      message(3, thread.creatorId, "Vou enviar um convite para o conteúdo mais recente assim que estiver pronto.", 46, null),
    ];
  }

  if (thread.username === "valentina") {
    return [
      message(1, userId, "Oi, Valentina! Adorei a energia do seu perfil.", 72, isoMinutesAgo(70)),
      message(2, thread.creatorId, "Que carinho! Gosto de manter uma comunicação próxima.", 55, isoMinutesAgo(53)),
      message(3, thread.creatorId, "Posso indicar as melhores formas de acompanhar meus novos posts.", 32, null),
    ];
  }

  const minutesBase = 140 + threadIndex * 23;
  const lastRead = threadIndex % 2 === 0 ? null : isoMinutesAgo(minutesBase - 42);
  return [
    message(1, thread.creatorId, "Obrigada por acompanhar meu trabalho.", minutesBase, isoMinutesAgo(minutesBase - 2)),
    message(2, userId, "Eu que agradeço. Gostei muito das novidades.", minutesBase - 24, isoMinutesAgo(minutesBase - 22)),
    message(
      3,
      thread.creatorId,
      threadIndex % 3 === 0
        ? "Amanhã teremos uma nova publicação por aqui."
        : threadIndex % 3 === 1
          ? "Espero que sua semana esteja indo bem!"
          : "Quando quiser conversar, estarei por aqui.",
      minutesBase - 44,
      lastRead,
    ),
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

export function countDemoUnreadMessages(
  userId: string,
  perspective: "subscriber" | "creator" = "subscriber",
) {
  if (typeof window === "undefined") return 0;
  ensureDemoChatSeed(userId);
  return DEMO_CHAT_THREADS.reduce(
    (total, thread) => {
      const actorId = perspective === "creator" ? thread.creatorId : userId;
      return (
      total +
      readDemoChatMessages(userId, thread.id).filter(
        (message) => message.sender_id !== actorId && !message.read_at,
      ).length
      );
    },
    0,
  );
}

export function demoThreadDetails(
  userId: string,
  perspective: "subscriber" | "creator" = "subscriber",
) {
  ensureDemoChatSeed(userId);
  return DEMO_CHAT_THREADS.map((thread, index) => {
    const creator = getDemoCreator(thread.username);
    const lead = DEMO_CHAT_LEADS[index];
    const actorId = perspective === "creator" ? thread.creatorId : userId;
    const messages = readDemoChatMessages(userId, thread.id);
    const lastMessage = messages.at(-1);
    return {
      ...thread,
      subscribed: isDemoSubscribed(userId, thread.creatorId),
      creator,
      lead,
      actorId,
      messages,
      lastMessage,
      unreadCount: messages.filter((message) => message.sender_id !== actorId && !message.read_at)
        .length,
    };
  });
}

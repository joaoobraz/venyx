import type { PostWithRelations } from "@/components/PostCard";
import type { StoryGroup } from "@/components/StoryViewer";
import type { PostComment } from "@/_server/post-interactions.functions";
import {
  DEMO_CREATORS,
  getDemoCreator,
  getDemoCreatorById,
  type DemoCreator,
} from "@/lib/demo-creators";
import {
  isDemoGoalContributed,
  isDemoPpvUnlocked,
  readDemoOperations,
} from "@/lib/demo-operations";

export type DemoLocale = "pt-BR" | "en";

type DemoPostSeed = {
  id: string;
  username: string;
  body: Record<DemoLocale, string>;
  visibility: "public" | "subscribers" | "ppv" | "goal";
  priceCents?: number;
  goalTargetCents?: number;
  goalRaisedCents?: number;
  goalMinimumCents?: number;
  likes: number;
  comments: number;
  hoursAgo: number;
};

const POST_SEEDS: DemoPostSeed[] = [
  {
    id: "demo-post-aline-studio",
    username: "aline",
    body: {
      "pt-BR":
        "Finalizando uma nova produção no estúdio. Qual tema vocês gostariam de ver na próxima semana?",
      en: "Finishing a new studio production. Which theme would you like to see next week?",
    },
    visibility: "public",
    likes: 842,
    comments: 3,
    hoursAgo: 2,
  },
  {
    id: "demo-post-aline-vip",
    username: "aline",
    body: {
      "pt-BR": "Bastidores completos desta produção disponíveis para assinantes.",
      en: "Full behind-the-scenes coverage of this production is available to subscribers.",
    },
    visibility: "subscribers",
    likes: 731,
    comments: 3,
    hoursAgo: 4,
  },
  {
    id: "demo-post-aline-ppv",
    username: "aline",
    body: {
      "pt-BR": "Ensaio especial em alta resolução disponível como conteúdo exclusivo.",
      en: "Special high-resolution shoot available as exclusive content.",
    },
    visibility: "ppv",
    priceCents: 1990,
    likes: 684,
    comments: 3,
    hoursAgo: 7,
  },
  {
    id: "demo-post-aline-goal",
    username: "aline",
    body: {
      "pt-BR": "Vamos liberar juntos o próximo ensaio completo?",
      en: "Shall we unlock the next complete shoot together?",
    },
    visibility: "goal",
    goalTargetCents: 50000,
    goalRaisedCents: 18500,
    goalMinimumCents: 1000,
    likes: 612,
    comments: 3,
    hoursAgo: 8,
  },
  {
    id: "demo-post-duda-editorial",
    username: "duda",
    body: {
      "pt-BR": "Um pouco dos bastidores do editorial de hoje. A equipe ficou incrível.",
      en: "A glimpse behind the scenes of today's editorial. The team was amazing.",
    },
    visibility: "public",
    likes: 764,
    comments: 3,
    hoursAgo: 5,
  },
  {
    id: "demo-post-lara-viagem",
    username: "lara",
    body: {
      "pt-BR":
        "Luz natural, uma câmera e um lugar novo para descobrir. Essa combinação nunca falha.",
      en: "Natural light, a camera and a new place to discover. That combination never fails.",
    },
    visibility: "public",
    likes: 691,
    comments: 3,
    hoursAgo: 9,
  },
  {
    id: "demo-post-bia-rotina",
    username: "bia",
    body: {
      "pt-BR":
        "Rotina concluída e energia renovada. Deixei a sequência completa para quem acompanha de perto.",
      en: "Routine complete and energy renewed. I saved the full sequence for my closest followers.",
    },
    visibility: "subscribers",
    likes: 628,
    comments: 3,
    hoursAgo: 14,
  },
  {
    id: "demo-post-camila-beleza",
    username: "camila",
    body: {
      "pt-BR": "Testando uma nova paleta e preparando o passo a passo que vocês pediram.",
      en: "Trying a new palette and preparing the step-by-step you asked for.",
    },
    visibility: "subscribers",
    likes: 587,
    comments: 3,
    hoursAgo: 20,
  },
  {
    id: "demo-post-marina-jantar",
    username: "marina",
    body: {
      "pt-BR": "Uma noite especial merece detalhes pensados com calma. Hoje tem conteúdo novo.",
      en: "A special evening deserves carefully chosen details. New content is up today.",
    },
    visibility: "ppv",
    priceCents: 1490,
    likes: 544,
    comments: 3,
    hoursAgo: 27,
  },
  {
    id: "demo-post-isabela-movimento",
    username: "isabela",
    body: {
      "pt-BR": "Movimento, música e muita preparação para a próxima sessão.",
      en: "Movement, music and plenty of preparation for the next session.",
    },
    visibility: "public",
    likes: 496,
    comments: 3,
    hoursAgo: 33,
  },
  {
    id: "demo-post-natalia-processo",
    username: "natalia",
    body: {
      "pt-BR": "Compartilhei hoje as referências que estão guiando meu novo projeto.",
      en: "Today I shared the references guiding my new project.",
    },
    visibility: "public",
    likes: 453,
    comments: 3,
    hoursAgo: 41,
  },
  {
    id: "demo-post-rafaela-personagem",
    username: "rafaela",
    body: {
      "pt-BR": "Primeiro teste de caracterização aprovado. Amanhã mostro mais detalhes.",
      en: "First character test approved. Tomorrow I'll share more details.",
    },
    visibility: "subscribers",
    likes: 421,
    comments: 3,
    hoursAgo: 49,
  },
  {
    id: "demo-post-valentina-viagem",
    username: "valentina",
    body: {
      "pt-BR": "Organizando os registros desta viagem e escolhendo os favoritos para vocês.",
      en: "Organizing the photos from this trip and choosing my favorites for you.",
    },
    visibility: "subscribers",
    likes: 389,
    comments: 3,
    hoursAgo: 58,
  },
];

const DEFAULT_SUBSCRIPTIONS = ["demo-aline", "demo-camila", "demo-valentina"];
export const DEMO_SUBSCRIPTIONS_CHANGED_EVENT = "venyx:demo-subscriptions-changed";

function subscriptionKey(userId: string) {
  return `venyx:presentation:subscriptions:v1:${userId}`;
}

export function readDemoSubscriptions(userId: string): string[] {
  if (typeof window === "undefined") return DEFAULT_SUBSCRIPTIONS;
  const key = subscriptionKey(userId);
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return JSON.parse(existing) as string[];
  } catch {
    // Invalid local-only data is replaced by the safe seed below.
  }
  window.localStorage.setItem(key, JSON.stringify(DEFAULT_SUBSCRIPTIONS));
  return DEFAULT_SUBSCRIPTIONS;
}

export function isDemoSubscribed(userId: string, creatorId: string) {
  return readDemoSubscriptions(userId).includes(creatorId);
}

export function toggleDemoSubscription(userId: string, creatorId: string) {
  const current = readDemoSubscriptions(userId);
  const subscribed = !current.includes(creatorId);
  const next = subscribed
    ? Array.from(new Set([...current, creatorId]))
    : current.filter((id) => id !== creatorId);
  window.localStorage.setItem(subscriptionKey(userId), JSON.stringify(next));
  window.dispatchEvent(new Event(DEMO_SUBSCRIPTIONS_CHANGED_EVENT));
  return subscribed;
}

function postFromSeed(seed: DemoPostSeed, locale: DemoLocale, viewerId?: string | null) {
  const author = getDemoCreator(seed.username)!;
  const subscribed = viewerId ? isDemoSubscribed(viewerId, author.user_id) : false;
  return {
    id: seed.id,
    creator_id: author.user_id,
    body: seed.body[locale],
    visibility: seed.visibility,
    price_cents: seed.priceCents ?? 0,
    likes_count: seed.likes,
    comments_count: seed.comments,
    created_at: new Date(Date.now() - seed.hoursAgo * 60 * 60 * 1000).toISOString(),
    is_pinned: false,
    author: {
      username: author.username,
      display_name: author.display_name,
      avatar_url: author.avatar_url,
      is_verified: author.is_verified,
      watermark_position: "bottom-right",
      watermark_opacity: 0.55,
    },
    media: [
      {
        id: `${seed.id}-media`,
        storage_path: author.cover_url,
        mime_type: "image/webp",
        position: 0,
      },
    ],
    unlocked: Boolean(
      viewerId && seed.visibility === "ppv" && isDemoPpvUnlocked(viewerId, seed.id),
    ),
    subscribed,
    goal:
      seed.visibility === "goal"
        ? {
            target_cents: seed.goalTargetCents ?? 50000,
            raised_cents: seed.goalRaisedCents ?? 0,
            unlock_price_cents: seed.goalMinimumCents ?? 1000,
            is_unlocked: (seed.goalRaisedCents ?? 0) >= (seed.goalTargetCents ?? 50000),
          }
        : null,
    goal_contributed: Boolean(
      viewerId && seed.visibility === "goal" && isDemoGoalContributed(viewerId, seed.id),
    ),
    liked: false,
  } satisfies PostWithRelations;
}

export function getDemoPosts(options: {
  creatorId?: string;
  postId?: string;
  viewerId?: string | null;
  stateUserId?: string | null;
  limit?: number;
  locale?: DemoLocale;
}): PostWithRelations[] {
  const { creatorId, postId, viewerId, stateUserId, limit = 30, locale = "pt-BR" } = options;
  const operationsUserId = stateUserId ?? viewerId;
  const operations = operationsUserId ? readDemoOperations(operationsUserId) : null;
  const pinnedPostId = operationsUserId
    ? (operations?.pinnedPostId ?? null)
    : "demo-post-aline-studio";
  const seeded = POST_SEEDS.filter((seed) => !postId || seed.id === postId)
    .filter((seed) => !creatorId || getDemoCreator(seed.username)?.user_id === creatorId)
    .map((seed) => ({
      ...postFromSeed(seed, locale, viewerId),
      is_pinned: seed.id === pinnedPostId,
    }));
  const previewCreator = getDemoCreator("aline")!;
  const localPosts =
    operationsUserId && operations && (!creatorId || creatorId === previewCreator.user_id)
      ? operations.creatorPosts
          .filter((item) => item.id.startsWith("post-") && item.status === "published")
          .filter((item) => !postId || item.id === postId)
          .map(
            (item) => {
              const mediaUrl = item.media_url || previewCreator.cover_url;
              const hasStoredVideo = item.media_kind === "video" && Boolean(item.media_url);
              const goalContributionCents = operations.purchases
                .filter(
                  (purchase) =>
                    purchase.kind === "goal" &&
                    purchase.reference_id === item.id &&
                    purchase.status === "paid",
                )
                .reduce((total, purchase) => total + purchase.amount_cents, 0);
              const goalTargetCents = item.goal_target_cents ?? 0;
              const goalRaisedCents = Math.min(
                goalTargetCents,
                (item.goal_raised_cents ?? 0) + goalContributionCents,
              );
              return ({
                id: item.id,
                creator_id: previewCreator.user_id,
                body: item.body ?? item.title,
                visibility: item.visibility ?? ("public" as const),
                price_cents: item.price_cents ?? 0,
                likes_count: 0,
                comments_count: 0,
                created_at: item.created_at,
                is_pinned: item.id === pinnedPostId,
                author: {
                  username: previewCreator.username,
                  display_name: previewCreator.display_name,
                  avatar_url: previewCreator.avatar_url,
                  is_verified: true,
                  watermark_position: "bottom-right",
                  watermark_opacity: 0.55,
                },
                media:
                  item.media_kind === "text"
                    ? []
                    : [
                        {
                          id: `${item.id}-media`,
                          storage_path: mediaUrl,
                          mime_type: hasStoredVideo ? "video/mp4" : "image/webp",
                          position: 0,
                        },
                      ],
                unlocked: Boolean(
                  viewerId && item.visibility === "ppv" && isDemoPpvUnlocked(viewerId, item.id),
                ),
                subscribed: viewerId ? isDemoSubscribed(viewerId, previewCreator.user_id) : false,
                goal:
                  item.visibility === "goal"
                    ? {
                        target_cents: goalTargetCents,
                        raised_cents: goalRaisedCents,
                        unlock_price_cents: item.goal_min_contribution_cents ?? 100,
                        is_unlocked: goalTargetCents > 0 && goalRaisedCents >= goalTargetCents,
                      }
                    : null,
                goal_contributed: Boolean(
                  viewerId &&
                    item.visibility === "goal" &&
                    isDemoGoalContributed(viewerId, item.id),
                ),
                liked: false,
              }) satisfies PostWithRelations;
            },
          )
      : [];
  return [...localPosts, ...seeded]
    .sort(
      (left, right) =>
        Number(Boolean(right.is_pinned)) - Number(Boolean(left.is_pinned)) ||
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, limit);
}

export function getDemoStoryGroups(locale: DemoLocale): StoryGroup[] {
  return DEMO_CREATORS.slice(0, 8).map((item, index) => ({
    creator_id: item.user_id,
    username: item.username,
    display_name: item.display_name,
    avatar_url: item.avatar_url,
    stories: [
      {
        id: `demo-story-${item.username}-1`,
        url: item.cover_url,
        mime: "image/webp",
        created_at: new Date(Date.now() - (index + 1) * 22 * 60_000).toISOString(),
      },
      ...(index < 3
        ? [
            {
              id: `demo-story-${item.username}-2`,
              url: DEMO_CREATORS[(index + 5) % DEMO_CREATORS.length].cover_url,
              mime: "image/webp",
              created_at: new Date(Date.now() - (index + 2) * 35 * 60_000).toISOString(),
            },
          ]
        : []),
    ],
    label: locale === "en" ? `${item.category_en} updates` : `Novidades de ${item.category}`,
  })) as StoryGroup[];
}

function commentAuthor(postId: string, offset: number): DemoCreator {
  const seed = Array.from(postId).reduce((sum, char) => sum + char.charCodeAt(0), offset * 19);
  return DEMO_CREATORS[seed % DEMO_CREATORS.length];
}

export function getDemoCommentSeeds(postId: string, locale: DemoLocale): PostComment[] {
  const first = commentAuthor(postId, 1);
  const second = commentAuthor(postId, 2);
  const firstId = `${postId}-comment-1`;
  const secondId = `${postId}-comment-2`;
  const firstBody =
    locale === "en" ? "The new production looks beautiful!" : "A nova produção ficou linda!";
  const secondBody =
    locale === "en" ? "I loved the colors and the atmosphere." : "Adorei as cores e a atmosfera.";
  const replyBody =
    locale === "en"
      ? `@${first.username} I agree, the result is wonderful.`
      : `@${first.username} Concordo, o resultado ficou maravilhoso.`;
  const base = Date.now() - 80 * 60_000;
  return [
    {
      id: firstId,
      post_id: postId,
      user_id: first.user_id,
      parent_comment_id: null,
      mentioned_user_ids: [],
      body: firstBody,
      created_at: new Date(base).toISOString(),
      updated_at: new Date(base).toISOString(),
      author: {
        username: first.username,
        display_name: first.display_name,
        avatar_url: first.avatar_url,
      },
      reply_to: null,
      mentions: [],
    },
    {
      id: secondId,
      post_id: postId,
      user_id: second.user_id,
      parent_comment_id: null,
      mentioned_user_ids: [],
      body: secondBody,
      created_at: new Date(base + 12 * 60_000).toISOString(),
      updated_at: new Date(base + 12 * 60_000).toISOString(),
      author: {
        username: second.username,
        display_name: second.display_name,
        avatar_url: second.avatar_url,
      },
      reply_to: null,
      mentions: [],
    },
    {
      id: `${postId}-comment-3`,
      post_id: postId,
      user_id: second.user_id,
      parent_comment_id: firstId,
      mentioned_user_ids: [first.user_id],
      body: replyBody,
      created_at: new Date(base + 24 * 60_000).toISOString(),
      updated_at: new Date(base + 24 * 60_000).toISOString(),
      author: {
        username: second.username,
        display_name: second.display_name,
        avatar_url: second.avatar_url,
      },
      reply_to: {
        id: firstId,
        user_id: first.user_id,
        username: first.username,
      },
      mentions: [{ user_id: first.user_id, username: first.username }],
    },
  ];
}

export function getDemoSubscriptionCreators(userId: string) {
  return readDemoSubscriptions(userId)
    .map(getDemoCreatorById)
    .filter((item): item is DemoCreator => Boolean(item));
}

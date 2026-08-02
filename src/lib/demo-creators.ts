export interface DemoCreator {
  user_id: string;
  username: string;
  display_name: string;
  age: number;
  bio: string;
  bio_en: string;
  location: string;
  category: string;
  category_en: string;
  avatar_url: string;
  cover_url: string;
  is_verified: true;
  subscription_price_cents: number;
  subscribers_count: number;
  likes_count: number;
  posts_count: number;
  stories_count: number;
  rank: number;
  score: number;
  status: "online" | "recent";
  last_active_minutes: number;
}

const creator = (
  rank: number,
  username: string,
  displayName: string,
  details: Omit<
    DemoCreator,
    | "user_id"
    | "username"
    | "display_name"
    | "avatar_url"
    | "cover_url"
    | "is_verified"
    | "rank"
    | "score"
  >,
): DemoCreator => ({
  user_id: `demo-${username}`,
  username,
  display_name: displayName,
  avatar_url: `/demo-creators/${username}-investor.webp`,
  cover_url: `/demo-creators/${username}-investor.webp`,
  is_verified: true,
  rank,
  score: 1600 - rank * 45,
  ...details,
});

/**
 * Adult, fictional people used only by the isolated local/staging presentation layer.
 * Production never falls back to this list and these identifiers are never persisted remotely.
 */
export const DEMO_CREATORS: DemoCreator[] = [
  creator(1, "aline", "Aline", {
    age: 28,
    bio: "Ensaios editoriais, bastidores de produção e novidades toda semana.",
    bio_en: "Editorial sessions, production behind the scenes and weekly releases.",
    location: "São Paulo, SP",
    category: "Lifestyle",
    category_en: "Lifestyle",
    subscription_price_cents: 2490,
    subscribers_count: 1380,
    likes_count: 18940,
    posts_count: 86,
    stories_count: 5,
    status: "online",
    last_active_minutes: 0,
  }),
  creator(2, "duda", "Duda", {
    age: 26,
    bio: "Moda, beleza e uma rotina criativa compartilhada de perto.",
    bio_en: "Fashion, beauty and a creative routine shared up close.",
    location: "Rio de Janeiro, RJ",
    category: "Moda",
    category_en: "Fashion",
    subscription_price_cents: 2290,
    subscribers_count: 1265,
    likes_count: 17420,
    posts_count: 79,
    stories_count: 4,
    status: "recent",
    last_active_minutes: 8,
  }),
  creator(3, "lara", "Lara", {
    age: 30,
    bio: "Fotografia, viagens e conteúdo autoral com estética minimalista.",
    bio_en: "Photography, travel and original content with a minimalist aesthetic.",
    location: "Florianópolis, SC",
    category: "Viagens",
    category_en: "Travel",
    subscription_price_cents: 2190,
    subscribers_count: 1188,
    likes_count: 16130,
    posts_count: 74,
    stories_count: 6,
    status: "recent",
    last_active_minutes: 14,
  }),
  creator(4, "bia", "Bia", {
    age: 25,
    bio: "Fitness, bem-estar e bastidores de uma rotina ativa e equilibrada.",
    bio_en: "Fitness, wellness and behind the scenes of an active, balanced routine.",
    location: "Belo Horizonte, MG",
    category: "Fitness",
    category_en: "Fitness",
    subscription_price_cents: 1990,
    subscribers_count: 1096,
    likes_count: 14870,
    posts_count: 71,
    stories_count: 3,
    status: "online",
    last_active_minutes: 0,
  }),
  creator(5, "camila", "Camila", {
    age: 29,
    bio: "Beleza, autocuidado e produções exclusivas em um espaço acolhedor.",
    bio_en: "Beauty, self-care and exclusive productions in a welcoming space.",
    location: "Curitiba, PR",
    category: "Beleza",
    category_en: "Beauty",
    subscription_price_cents: 2390,
    subscribers_count: 1014,
    likes_count: 13960,
    posts_count: 68,
    stories_count: 5,
    status: "recent",
    last_active_minutes: 22,
  }),
  creator(6, "marina", "Marina", {
    age: 31,
    bio: "Elegância, gastronomia e registros especiais do cotidiano.",
    bio_en: "Elegance, food and special moments from everyday life.",
    location: "Porto Alegre, RS",
    category: "Lifestyle",
    category_en: "Lifestyle",
    subscription_price_cents: 2190,
    subscribers_count: 942,
    likes_count: 12840,
    posts_count: 63,
    stories_count: 4,
    status: "recent",
    last_active_minutes: 36,
  }),
  creator(7, "isabela", "Isabela", {
    age: 27,
    bio: "Dança, movimento e ensaios cheios de personalidade.",
    bio_en: "Dance, movement and photo sessions full of personality.",
    location: "Salvador, BA",
    category: "Dança",
    category_en: "Dance",
    subscription_price_cents: 1890,
    subscribers_count: 876,
    likes_count: 11920,
    posts_count: 61,
    stories_count: 5,
    status: "online",
    last_active_minutes: 0,
  }),
  creator(8, "natalia", "Natália", {
    age: 32,
    bio: "Arte, música e conversas leves sobre processos criativos.",
    bio_en: "Art, music and relaxed conversations about the creative process.",
    location: "Recife, PE",
    category: "Arte",
    category_en: "Art",
    subscription_price_cents: 2090,
    subscribers_count: 824,
    likes_count: 11180,
    posts_count: 57,
    stories_count: 3,
    status: "recent",
    last_active_minutes: 48,
  }),
  creator(9, "rafaela", "Rafaela", {
    age: 24,
    bio: "Cosplay, cultura pop e novas personagens todos os meses.",
    bio_en: "Cosplay, pop culture and new characters every month.",
    location: "Brasília, DF",
    category: "Cosplay",
    category_en: "Cosplay",
    subscription_price_cents: 1990,
    subscribers_count: 768,
    likes_count: 10390,
    posts_count: 55,
    stories_count: 6,
    status: "recent",
    last_active_minutes: 65,
  }),
  creator(10, "valentina", "Valentina", {
    age: 29,
    bio: "Viagens, moda e experiências selecionadas com cuidado.",
    bio_en: "Travel, fashion and carefully selected experiences.",
    location: "Fortaleza, CE",
    category: "Viagens",
    category_en: "Travel",
    subscription_price_cents: 2290,
    subscribers_count: 719,
    likes_count: 9740,
    posts_count: 52,
    stories_count: 4,
    status: "online",
    last_active_minutes: 0,
  }),
  creator(11, "carolina", "Carolina", {
    age: 34,
    bio: "Música, fotografia e uma curadoria pessoal de momentos especiais.",
    bio_en: "Music, photography and a personal selection of special moments.",
    location: "Campinas, SP",
    category: "Música",
    category_en: "Music",
    subscription_price_cents: 1890,
    subscribers_count: 671,
    likes_count: 8890,
    posts_count: 49,
    stories_count: 2,
    status: "recent",
    last_active_minutes: 82,
  }),
  creator(12, "sofia", "Sofia", {
    age: 26,
    bio: "Praia, esporte e conteúdos de uma rotina solar.",
    bio_en: "Beach, sports and content from a sunny routine.",
    location: "Natal, RN",
    category: "Praia",
    category_en: "Beach",
    subscription_price_cents: 1790,
    subscribers_count: 624,
    likes_count: 8210,
    posts_count: 47,
    stories_count: 4,
    status: "recent",
    last_active_minutes: 110,
  }),
  creator(13, "thalia", "Thalia", {
    age: 28,
    bio: "Produção de moda, tendências e referências contemporâneas.",
    bio_en: "Fashion production, trends and contemporary references.",
    location: "Goiânia, GO",
    category: "Moda",
    category_en: "Fashion",
    subscription_price_cents: 1990,
    subscribers_count: 579,
    likes_count: 7580,
    posts_count: 45,
    stories_count: 3,
    status: "recent",
    last_active_minutes: 145,
  }),
  creator(14, "julia", "Júlia", {
    age: 30,
    bio: "Cinema, livros e ensaios inspirados em histórias marcantes.",
    bio_en: "Cinema, books and photo sessions inspired by memorable stories.",
    location: "Niterói, RJ",
    category: "Cultura",
    category_en: "Culture",
    subscription_price_cents: 1890,
    subscribers_count: 536,
    likes_count: 7040,
    posts_count: 42,
    stories_count: 3,
    status: "recent",
    last_active_minutes: 190,
  }),
  creator(15, "kaira", "Kaira", {
    age: 27,
    bio: "Natureza, bem-estar e uma rotina criativa longe da pressa.",
    bio_en: "Nature, wellness and a creative routine away from the rush.",
    location: "Vitória, ES",
    category: "Bem-estar",
    category_en: "Wellness",
    subscription_price_cents: 1690,
    subscribers_count: 492,
    likes_count: 6510,
    posts_count: 40,
    stories_count: 2,
    status: "recent",
    last_active_minutes: 240,
  }),
];

const RUNTIME_ENV = import.meta.env ?? {};
const APP_ENV = RUNTIME_ENV.VITE_APP_ENV;
const IS_PRESENTATION_ENV = RUNTIME_ENV.DEV || APP_ENV === "staging";

export const DEMO_MODE =
  IS_PRESENTATION_ENV &&
  (RUNTIME_ENV.VITE_ENABLE_DEMO_CREATORS === "true" ||
    (RUNTIME_ENV.DEV && RUNTIME_ENV.VITE_ENABLE_DEMO_CREATORS !== "false"));

export function getDemoCreator(username: string) {
  return DEMO_CREATORS.find((item) => item.username === username.toLowerCase()) ?? null;
}

export function getDemoCreatorById(userId: string) {
  return DEMO_CREATORS.find((item) => item.user_id === userId) ?? null;
}

export function getDemoAsset(username: string) {
  const exact = getDemoCreator(username);
  if (exact) return exact;
  const seed = Array.from(username).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return DEMO_CREATORS[seed % DEMO_CREATORS.length];
}

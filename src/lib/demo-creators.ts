export interface DemoCreator {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  cover_url: string;
  is_verified: true;
  score: number;
}

/**
 * Adult, fictional, AI-generated people used only in local/investor demos.
 * Production never falls back to this list.
 */
export const DEMO_CREATORS: DemoCreator[] = [
  {
    user_id: "demo-aline",
    username: "aline",
    display_name: "Aline",
    avatar_url: "/demo-creators/aline-investor.webp",
    cover_url: "/demo-creators/aline-investor.webp",
    is_verified: true,
    score: 1500,
  },
  {
    user_id: "demo-duda",
    username: "duda",
    display_name: "Duda",
    avatar_url: "/demo-creators/duda-investor.webp",
    cover_url: "/demo-creators/duda-investor.webp",
    is_verified: true,
    score: 1430,
  },
  {
    user_id: "demo-lara",
    username: "lara",
    display_name: "Lara",
    avatar_url: "/demo-creators/lara-investor.webp",
    cover_url: "/demo-creators/lara-investor.webp",
    is_verified: true,
    score: 1380,
  },
  {
    user_id: "demo-bia",
    username: "bia",
    display_name: "Bia",
    avatar_url: "/demo-creators/bia-investor.webp",
    cover_url: "/demo-creators/bia-investor.webp",
    is_verified: true,
    score: 1320,
  },
  {
    user_id: "demo-camila",
    username: "camila",
    display_name: "Camila",
    avatar_url: "/demo-creators/camila-investor.webp",
    cover_url: "/demo-creators/camila-investor.webp",
    is_verified: true,
    score: 1280,
  },
  {
    user_id: "demo-marina",
    username: "marina",
    display_name: "Marina",
    avatar_url: "/demo-creators/marina-investor.webp",
    cover_url: "/demo-creators/marina-investor.webp",
    is_verified: true,
    score: 1240,
  },
  {
    user_id: "demo-isabela",
    username: "isabela",
    display_name: "Isabela",
    avatar_url: "/demo-creators/isabela-investor.webp",
    cover_url: "/demo-creators/isabela-investor.webp",
    is_verified: true,
    score: 1190,
  },
  {
    user_id: "demo-natalia",
    username: "natalia",
    display_name: "Natália",
    avatar_url: "/demo-creators/natalia-investor.webp",
    cover_url: "/demo-creators/natalia-investor.webp",
    is_verified: true,
    score: 1160,
  },
  {
    user_id: "demo-rafaela",
    username: "rafaela",
    display_name: "Rafaela",
    avatar_url: "/demo-creators/rafaela-investor.webp",
    cover_url: "/demo-creators/rafaela-investor.webp",
    is_verified: true,
    score: 1110,
  },
  {
    user_id: "demo-valentina",
    username: "valentina",
    display_name: "Valentina",
    avatar_url: "/demo-creators/valentina-investor.webp",
    cover_url: "/demo-creators/valentina-investor.webp",
    is_verified: true,
    score: 1070,
  },
  {
    user_id: "demo-carolina",
    username: "carolina",
    display_name: "Carolina",
    avatar_url: "/demo-creators/carolina-investor.webp",
    cover_url: "/demo-creators/carolina-investor.webp",
    is_verified: true,
    score: 1030,
  },
  {
    user_id: "demo-sofia",
    username: "sofia",
    display_name: "Sofia",
    avatar_url: "/demo-creators/sofia-investor.webp",
    cover_url: "/demo-creators/sofia-investor.webp",
    is_verified: true,
    score: 980,
  },
  {
    user_id: "demo-thalia",
    username: "thalia",
    display_name: "Thalia",
    avatar_url: "/demo-creators/thalia-investor.webp",
    cover_url: "/demo-creators/thalia-investor.webp",
    is_verified: true,
    score: 940,
  },
  {
    user_id: "demo-julia",
    username: "julia",
    display_name: "Júlia",
    avatar_url: "/demo-creators/julia-investor.webp",
    cover_url: "/demo-creators/julia-investor.webp",
    is_verified: true,
    score: 900,
  },
  {
    user_id: "demo-kaira",
    username: "kaira",
    display_name: "Kaira",
    avatar_url: "/demo-creators/kaira-investor.webp",
    cover_url: "/demo-creators/kaira-investor.webp",
    is_verified: true,
    score: 860,
  },
];

export const DEMO_MODE =
  import.meta.env.VITE_ENABLE_DEMO_CREATORS === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_CREATORS !== "false");

export function getDemoCreator(username: string) {
  return DEMO_CREATORS.find((creator) => creator.username === username.toLowerCase()) ?? null;
}

export function getDemoAsset(username: string) {
  const exact = getDemoCreator(username);
  if (exact) return exact;
  const seed = Array.from(username).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return DEMO_CREATORS[seed % DEMO_CREATORS.length];
}

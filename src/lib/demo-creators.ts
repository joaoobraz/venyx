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
    avatar_url: "/demo-creators/aline-ai.webp",
    cover_url: "/demo-creators/aline-ai.webp",
    is_verified: true,
    score: 1500,
  },
  {
    user_id: "demo-duda",
    username: "duda",
    display_name: "Duda",
    avatar_url: "/demo-creators/duda-ai.webp",
    cover_url: "/demo-creators/duda-ai.webp",
    is_verified: true,
    score: 1400,
  },
  {
    user_id: "demo-lara",
    username: "lara",
    display_name: "Lara",
    avatar_url: "/demo-creators/lara-ai.webp",
    cover_url: "/demo-creators/lara-ai.webp",
    is_verified: true,
    score: 1300,
  },
  {
    user_id: "demo-bia",
    username: "bia",
    display_name: "Bia",
    avatar_url: "/demo-creators/bia-ai.webp",
    cover_url: "/demo-creators/bia-ai.webp",
    is_verified: true,
    score: 1200,
  },
];

export const DEMO_MODE =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_CREATORS !== "false";

export function getDemoCreator(username: string) {
  return DEMO_CREATORS.find((creator) => creator.username === username.toLowerCase()) ?? null;
}

export function getDemoAsset(username: string) {
  const exact = getDemoCreator(username);
  if (exact) return exact;
  const seed = Array.from(username).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return DEMO_CREATORS[seed % DEMO_CREATORS.length];
}

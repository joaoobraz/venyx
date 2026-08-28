export type DemoWishlistItem = {
  target_type: "creator" | "post";
  target_id: string;
};

const DEFAULT_ITEMS: DemoWishlistItem[] = [
  { target_type: "creator", target_id: "demo-aline" },
  { target_type: "creator", target_id: "demo-camila" },
  { target_type: "post", target_id: "demo-post-duda-editorial" },
  { target_type: "post", target_id: "demo-post-lara-viagem" },
];

function storageKey(userId: string) {
  return `venyx:presentation:wishlist:v1:${userId}`;
}

export function readDemoWishlist(userId: string): DemoWishlistItem[] {
  if (typeof window === "undefined") return DEFAULT_ITEMS;
  const key = storageKey(userId);
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return JSON.parse(existing) as DemoWishlistItem[];
  } catch {
    // Invalid local-only data is replaced by the seed below.
  }
  window.localStorage.setItem(key, JSON.stringify(DEFAULT_ITEMS));
  return DEFAULT_ITEMS;
}

export function toggleDemoWishlist(
  userId: string,
  targetType: DemoWishlistItem["target_type"],
  targetId: string,
) {
  const current = readDemoWishlist(userId);
  const exists = current.some(
    (item) => item.target_type === targetType && item.target_id === targetId,
  );
  const next = exists
    ? current.filter(
        (item) => !(item.target_type === targetType && item.target_id === targetId),
      )
    : [{ target_type: targetType, target_id: targetId }, ...current];
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  window.dispatchEvent(new Event("venyx:presentation:wishlist-changed"));
  return !exists;
}

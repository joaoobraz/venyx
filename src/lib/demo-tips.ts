export interface DemoTip {
  id: string;
  sender_id: string;
  creator_id: string;
  creator_name: string;
  post_id: string | null;
  amount_cents: number;
  message: string | null;
  created_at: string;
}

const STORAGE_VERSION = "v1";
export const DEMO_TIPS_CHANGED_EVENT = "venyx:demo-tips-changed";

function storageKey(userId: string) {
  return `venyx:demo-tips:${STORAGE_VERSION}:${userId}`;
}

export function readDemoTips(userId: string): DemoTip[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]");
    return Array.isArray(value) ? (value as DemoTip[]) : [];
  } catch {
    return [];
  }
}

export function recordDemoTip(input: {
  userId: string;
  creatorId: string;
  creatorName: string;
  postId?: string;
  amountCents: number;
  message?: string;
}) {
  const tip: DemoTip = {
    id: crypto.randomUUID(),
    sender_id: input.userId,
    creator_id: input.creatorId,
    creator_name: input.creatorName,
    post_id: input.postId ?? null,
    amount_cents: input.amountCents,
    message: input.message?.trim() || null,
    created_at: new Date().toISOString(),
  };
  const next = [...readDemoTips(input.userId), tip].slice(-100);
  localStorage.setItem(storageKey(input.userId), JSON.stringify(next));
  window.dispatchEvent(new Event(DEMO_TIPS_CHANGED_EVENT));
  return tip;
}

export function getDemoTipTotal(userId: string) {
  return readDemoTips(userId).reduce((total, tip) => total + tip.amount_cents, 0);
}

import { awardDemoGiftLoyalty } from "./demo-loyalty.ts";

export interface DemoTip {
  id: string;
  sender_id: string;
  sender_name: string;
  creator_id: string;
  creator_name: string;
  post_id: string | null;
  amount_cents: number;
  message: string | null;
  gift_title: string | null;
  payment_status: "paid";
  payment_method: "demo_balance";
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
    return Array.isArray(value)
      ? (value as DemoTip[]).map((tip) => ({
          ...tip,
          sender_name: tip.sender_name ?? "Lead",
          gift_title: tip.gift_title ?? null,
          payment_status: "paid",
          payment_method: "demo_balance",
        }))
      : [];
  } catch {
    return [];
  }
}

export function recordDemoTip(input: {
  userId: string;
  creatorId: string;
  creatorName: string;
  senderName: string;
  postId?: string;
  amountCents: number;
  message?: string;
  giftTitle?: string;
}) {
  const tip: DemoTip = {
    id: crypto.randomUUID(),
    sender_id: input.userId,
    sender_name: input.senderName,
    creator_id: input.creatorId,
    creator_name: input.creatorName,
    post_id: input.postId ?? null,
    amount_cents: input.amountCents,
    message: input.message?.trim() || null,
    gift_title: input.giftTitle?.trim() || null,
    payment_status: "paid",
    payment_method: "demo_balance",
    created_at: new Date().toISOString(),
  };
  const next = [...readDemoTips(input.userId), tip].slice(-100);
  localStorage.setItem(storageKey(input.userId), JSON.stringify(next));
  awardDemoGiftLoyalty({
    userId: input.userId,
    creatorId: input.creatorId,
    creatorName: input.creatorName,
    amountCents: input.amountCents,
    refId: tip.id,
  });
  window.dispatchEvent(new Event(DEMO_TIPS_CHANGED_EVENT));
  return tip;
}

export function getDemoTipTotal(userId: string) {
  return readDemoTips(userId)
    .filter((tip) => tip.payment_status === "paid")
    .reduce((total, tip) => total + tip.amount_cents, 0);
}

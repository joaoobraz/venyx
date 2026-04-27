import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getMyPointsForCreator } from "@/server/loyalty.functions";

export type LoyaltyTier = "bronze" | "silver" | "gold" | "diamond";

export const TIER_META: Record<LoyaltyTier, { label: string; emoji: string; color: string; bg: string }> = {
  bronze:  { label: "Bronze",   emoji: "🥉", color: "text-orange-300",  bg: "bg-orange-500/10 border-orange-500/30" },
  silver:  { label: "Prata",    emoji: "🥈", color: "text-slate-300",   bg: "bg-slate-500/10 border-slate-500/30" },
  gold:    { label: "Ouro",     emoji: "🥇", color: "text-yellow-300",  bg: "bg-yellow-500/10 border-yellow-500/30" },
  diamond: { label: "Diamante", emoji: "💎", color: "text-cyan-300",    bg: "bg-cyan-500/10 border-cyan-500/30" },
};

export function tierFromPoints(points: number): LoyaltyTier {
  if (points >= 5000) return "diamond";
  if (points >= 2000) return "gold";
  if (points >= 500) return "silver";
  return "bronze";
}

export function LoyaltyBadge({
  creatorId,
  showPoints = false,
  className = "",
}: {
  creatorId: string;
  showPoints?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<{ points: number; tier: LoyaltyTier } | null>(null);
  const fn = useServerFn(getMyPointsForCreator);

  useEffect(() => {
    if (!user || user.id === creatorId) return;
    fn({ data: { creatorId } })
      .then((res) => {
        const tier = (res.tier as LoyaltyTier) ?? tierFromPoints(res.points ?? 0);
        setData({ points: res.points ?? 0, tier });
      })
      .catch(() => {});
  }, [user, creatorId, fn]);

  if (!data || data.points === 0) return null;
  const meta = TIER_META[data.tier];

  return (
    <span
      title={`${data.points} pontos com este criador`}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.color} ${className}`}
    >
      <span className="leading-none">{meta.emoji}</span>
      {showPoints ? <span>{data.points}</span> : <span>{meta.label}</span>}
    </span>
  );
}

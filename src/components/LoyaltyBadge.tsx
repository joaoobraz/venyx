import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getMyPointsForCreator } from "@/_server/loyalty.functions";
import { TIER_META, loyaltyTierFromPoints, type LoyaltyTier } from "@/lib/loyalty";

export { TIER_META, type LoyaltyTier } from "@/lib/loyalty";

export function tierFromPoints(points: number): LoyaltyTier {
  return loyaltyTierFromPoints(points);
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

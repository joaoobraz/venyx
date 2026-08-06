import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Crown,
  Gift,
  LockKeyhole,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEMO_LOYALTY_CHANGED_EVENT,
  readDemoLoyalty,
  saveDemoLoyaltyReward,
  setDemoLoyaltyProgram,
  toggleDemoLoyaltyReward,
  type DemoLoyaltyState,
  type DemoRewardType,
} from "@/lib/demo-loyalty";
import { DEMO_CHAT_LEADS, DEMO_CHAT_THREADS } from "@/lib/demo-chat";
import {
  LOYALTY_TIERS,
  TIER_META,
  loyaltyTierFromPoints,
  loyaltyTierRank,
  type LoyaltyTier,
} from "@/lib/loyalty";
import { useI18n } from "@/lib/i18n";

type FanFilter = "all" | "gold_plus" | "vip";

const REWARD_TYPES: Array<{ value: DemoRewardType; label: string }> = [
  { value: "renewal_discount", label: "Desconto na renovação" },
  { value: "ppv_coupon", label: "Cupom para PPV" },
  { value: "exclusive_content", label: "Conteúdo exclusivo" },
  { value: "personal_message", label: "Mensagem personalizada" },
  { value: "early_access", label: "Acesso antecipado" },
  { value: "fan_badge", label: "Selo de fã" },
];

function tierLabel(tier: LoyaltyTier, locale: "pt-BR" | "en") {
  return locale === "en" ? TIER_META[tier].labelEn : TIER_META[tier].label;
}

export function CreatorLoyaltyOperations({ userId }: { userId: string }) {
  const { tr, locale } = useI18n();
  const [state, setState] = useState<DemoLoyaltyState>(() => readDemoLoyalty(userId));
  const [filter, setFilter] = useState<FanFilter>("all");
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardType, setRewardType] = useState<DemoRewardType>("ppv_coupon");
  const [rewardTier, setRewardTier] = useState<LoyaltyTier>("gold");
  const [rewardStock, setRewardStock] = useState("100");

  useEffect(() => {
    const load = () => setState(readDemoLoyalty(userId));
    load();
    window.addEventListener(DEMO_LOYALTY_CHANGED_EVENT, load);
    return () => window.removeEventListener(DEMO_LOYALTY_CHANGED_EVENT, load);
  }, [userId]);

  const fans = useMemo(() => {
    return state.fans
      .filter((fan) => {
        const tier = loyaltyTierFromPoints(fan.globalPoints);
        if (filter === "vip") return tier === "vip";
        if (filter === "gold_plus") return loyaltyTierRank(tier) >= loyaltyTierRank("gold");
        return true;
      })
      .sort((first, second) => second.creatorPoints - first.creatorPoints);
  }, [filter, state.fans]);

  const goldPlusCount = state.fans.filter(
    (fan) => loyaltyTierRank(loyaltyTierFromPoints(fan.globalPoints)) >= loyaltyTierRank("gold"),
  ).length;
  const vipCount = state.fans.filter(
    (fan) => loyaltyTierFromPoints(fan.globalPoints) === "vip",
  ).length;
  const claimedCount = state.program.rewards.reduce(
    (total, reward) => total + reward.redeemedCount,
    0,
  );

  const openRewardDialog = () => {
    setRewardTitle("");
    setRewardDescription("");
    setRewardType("ppv_coupon");
    setRewardTier("gold");
    setRewardStock("100");
    setRewardOpen(true);
  };

  const saveReward = () => {
    const title = rewardTitle.trim();
    const description = rewardDescription.trim();
    const stock = rewardStock.trim() ? Math.floor(Number(rewardStock)) : null;
    if (!title || !description) {
      toast.error(
        tr("Informe o nome e a descrição do benefício.", "Enter a benefit name and description."),
      );
      return;
    }
    if (stock !== null && (!Number.isFinite(stock) || stock < 1)) {
      toast.error(
        tr("O limite precisa ser maior que zero.", "The limit must be greater than zero."),
      );
      return;
    }
    saveDemoLoyaltyReward(userId, {
      title,
      description,
      type: rewardType,
      minimumTier: rewardTier,
      stock,
      active: true,
      expiresAt: null,
    });
    setRewardOpen(false);
    toast.success(tr("Benefício adicionado ao programa.", "Benefit added to the program."));
  };

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [tr("Fãs participantes", "Participating fans"), "327", Users],
          [tr("Fãs Ouro+", "Gold+ fans"), String(82 + goldPlusCount), Crown],
          [tr("VIPs", "VIP fans"), String(11 + vipCount), Crown],
          [
            tr("Benefícios resgatados", "Benefits claimed"),
            claimedCount.toLocaleString("pt-BR"),
            Gift,
          ],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-muted-foreground">{String(label)}</div>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <strong className="mt-2 block text-xl text-foreground">{String(value)}</strong>
          </div>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {tr("Programa de fidelidade", "Loyalty program")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr(
                  "Ative níveis, missões e benefícios para seus assinantes.",
                  "Enable tiers, missions and benefits for your subscribers.",
                )}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${state.program.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}
            >
              {state.program.enabled ? tr("Ativo", "Active") : tr("Pausado", "Paused")}
            </span>
          </div>
          <div className="mt-5 space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
              <div>
                <div className="text-xs font-semibold text-foreground">
                  {tr("Ativar fidelidade", "Enable loyalty")}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {tr(
                    "Pausar mantém pontos e benefícios já resgatados.",
                    "Pausing preserves points and claimed benefits.",
                  )}
                </div>
              </div>
              <Switch
                checked={state.program.enabled}
                onCheckedChange={(enabled) => {
                  setDemoLoyaltyProgram(userId, { enabled });
                  toast.success(
                    enabled
                      ? tr("Fidelidade ativada.", "Loyalty enabled.")
                      : tr("Fidelidade pausada.", "Loyalty paused."),
                  );
                }}
                aria-label={tr("Ativar fidelidade", "Enable loyalty")}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
              <div>
                <div className="text-xs font-semibold text-foreground">
                  {tr("Pontuar interações", "Reward engagement")}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {tr(
                    "Curtidas e comentários: limite protegido de 10 pontos por semana.",
                    "Likes and comments: protected limit of 10 points per week.",
                  )}
                </div>
              </div>
              <Switch
                checked={state.program.interactionPointsEnabled}
                disabled={!state.program.enabled}
                onCheckedChange={(interactionPointsEnabled) =>
                  setDemoLoyaltyProgram(userId, { interactionPointsEnabled })
                }
                aria-label={tr("Pontuar interações", "Reward engagement")}
              />
            </label>
          </div>
        </div>

        <aside className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {tr("Regras protegidas", "Protected rules")}
          </div>
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li>• {tr("R$ 1 confirmado vale 1 ponto.", "Confirmed BRL 1 earns 1 point.")}</li>
            <li>• {tr("Renovação consecutiva ganha +25.", "Consecutive renewal earns +25.")}</li>
            <li>• {tr("PPV confirmado ganha +5 de bônus.", "Confirmed PPV earns +5 bonus.")}</li>
            <li>• {tr("Estornos revertem os pontos.", "Refunds reverse points.")}</li>
            <li>
              •{" "}
              {tr(
                "A modelo não concede pontos manualmente.",
                "Creators cannot grant points manually.",
              )}
            </li>
          </ul>
          <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-3 text-[11px] text-muted-foreground">
            {tr(
              "Lives e produtos físicos serão ativados somente quando esses módulos tiverem confirmação real de participação e entrega.",
              "Lives and physical products will activate only when those modules have real participation and delivery confirmation.",
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {tr("Benefícios por nível", "Benefits by tier")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {tr(
                "Defina vagas e pause qualquer benefício sem apagar o histórico.",
                "Set slots and pause any benefit without deleting history.",
              )}
            </p>
          </div>
          <Button onClick={openRewardDialog} disabled={!state.program.enabled}>
            <Plus className="mr-2 h-4 w-4" /> {tr("Novo benefício", "New benefit")}
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.program.rewards.map((reward) => {
            const meta = TIER_META[reward.minimumTier];
            return (
              <article
                key={reward.id}
                className={`rounded-xl border p-4 ${reward.active ? "border-border bg-card" : "border-border/60 bg-muted/30 opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] font-bold ${meta.bg} ${meta.color}`}
                  >
                    {meta.emoji} {tierLabel(reward.minimumTier, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleDemoLoyaltyReward(userId, reward.id)}
                    className="rounded-full p-1 text-muted-foreground hover:text-primary"
                    aria-label={
                      reward.active
                        ? tr("Pausar benefício", "Pause benefit")
                        : tr("Ativar benefício", "Activate benefit")
                    }
                    title={reward.active ? tr("Pausar", "Pause") : tr("Ativar", "Activate")}
                  >
                    {reward.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
                <h4 className="mt-3 text-sm font-bold text-foreground">{reward.title}</h4>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">
                  {reward.description}
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {reward.redeemedCount} {tr("resgates", "claims")}
                  </span>
                  <span>
                    {reward.stock === null
                      ? tr("Sem limite", "Unlimited")
                      : `${Math.max(0, reward.stock - reward.redeemedCount)} ${tr("vagas", "slots")}`}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Send className="h-4 w-4 text-accent" />
              {tr("Funil de PPV por fidelidade", "Loyalty PPV funnel")}
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {tr(
                "Use um segmento qualificado para oferecer PPVs premium. O preço continua visível ao cliente antes da compra.",
                "Use a qualified segment for premium PPV offers. The price remains visible before purchase.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/chat" search={{ segment: "gold_plus" }}>
                <Target className="mr-2 h-4 w-4" /> {tr("Abrir fãs Ouro+", "Open Gold+ fans")}
              </Link>
            </Button>
            <Button asChild>
              <Link to="/chat" search={{ segment: "vip" }}>
                <Crown className="mr-2 h-4 w-4" /> {tr("Abrir VIPs", "Open VIPs")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {tr("Ranking e segmentos", "Ranking and segments")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {tr(
                "O nível geral não revela gastos nem outras assinaturas.",
                "The global tier does not reveal spending or other subscriptions.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", tr("Todos", "All")],
              ["gold_plus", tr("Ouro+", "Gold+")],
              ["vip", "VIP"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as FanFilter)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {fans.map((fan, index) => {
            const globalTier = loyaltyTierFromPoints(fan.globalPoints);
            const creatorTier = loyaltyTierFromPoints(fan.creatorPoints);
            const globalMeta = TIER_META[globalTier];
            const creatorMeta = TIER_META[creatorTier];
            const leadIndex = DEMO_CHAT_LEADS.findIndex((lead) => lead.user_id === fan.userId);
            const threadId = leadIndex >= 0 ? DEMO_CHAT_THREADS[leadIndex]?.id : undefined;
            return (
              <div
                key={fan.userId}
                className="grid gap-3 border-b border-border/60 px-4 py-3 last:border-0 sm:grid-cols-[32px_1fr_auto_auto] sm:items-center"
              >
                <div className="text-center text-xs font-bold text-muted-foreground">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm text-foreground">{fan.displayName}</strong>
                    <span className="text-[10px] text-muted-foreground">@{fan.username}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${globalMeta.bg} ${globalMeta.color}`}
                    >
                      Venyx {globalMeta.emoji} {tierLabel(globalTier, locale)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${creatorMeta.bg} ${creatorMeta.color}`}
                    >
                      {creatorMeta.emoji} {tierLabel(creatorTier, locale)}{" "}
                      {tr("com você", "with you")}
                    </span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs font-bold text-foreground">
                    {fan.creatorPoints.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {fan.streakMonths} {tr("meses", "months")}
                  </div>
                </div>
                {threadId ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/chat" search={{ thread: threadId }}>
                      <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> {tr("Chat", "Chat")}
                    </Link>
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("Novo benefício", "New benefit")}</DialogTitle>
            <DialogDescription>
              {tr(
                "O benefício não usa pontos como moeda e precisa ter uma entrega clara.",
                "The benefit does not spend points and must have a clear delivery.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block text-xs text-muted-foreground">
              {tr("Nome", "Name")}
              <Input
                value={rewardTitle}
                onChange={(event) => setRewardTitle(event.target.value)}
                maxLength={80}
                className="mt-1"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              {tr("Descrição da entrega", "Delivery description")}
              <Textarea
                value={rewardDescription}
                onChange={(event) => setRewardDescription(event.target.value)}
                maxLength={240}
                rows={3}
                className="mt-1 resize-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted-foreground">
                {tr("Tipo", "Type")}
                <select
                  value={rewardType}
                  onChange={(event) => setRewardType(event.target.value as DemoRewardType)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  {REWARD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                {tr("Nível mínimo", "Minimum tier")}
                <select
                  value={rewardTier}
                  onChange={(event) => setRewardTier(event.target.value as LoyaltyTier)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  {LOYALTY_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {TIER_META[tier].emoji} {tierLabel(tier, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs text-muted-foreground">
              {tr("Vagas (deixe vazio para ilimitado)", "Slots (leave empty for unlimited)")}
              <Input
                type="number"
                min="1"
                value={rewardStock}
                onChange={(event) => setRewardStock(event.target.value)}
                className="mt-1"
              />
            </label>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-muted-foreground">
              <LockKeyhole className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
              {tr(
                "Dinheiro, rendimento garantido e benefícios fora da Venyx não são permitidos.",
                "Cash, guaranteed returns and off-platform benefits are not allowed.",
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRewardOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={saveReward}>
              <BadgeCheck className="mr-2 h-4 w-4" /> {tr("Salvar benefício", "Save benefit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

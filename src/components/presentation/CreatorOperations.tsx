import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Gift,
  Info,
  Pause,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { DEMO_SUBSCRIPTIONS_CHANGED_EVENT, readDemoSubscriptions } from "@/lib/demo-content";
import { DEMO_TIPS_CHANGED_EVENT, readDemoTips } from "@/lib/demo-tips";
import {
  DEMO_OPERATIONS_CHANGED_EVENT,
  createDemoId,
  readDemoOperations,
  updateDemoOperations,
  type DemoCoupon,
  type DemoOperationsState,
} from "@/lib/demo-operations";
import {
  dateInputValue,
  resolveAnalyticsPeriod,
  summarizeCreatorAnalytics,
  validateAnalyticsRange,
  type AnalyticsDateRange,
  type AnalyticsPeriodPreset,
} from "@/lib/demo-creator-analytics";
import { distributeVisitSources } from "@/lib/visit-attribution";

type PlanMonths = 1 | 3 | 6 | 12;
type CouponKind = "fixed" | "discount" | "trial";

const PLAN_MONTHS: PlanMonths[] = [1, 3, 6, 12];

type CreatorSection =
  | "overview"
  | "posts"
  | "analytics"
  | "wallet"
  | "subscriptions"
  | "links"
  | "gifts"
  | "mailing"
  | "coupons"
  | "moderation";

function money(cents: number, locale: "pt-BR" | "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function count(value: number, locale: "pt-BR" | "en") {
  return value.toLocaleString(locale === "en" ? "en-US" : "pt-BR");
}

function shortDate(value: string, locale: "pt-BR" | "en") {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale === "en" ? "en-US" : "pt-BR");
}

function percent(value: number, total: number, locale: "pt-BR" | "en") {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return `${percentage.toLocaleString(locale === "en" ? "en-US" : "pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function MetricRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground">{label}</div>
          <strong className="mt-1 block text-lg text-foreground">{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function CreatorOperations({ section, userId }: { section: string; userId: string }) {
  const { tr, locale } = useI18n();
  const [operations, setOperations] = useState<DemoOperationsState>(() =>
    readDemoOperations(userId),
  );
  const [tips, setTips] = useState(() => readDemoTips(userId));
  const [subscriptionCount, setSubscriptionCount] = useState(
    () => readDemoSubscriptions(userId).length,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [postStatus, setPostStatus] = useState<"draft" | "scheduled" | "published">("draft");
  const [plansDialogOpen, setPlansDialogOpen] = useState(false);
  const [planBasePrice, setPlanBasePrice] = useState("49.00");
  const [planDiscounts, setPlanDiscounts] = useState<Record<PlanMonths, number>>({
    1: 0,
    3: 15,
    6: 25,
    12: 30,
  });
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("PRIMEIRAS10");
  const [couponKind, setCouponKind] = useState<CouponKind>("discount");
  const [couponBenefit, setCouponBenefit] = useState("20");
  const [couponDuration, setCouponDuration] = useState<PlanMonths>(1);
  const [couponSlots, setCouponSlots] = useState("10");
  const [couponNewSubscribersOnly, setCouponNewSubscribersOnly] = useState(true);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriodPreset>("last_30_days");
  const [customDraft, setCustomDraft] = useState<AnalyticsDateRange>(() =>
    resolveAnalyticsPeriod("last_30_days"),
  );
  const [customRange, setCustomRange] = useState<AnalyticsDateRange>(() =>
    resolveAnalyticsPeriod("last_30_days"),
  );
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      setOperations(readDemoOperations(userId));
      setTips(readDemoTips(userId));
      setSubscriptionCount(readDemoSubscriptions(userId).length);
    };
    load();
    window.addEventListener(DEMO_OPERATIONS_CHANGED_EVENT, load);
    window.addEventListener(DEMO_TIPS_CHANGED_EVENT, load);
    window.addEventListener(DEMO_SUBSCRIPTIONS_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener(DEMO_OPERATIONS_CHANGED_EVENT, load);
      window.removeEventListener(DEMO_TIPS_CHANGED_EVENT, load);
      window.removeEventListener(DEMO_SUBSCRIPTIONS_CHANGED_EVENT, load);
    };
  }, [userId]);

  const update = (fn: (state: DemoOperationsState) => DemoOperationsState) => {
    setOperations(updateDemoOperations(userId, fn));
  };

  const paidTips = tips.filter((item) => item.payment_status === "paid");
  const tipCents = paidTips.reduce((total, item) => total + item.amount_cents, 0);
  const ppvCents = operations.purchases
    .filter((item) => item.kind === "ppv" && item.status === "paid")
    .reduce((total, item) => total + item.amount_cents, 0);
  const subscriptionCents = operations.purchases
    .filter((item) => item.kind === "subscription" && item.status === "paid")
    .reduce((total, item) => total + item.amount_cents, 0);

  const selectedAnalyticsRange = useMemo(
    () => (analyticsPeriod === "custom" ? customRange : resolveAnalyticsPeriod(analyticsPeriod)),
    [analyticsPeriod, customRange],
  );
  const analytics = useMemo(
    () =>
      summarizeCreatorAnalytics({
        range: selectedAnalyticsRange,
        purchases: operations.purchases,
        tips,
      }),
    [operations.purchases, selectedAnalyticsRange, tips],
  );
  const analyticsRows = useMemo<Array<[string, string]>>(
    () => [
      [tr("Faturamento", "Revenue"), money(analytics.revenueCents, locale)],
      [tr("Novos assinantes", "New subscribers"), count(analytics.newSubscribers, locale)],
      [tr("Cancelamentos", "Cancellations"), count(analytics.cancellations, locale)],
      [tr("Visitas", "Visits"), count(analytics.visits, locale)],
      [
        tr("Conversão", "Conversion"),
        `${analytics.conversionRate.toLocaleString(locale === "en" ? "en-US" : "pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`,
      ],
      [tr("PPVs vendidos", "PPVs sold"), count(analytics.ppvSold, locale)],
      [tr("Mimos recebidos", "Tips received"), count(analytics.tipsReceived, locale)],
      [tr("Mensagens", "Messages"), count(analytics.messages, locale)],
      [
        tr("Renovação de assinaturas", "Subscription renewal"),
        `${analytics.renewalRate.toLocaleString(locale === "en" ? "en-US" : "pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`,
      ],
    ],
    [analytics, locale, tr],
  );

  const applyCustomRange = () => {
    const error = validateAnalyticsRange(customDraft);
    if (error) {
      const message =
        error === "inverted"
          ? tr(
              "A data inicial não pode ser posterior à data final.",
              "Start date cannot be after end date.",
            )
          : error === "future"
            ? tr("A data final não pode estar no futuro.", "End date cannot be in the future.")
            : tr("Informe as duas datas do período.", "Enter both dates for the period.");
      setCustomRangeError(message);
      return;
    }
    setCustomRange(customDraft);
    setCustomRangeError(null);
  };

  const rows = useMemo<Array<[string, string]>>(() => {
    switch (section as CreatorSection) {
      case "posts":
        return [
          [
            tr("Publicadas", "Published"),
            String(
              37 + operations.creatorPosts.filter((item) => item.status === "published").length,
            ),
          ],
          [
            tr("Agendadas", "Scheduled"),
            String(
              3 + operations.creatorPosts.filter((item) => item.status === "scheduled").length,
            ),
          ],
          [
            tr("Rascunhos", "Drafts"),
            String(2 + operations.creatorPosts.filter((item) => item.status === "draft").length),
          ],
        ];
      case "analytics":
        return analyticsRows;
      case "wallet":
        return [
          [tr("Assinaturas", "Subscriptions"), money(1_246_000 + subscriptionCents, locale)],
          ["PPV", money(418_000 + ppvCents, locale)],
          [tr("Mimos", "Tips"), money(210_000 + tipCents, locale)],
        ];
      case "subscriptions":
        return [
          [tr("Assinantes ativos", "Active subscribers"), String(323 + subscriptionCount)],
          [tr("Renovação automática", "Automatic renewal"), "87,1%"],
          [
            tr("Receita recorrente", "Recurring revenue"),
            money(1_246_000 + subscriptionCents, locale),
          ],
        ];
      case "links":
        return [
          [
            tr("Cliques", "Clicks"),
            operations.links
              .reduce((total, item) => total + item.clicks, 0)
              .toLocaleString(locale === "en" ? "en-US" : "pt-BR"),
          ],
          [tr("Cadastros", "Sign-ups"), "214"],
          [tr("Conversão", "Conversion"), "11,6%"],
        ];
      case "gifts":
        return [
          [
            tr("Mimos ativos", "Active gifts"),
            String(operations.giftItems.filter((item) => item.active).length),
          ],
          [
            tr("Mimos recebidos", "Gifts received"),
            String(operations.giftItems.reduce((total, item) => total + item.received_count, 0)),
          ],
          [
            tr("Valor simbólico", "Symbolic value"),
            money(
              operations.giftItems.reduce(
                (total, item) => total + item.value_cents * item.received_count,
                0,
              ),
              locale,
            ),
          ],
        ];
      case "mailing":
        return [
          [tr("Campanhas", "Campaigns"), String(operations.campaigns.length)],
          [tr("Taxa de abertura", "Open rate"), "62%"],
          [tr("Taxa de cliques", "Click rate"), "18%"],
        ];
      case "coupons":
        return [
          [
            tr("Cupons ativos", "Active coupons"),
            String(operations.coupons.filter((item) => item.active).length),
          ],
          [
            tr("Usos no mês", "Uses this month"),
            String(operations.coupons.reduce((total, item) => total + item.uses, 0)),
          ],
          [tr("Conversão", "Conversion"), "8,4%"],
        ];
      case "moderation":
        return [
          [
            tr("Comentários retidos", "Held comments"),
            String(operations.creatorComments.filter((item) => item.status === "pending").length),
          ],
          [tr("Palavras bloqueadas", "Blocked words"), "8"],
          [tr("Usuários bloqueados", "Blocked users"), "3"],
        ];
      default:
        return analyticsRows;
    }
  }, [
    analyticsRows,
    locale,
    operations,
    ppvCents,
    section,
    subscriptionCents,
    subscriptionCount,
    tipCents,
    tr,
  ]);

  const showAnalyticsPeriod = section === "overview" || section === "analytics";
  const selectedRangeLabel = `${shortDate(selectedAnalyticsRange.startDate, locale)} — ${shortDate(
    selectedAnalyticsRange.endDate,
    locale,
  )}`;
  const visitSources = useMemo(() => distributeVisitSources(analytics.visits), [analytics.visits]);
  const visitSourceItems = useMemo(
    () =>
      [
        {
          id: "social",
          title: tr("Instagram e redes sociais", "Instagram and social networks"),
          description: tr(
            "UTM ou referência de Instagram, TikTok e outras redes reconhecidas.",
            "UTM or referrer from Instagram, TikTok and other recognized networks.",
          ),
        },
        {
          id: "venyx_search",
          title: tr("Busca da Venyx", "Venyx search"),
          description: tr(
            "Visita iniciada na busca interna da plataforma.",
            "Visit started from the platform's internal search.",
          ),
        },
        {
          id: "venyx_links",
          title: "Venyx Links",
          description: tr(
            "Clique originado na página de links personalizada da modelo.",
            "Click from the creator's customized links page.",
          ),
        },
        {
          id: "creator_links",
          title: tr("Links divulgados pela modelo", "Links shared by the creator"),
          description: tr(
            "Link identificado como divulgação própria da modelo.",
            "Link identified as the creator's own promotion.",
          ),
        },
        {
          id: "campaigns",
          title: tr("Campanhas", "Campaigns"),
          description: tr(
            "Parâmetros utm_campaign, campaign ou campaign_id.",
            "utm_campaign, campaign or campaign_id parameters.",
          ),
        },
        {
          id: "coupons",
          title: tr("Cupons", "Coupons"),
          description: tr(
            "Acesso por link de cupom ou com parâmetro de cupom.",
            "Access through a coupon link or coupon parameter.",
          ),
        },
        {
          id: "direct",
          title: tr("Acessos diretos", "Direct access"),
          description: tr(
            "Sem UTM e sem referência externa identificável.",
            "No UTM and no identifiable external referrer.",
          ),
        },
        {
          id: "other",
          title: tr("Outros sites", "Other websites"),
          description: tr(
            "Referência externa que não pertence a uma origem reconhecida.",
            "External referrer that does not belong to a recognized source.",
          ),
        },
      ].map((item) => {
        const visits = visitSources[item.id as keyof typeof visitSources];
        return {
          ...item,
          meta: `${count(visits, locale)} ${tr("visitas", "visits")} · ${percent(visits, analytics.visits, locale)} · ${item.description}`,
          active: true,
        };
      }),
    [analytics.visits, locale, tr, visitSources],
  );

  const config = (() => {
    switch (section as CreatorSection) {
      case "posts":
        return {
          button: tr("Nova publicação", "New post"),
          title: tr("Criar publicação", "Create post"),
          name: tr("Título da publicação", "Post title"),
          value: "",
        };
      case "wallet":
        return {
          button: tr("Solicitar saque", "Request payout"),
          title: tr("Saque demonstrativo", "Demo payout"),
          name: "",
          value: tr("Valor do saque (R$)", "Payout amount (BRL)"),
        };
      case "links":
        return {
          button: tr("Novo link", "New link"),
          title: tr("Criar link", "Create link"),
          name: tr("Título do link", "Link title"),
          value: tr("Final do endereço", "URL slug"),
        };
      case "gifts":
        return {
          button: tr("Novo mimo", "New gift"),
          title: tr("Criar mimo simbólico", "Create symbolic gift"),
          name: tr("Nome do mimo", "Gift name"),
          value: tr("Valor (R$)", "Value (BRL)"),
        };
      case "mailing":
        return {
          button: tr("Nova campanha", "New campaign"),
          title: tr("Criar campanha", "Create campaign"),
          name: tr("Título da campanha", "Campaign title"),
          value: tr("Destinatários", "Recipients"),
        };
      default:
        return null;
    }
  })();

  const submit = () => {
    const now = new Date().toISOString();
    if (section !== "wallet" && !name.trim()) {
      toast.error(tr("Preencha o campo principal.", "Fill in the main field."));
      return;
    }
    if (section === "wallet") {
      const cents = Math.round(Number(value.replace(",", ".")) * 100);
      if (!cents || cents < 100) {
        toast.error(tr("Informe um valor válido.", "Enter a valid amount."));
        return;
      }
      update((state) => ({
        ...state,
        payouts: [
          { id: createDemoId("payout"), amount_cents: cents, status: "pending", created_at: now },
          ...state.payouts,
        ],
      }));
    } else if (section === "posts") {
      update((state) => ({
        ...state,
        creatorPosts: [
          {
            id: createDemoId("post"),
            title: name.trim(),
            status: postStatus,
            views: 0,
            created_at: now,
          },
          ...state.creatorPosts,
        ],
      }));
    } else if (section === "links") {
      update((state) => ({
        ...state,
        links: [
          {
            id: createDemoId("link"),
            title: name.trim(),
            slug:
              value.trim().replace(/^\/+/, "") || name.trim().toLowerCase().replace(/\s+/g, "-"),
            clicks: 0,
            active: true,
          },
          ...state.links,
        ],
      }));
    } else if (section === "gifts") {
      const cents = Math.round(Number(value.replace(",", ".")) * 100);
      if (!cents || cents < 100)
        return toast.error(tr("Informe um valor válido.", "Enter a valid value."));
      update((state) => ({
        ...state,
        giftItems: [
          {
            id: createDemoId("gift"),
            title: name.trim(),
            emoji: "🎁",
            value_cents: cents,
            received_count: 0,
            active: true,
          },
          ...state.giftItems,
        ],
      }));
    } else if (section === "mailing") {
      update((state) => ({
        ...state,
        campaigns: [
          {
            id: createDemoId("campaign"),
            title: name.trim(),
            recipients: Math.max(1, Number(value) || 326),
            status: "draft",
            created_at: now,
          },
          ...state.campaigns,
        ],
      }));
    }
    setName("");
    setValue("");
    setPostStatus("draft");
    setDialogOpen(false);
    toast.success(tr("Ação salva nesta demonstração.", "Action saved in this demo."));
  };

  const planLabel = (months: PlanMonths) => {
    if (months === 1) return tr("Mensal", "Monthly");
    if (months === 3) return tr("Trimestral", "Quarterly");
    if (months === 6) return tr("Semestral", "Semiannual");
    return tr("Anual", "Annual");
  };

  const openPlansConfiguration = () => {
    const monthly = operations.plans.find((plan) => plan.months === 1);
    if (monthly) setPlanBasePrice((monthly.price_cents / 100).toFixed(2));
    setPlanDiscounts((current) => {
      const next = { ...current };
      for (const plan of operations.plans) next[plan.months] = plan.discount_percent;
      next[1] = 0;
      return next;
    });
    setPlansDialogOpen(true);
  };

  const savePlanConfiguration = () => {
    const baseCents = Math.round(Number(planBasePrice.replace(",", ".")) * 100);
    if (!Number.isFinite(baseCents) || baseCents < 100) {
      toast.error(tr("Informe um valor mensal válido.", "Enter a valid monthly price."));
      return;
    }
    update((state) => ({
      ...state,
      plans: PLAN_MONTHS.map((months) => {
        const current = state.plans.find((plan) => plan.months === months);
        const discount = months === 1 ? 0 : Math.min(90, Math.max(0, planDiscounts[months]));
        return {
          id: current?.id ?? `plan-${months}`,
          name: planLabel(months),
          months,
          price_cents: Math.round(baseCents * (1 - discount / 100)),
          discount_percent: discount,
          subscribers: current?.subscribers ?? 0,
          active: true,
        };
      }),
    }));
    setPlansDialogOpen(false);
    toast.success(tr("Tabela de assinatura atualizada.", "Subscription pricing updated."));
  };

  const openCouponCreation = () => {
    setCouponCode(`OFERTA${Math.floor(100 + Math.random() * 900)}`);
    setCouponKind("discount");
    setCouponBenefit("20");
    setCouponDuration(1);
    setCouponSlots("10");
    setCouponNewSubscribersOnly(true);
    setCouponDialogOpen(true);
  };

  const saveCoupon = () => {
    const code = couponCode.trim().toUpperCase().replace(/\s+/g, "");
    const parsedSlots = Math.floor(Number(couponSlots) || 0);
    const slots = Math.max(1, parsedSlots);
    const benefitValue = Number(couponBenefit.replace(",", "."));
    if (!code) {
      toast.error(tr("Informe o código do cupom.", "Enter the coupon code."));
      return;
    }
    if (parsedSlots < 1) {
      toast.error(tr("Informe a quantidade de vagas.", "Enter the number of slots."));
      return;
    }

    const coupon: DemoCoupon = {
      id: createDemoId("coupon"),
      code,
      kind: couponKind,
      duration_months: couponKind === "trial" ? 1 : couponDuration,
      uses: 0,
      max_uses: slots,
      new_subscribers_only: couponNewSubscribersOnly,
      active: true,
    };
    if (couponKind === "discount") {
      if (benefitValue < 1 || benefitValue > 90) {
        toast.error(
          tr("O desconto deve ficar entre 1% e 90%.", "Discount must be between 1% and 90%."),
        );
        return;
      }
      coupon.discount_percent = Math.round(benefitValue);
    } else if (couponKind === "fixed") {
      if (benefitValue < 1) {
        toast.error(
          tr("O preço promocional mínimo é R$ 1,00.", "Minimum promotional price is BRL 1.00."),
        );
        return;
      }
      coupon.fixed_price_cents = Math.round(benefitValue * 100);
    } else {
      if (benefitValue < 1 || benefitValue > 30) {
        toast.error(tr("O teste pode ter de 1 a 30 dias.", "Trial can last from 1 to 30 days."));
        return;
      }
      coupon.trial_days = Math.round(benefitValue);
    }

    update((state) => ({ ...state, coupons: [coupon, ...state.coupons] }));
    setCouponDialogOpen(false);
    toast.success(tr("Cupom criado com limite de vagas.", "Coupon created with a slot limit."));
  };

  const setCollectionStatus = (
    collection: "plans" | "links" | "giftItems" | "coupons",
    itemId: string,
  ) => {
    update((state) => ({
      ...state,
      [collection]: state[collection].map((item) =>
        item.id === itemId ? { ...item, active: !item.active } : item,
      ),
    }));
  };

  return (
    <>
      {showAnalyticsPeriod && (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CalendarDays className="h-5 w-5 text-primary" />
                {tr("Período dos indicadores", "Metrics period")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr(
                  "Um único filtro atualiza todos os indicadores e a origem das visitas.",
                  "One filter updates every metric and the traffic sources.",
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1 lg:items-end">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {tr("Período aplicado", "Applied period")}
              </span>
              <strong className="text-sm text-foreground">{selectedRangeLabel}</strong>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_1fr]">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {tr("Selecionar período", "Select period")}
              </label>
              <Select
                value={analyticsPeriod}
                onValueChange={(next) => {
                  setAnalyticsPeriod(next as AnalyticsPeriodPreset);
                  setCustomRangeError(null);
                }}
              >
                <SelectTrigger aria-label={tr("Selecionar período", "Select period")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{tr("Hoje", "Today")}</SelectItem>
                  <SelectItem value="yesterday">{tr("Ontem", "Yesterday")}</SelectItem>
                  <SelectItem value="last_7_days">{tr("Últimos 7 dias", "Last 7 days")}</SelectItem>
                  <SelectItem value="last_30_days">
                    {tr("Últimos 30 dias", "Last 30 days")}
                  </SelectItem>
                  <SelectItem value="last_60_days">
                    {tr("Últimos 60 dias", "Last 60 days")}
                  </SelectItem>
                  <SelectItem value="last_90_days">
                    {tr("Últimos 90 dias", "Last 90 days")}
                  </SelectItem>
                  <SelectItem value="custom">
                    {tr("Período personalizado", "Custom period")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {analyticsPeriod === "custom" && (
              <div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <div>
                    <label
                      htmlFor="analytics-start-date"
                      className="mb-1.5 block text-xs font-medium text-muted-foreground"
                    >
                      {tr("Data inicial", "Start date")}
                    </label>
                    <Input
                      id="analytics-start-date"
                      aria-label={tr("Data inicial", "Start date")}
                      type="date"
                      value={customDraft.startDate}
                      max={customDraft.endDate || dateInputValue(new Date())}
                      onInput={(event) =>
                        setCustomDraft((current) => ({
                          ...current,
                          startDate: (event.target as HTMLInputElement).value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="analytics-end-date"
                      className="mb-1.5 block text-xs font-medium text-muted-foreground"
                    >
                      {tr("Data final", "End date")}
                    </label>
                    <Input
                      id="analytics-end-date"
                      aria-label={tr("Data final", "End date")}
                      type="date"
                      value={customDraft.endDate}
                      min={customDraft.startDate}
                      max={dateInputValue(new Date())}
                      onInput={(event) =>
                        setCustomDraft((current) => ({
                          ...current,
                          endDate: (event.target as HTMLInputElement).value,
                        }))
                      }
                    />
                  </div>
                  <Button type="button" onClick={applyCustomRange}>
                    {tr("Aplicar", "Apply")}
                  </Button>
                </div>
                {customRangeError && (
                  <p className="mt-2 text-xs font-medium text-destructive">{customRangeError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <MetricRows rows={rows} />
      {config && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            {section === "wallet" ? (
              <Banknote className="mr-2 h-4 w-4" />
            ) : section === "gifts" ? (
              <Gift className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {config.button}
          </Button>
        </div>
      )}
      {section === "subscriptions" && (
        <div className="mt-4 flex justify-end">
          <Button onClick={openPlansConfiguration}>
            <Plus className="mr-2 h-4 w-4" />
            {tr("Configurar preços", "Configure pricing")}
          </Button>
        </div>
      )}
      {section === "coupons" && (
        <div className="mt-4 flex justify-end">
          <Button onClick={openCouponCreation}>
            <Plus className="mr-2 h-4 w-4" />
            {tr("Novo cupom", "New coupon")}
          </Button>
        </div>
      )}

      {section === "posts" && (
        <OperationList
          title={tr("Conteúdos", "Content")}
          items={operations.creatorPosts.map((item) => ({
            id: item.id,
            title: item.title,
            meta:
              item.status === "published"
                ? `${item.views.toLocaleString(locale === "en" ? "en-US" : "pt-BR")} ${tr("visualizações", "views")}`
                : item.status === "archived"
                  ? tr("Arquivada e oculta do perfil", "Archived and hidden from profile")
                  : tr(
                      item.status === "scheduled" ? "Agendada" : "Rascunho",
                      item.status === "scheduled" ? "Scheduled" : "Draft",
                    ),
            active: item.status === "published",
            action:
              item.status !== "published"
                ? {
                    label: tr(
                      item.status === "archived" ? "Restaurar" : "Publicar",
                      item.status === "archived" ? "Restore" : "Publish",
                    ),
                    onClick: () =>
                      update((state) => ({
                        ...state,
                        creatorPosts: state.creatorPosts.map((post) =>
                          post.id === item.id ? { ...post, status: "published" } : post,
                        ),
                      })),
                  }
                : undefined,
          }))}
        />
      )}
      {section === "analytics" && (
        <>
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Info className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {tr("Como a origem é medida", "How traffic source is measured")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {tr(
                    "Cada visita recebe uma única origem no momento da entrada. A evidência mais específica vence, evitando contar a mesma visita em duas categorias.",
                    "Each visit receives one source when it enters. The most specific evidence wins, preventing the same visit from being counted twice.",
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              <strong className="text-foreground">{tr("Prioridade:", "Priority:")}</strong>{" "}
              {tr(
                "cupom → campanha/UTM → Venyx Links → busca interna → link da modelo → rede social/referência → outro site → direto.",
                "coupon → campaign/UTM → Venyx Links → internal search → creator link → social/referrer → other website → direct.",
              )}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
              {tr(
                "Por privacidade, são guardados a categoria, o domínio de referência e os identificadores UTM; a URL completa de origem e o código do cupom não são armazenados nas métricas.",
                "For privacy, the category, referrer domain and UTM identifiers are stored; the full source URL and coupon code are not stored in analytics.",
              )}
            </p>
          </div>
          <OperationList
            title={tr("Origem das visitas", "Traffic sources")}
            items={visitSourceItems}
          />
        </>
      )}
      {section === "subscriptions" && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">
              {tr("Uma única tabela de assinatura.", "One subscription pricing table.")}
            </strong>{" "}
            {tr(
              "O mensal define o preço-base; trimestral, semestral e anual são calculados pelos descontos escolhidos.",
              "Monthly defines the base price; quarterly, semiannual and annual are calculated from the chosen discounts.",
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PLAN_MONTHS.map((months) => {
              const plan = operations.plans.find((item) => item.months === months);
              if (!plan) return null;
              return (
                <div key={months} className="rounded-xl border border-border bg-background p-4">
                  <div className="text-sm font-semibold text-foreground">{planLabel(months)}</div>
                  <div className="mt-1 text-xl font-bold text-foreground">
                    {money(plan.price_cents * months, locale)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {months === 1
                      ? tr("Preço-base mensal", "Monthly base price")
                      : `${plan.discount_percent}% ${tr("de desconto", "discount")} · ${money(plan.price_cents, locale)}/${tr("mês", "month")}`}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {plan.subscribers} {tr("assinantes", "subscribers")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {section === "links" && (
        <OperationList
          title={tr("Links compartilhados", "Shared links")}
          items={operations.links.map((item) => ({
            id: item.id,
            title: item.title,
            meta: `venyx.com/${item.slug} · ${item.clicks} ${tr("cliques", "clicks")}`,
            active: item.active,
            action: {
              label: item.active ? tr("Pausar", "Pause") : tr("Ativar", "Activate"),
              onClick: () => setCollectionStatus("links", item.id),
            },
          }))}
        />
      )}
      {section === "gifts" && (
        <>
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <strong>{tr("Catálogo simbólico:", "Symbolic catalog:")}</strong>{" "}
            {tr(
              "nenhum produto físico é comprado ou enviado; a modelo recebe o valor líquido na carteira.",
              "no physical product is purchased or shipped; the creator receives the net amount in her wallet.",
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" asChild>
              <a href="/gifts/aline" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                {tr("Testar como cliente", "Test as client")}
              </a>
            </Button>
          </div>
          <OperationList
            title={tr("Lista de Mimos", "Gift List")}
            items={operations.giftItems.map((item) => ({
              id: item.id,
              title: `${item.emoji} ${item.title}`,
              meta: `${money(item.value_cents, locale)} · ${item.received_count} ${tr("recebidos", "received")}`,
              active: item.active,
              action: {
                label: item.active ? tr("Pausar", "Pause") : tr("Ativar", "Activate"),
                onClick: () => setCollectionStatus("giftItems", item.id),
              },
            }))}
          />
        </>
      )}
      {section === "mailing" && (
        <OperationList
          title={tr("Campanhas", "Campaigns")}
          items={operations.campaigns.map((item) => ({
            id: item.id,
            title: item.title,
            meta: `${item.recipients} ${tr("destinatários", "recipients")} · ${item.status}`,
            active: item.status === "sent",
            action:
              item.status !== "sent"
                ? {
                    label: tr("Simular envio", "Simulate send"),
                    onClick: () => {
                      update((state) => ({
                        ...state,
                        campaigns: state.campaigns.map((campaign) =>
                          campaign.id === item.id ? { ...campaign, status: "sent" } : campaign,
                        ),
                      }));
                      toast.success(
                        tr("Envio simulado concluído.", "Simulated delivery completed."),
                      );
                    },
                  }
                : undefined,
          }))}
        />
      )}
      {section === "coupons" && (
        <>
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">
              {tr("Vagas protegidas:", "Protected slots:")}
            </strong>{" "}
            {tr(
              "cada Pix pendente reserva uma vaga até expirar. Assim, uma promoção para 10 pessoas nunca aceita a 11ª.",
              "each pending Pix reserves a slot until it expires, so a 10-person offer never accepts an 11th buyer.",
            )}
          </div>
          <OperationList
            title={tr("Cupons e ofertas", "Coupons and offers")}
            items={operations.coupons.map((item) => {
              const benefit =
                item.kind === "fixed"
                  ? `${tr("Preço", "Price")} ${money(item.fixed_price_cents ?? 0, locale)}`
                  : item.kind === "trial"
                    ? `${item.trial_days} ${tr("dias grátis", "free days")}`
                    : `${item.discount_percent}% ${tr("de desconto", "discount")}`;
              return {
                id: item.id,
                title: item.code,
                meta: `${benefit} · ${item.uses}/${item.max_uses} ${tr("vagas usadas", "slots used")} · ${tr("Link de divulgação", "Promotion link")}: /c/${item.code}`,
                active: item.active,
                action: {
                  label: item.active ? tr("Pausar", "Pause") : tr("Ativar", "Activate"),
                  onClick: () => setCollectionStatus("coupons", item.id),
                },
                actions: [
                  {
                    label: tr("Copiar link", "Copy link"),
                    icon: Copy,
                    onClick: async () => {
                      const link = `${window.location.origin}/c/${encodeURIComponent(item.code)}`;
                      await navigator.clipboard.writeText(link);
                      toast.success(tr("Link de divulgação copiado!", "Promotion link copied!"));
                    },
                  },
                ],
              };
            })}
          />
        </>
      )}
      {section === "moderation" && (
        <OperationList
          title={tr("Fila de comentários", "Comment queue")}
          items={operations.creatorComments
            .filter((item) => item.status === "pending")
            .map((item) => ({
              id: item.id,
              title: item.username,
              meta: `${item.reason}: ${item.body}`,
              active: false,
              actions: [
                {
                  label: tr("Aprovar", "Approve"),
                  icon: Check,
                  onClick: () =>
                    update((state) => ({
                      ...state,
                      creatorComments: state.creatorComments.map((comment) =>
                        comment.id === item.id ? { ...comment, status: "approved" } : comment,
                      ),
                    })),
                },
                {
                  label: tr("Remover", "Remove"),
                  icon: Trash2,
                  onClick: () =>
                    update((state) => ({
                      ...state,
                      creatorComments: state.creatorComments.map((comment) =>
                        comment.id === item.id ? { ...comment, status: "removed" } : comment,
                      ),
                    })),
                },
              ],
            }))}
          empty={tr("Nenhum comentário aguardando revisão.", "No comments awaiting review.")}
        />
      )}
      {section === "wallet" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 lg:col-span-2">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {tr("Conta de saque protegida", "Protected payout account")}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(
                "O CPF do titular precisa ser o mesmo CPF verificado na conta. Depois de trocar a chave Pix, novos saques ficam bloqueados por 48 horas e a tela mostra a data exata da liberação.",
                "The account holder CPF must match the verified account CPF. After changing the Pix key, new withdrawals are locked for 48 hours and the exact release date is shown.",
              )}
            </p>
          </div>
          <OperationList
            title={tr("Recebimentos locais", "Local receipts")}
            items={[
              ...operations.purchases.slice(0, 5).map((item) => ({
                id: item.id,
                title: item.creator_name,
                meta: `${item.label} · ${money(item.amount_cents, locale)}`,
                active: true,
              })),
              ...paidTips
                .slice()
                .reverse()
                .map((item) => ({
                  id: item.id,
                  title: item.sender_name,
                  meta: `${tr("Mimo recebido", "Gift received")} · ${money(item.amount_cents, locale)} · ${tr("Saldo demonstrativo confirmado", "Demo balance confirmed")}`,
                  active: true,
                })),
            ]}
            empty={tr("Nenhum recebimento novo nesta sessão.", "No new receipts in this session.")}
          />
          <OperationList
            title={tr("Solicitações de saque", "Payout requests")}
            items={operations.payouts.map((item) => ({
              id: item.id,
              title: money(item.amount_cents, locale),
              meta:
                item.status === "pending"
                  ? tr("Aguardando processamento", "Awaiting processing")
                  : tr("Aprovado", "Approved"),
              active: item.status === "approved",
            }))}
            empty={tr("Nenhum saque solicitado.", "No payout requested.")}
          />
        </div>
      )}
      {section === "overview" && (
        <OperationList
          title={tr("Destaques do período", "Period highlights")}
          items={[
            {
              id: "growth",
              title: tr("Crescimento de receita", "Revenue growth"),
              meta: "+12,8%",
              active: true,
            },
            {
              id: "post",
              title: tr("Publicação com maior alcance", "Top-reach post"),
              meta: tr(
                "Bastidores do estúdio · 12.480 visualizações",
                "Studio backstage · 12,480 views",
              ),
              active: true,
            },
            {
              id: "payout",
              title: tr("Próximo recebimento", "Next payout"),
              meta: `${tr("Previsto para 5 de agosto", "Expected on August 5")} · ${money(748_000, locale)}`,
              active: true,
            },
          ]}
        />
      )}

      <Dialog open={plansDialogOpen} onOpenChange={setPlansDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-4xl">
          <DialogHeader>
            <DialogTitle>{tr("Configurar assinatura", "Configure subscription")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Defina o preço mensal uma vez e, ao lado, os descontos opcionais dos períodos maiores.",
                "Set the monthly price once and choose optional discounts for longer periods beside it.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PLAN_MONTHS.map((months) => {
              const baseCents = Math.max(
                0,
                Math.round(Number(planBasePrice.replace(",", ".")) * 100) || 0,
              );
              const discount = months === 1 ? 0 : planDiscounts[months];
              const monthlyCents = Math.round(baseCents * (1 - discount / 100));
              return (
                <div key={months} className="rounded-xl border border-border bg-background p-4">
                  <div className="text-sm font-semibold text-foreground">{planLabel(months)}</div>
                  <div className="mt-3">
                    {months === 1 ? (
                      <label className="block text-xs text-muted-foreground">
                        {tr("Valor mensal", "Monthly price")}
                        <div className="mt-1 flex items-center gap-2">
                          <span>R$</span>
                          <Input
                            type="number"
                            min="1"
                            step="0.10"
                            value={planBasePrice}
                            onChange={(event) => setPlanBasePrice(event.target.value)}
                            aria-label={tr("Valor mensal", "Monthly price")}
                          />
                        </div>
                      </label>
                    ) : (
                      <label className="block text-xs text-muted-foreground">
                        {tr("Desconto opcional", "Optional discount")}
                        <div className="mt-1 flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="90"
                            value={discount}
                            onChange={(event) =>
                              setPlanDiscounts((current) => ({
                                ...current,
                                [months]: Math.min(
                                  90,
                                  Math.max(0, Number(event.target.value) || 0),
                                ),
                              }))
                            }
                            aria-label={`${tr("Desconto", "Discount")} ${planLabel(months)}`}
                          />
                          <span>%</span>
                        </div>
                      </label>
                    )}
                  </div>
                  <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <strong className="block text-base text-foreground">
                      {money(monthlyCents * months, locale)}
                    </strong>
                    {months === 1
                      ? tr("por mês", "per month")
                      : `${money(monthlyCents, locale)}/${tr("mês", "month")}`}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlansDialogOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={savePlanConfiguration}>
              {tr("Salvar tabela completa", "Save complete pricing")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl">
          <DialogHeader>
            <DialogTitle>{tr("Criar novo cupom", "Create new coupon")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Escolha o benefício, o valor e quantas pessoas poderão usar.",
                "Choose the benefit, its value, and how many people can use it.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground sm:col-span-2">
              {tr("Código do cupom", "Coupon code")}
              <Input
                className="mt-1"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              {tr("Tipo do benefício", "Benefit type")}
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={couponKind}
                onChange={(event) => {
                  const next = event.target.value as CouponKind;
                  setCouponKind(next);
                  setCouponBenefit(next === "fixed" ? "19.90" : next === "trial" ? "7" : "20");
                }}
              >
                <option value="discount">
                  {tr("Desconto em porcentagem", "Percentage discount")}
                </option>
                <option value="fixed">
                  {tr("Preço promocional fixo", "Fixed promotional price")}
                </option>
                <option value="trial">{tr("Teste grátis", "Free trial")}</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {couponKind === "discount"
                ? tr("Valor do desconto (%)", "Discount value (%)")
                : couponKind === "fixed"
                  ? tr("Preço promocional (R$)", "Promotional price (BRL)")
                  : tr("Quantidade de dias grátis", "Number of free days")}
              <Input
                className="mt-1"
                type="number"
                min="1"
                max={couponKind === "discount" ? 90 : couponKind === "trial" ? 30 : undefined}
                step={couponKind === "fixed" ? "0.10" : "1"}
                value={couponBenefit}
                onChange={(event) => setCouponBenefit(event.target.value)}
              />
            </label>
            {couponKind !== "trial" && (
              <label className="text-xs text-muted-foreground">
                {tr("Duração da assinatura", "Subscription duration")}
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  value={couponDuration}
                  onChange={(event) => setCouponDuration(Number(event.target.value) as PlanMonths)}
                >
                  {PLAN_MONTHS.map((months) => (
                    <option key={months} value={months}>
                      {planLabel(months)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs text-muted-foreground">
              {tr("Quantidade de vagas", "Number of slots")}
              <Input
                className="mt-1"
                type="number"
                min="1"
                value={couponSlots}
                onChange={(event) => setCouponSlots(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm text-foreground sm:col-span-2">
              <input
                type="checkbox"
                checked={couponNewSubscribersOnly}
                onChange={(event) => setCouponNewSubscribersOnly(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>
                <strong className="block">
                  {tr("Somente novos assinantes", "New subscribers only")}
                </strong>
                <span className="text-xs text-muted-foreground">
                  {tr(
                    "Quem já assinou não poderá usar este cupom.",
                    "Previous subscribers cannot use this coupon.",
                  )}
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialogOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={saveCoupon}>{tr("Criar cupom", "Create coupon")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {config && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle>{config.title}</DialogTitle>
              <DialogDescription>
                {tr(
                  "A ação ficará salva somente neste navegador.",
                  "This action will be saved only in this browser.",
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {config.name && (
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={config.name}
                />
              )}
              {config.value && (
                <Input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={config.value}
                  type={section === "links" ? "text" : "number"}
                />
              )}
              {section === "posts" && (
                <select
                  value={postStatus}
                  onChange={(event) => setPostStatus(event.target.value as typeof postStatus)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="draft">{tr("Rascunho", "Draft")}</option>
                  <option value="scheduled">{tr("Agendada", "Scheduled")}</option>
                  <option value="published">{tr("Publicada", "Published")}</option>
                </select>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {tr("Cancelar", "Cancel")}
              </Button>
              <Button onClick={submit}>{tr("Salvar", "Save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

type OperationAction = { label: string; onClick: () => void; icon?: typeof Check };
type OperationItem = {
  id: string;
  title: string;
  meta: string;
  active: boolean;
  action?: OperationAction;
  actions?: OperationAction[];
};

function OperationList({
  title,
  items,
  empty,
}: {
  title: string;
  items: OperationItem[];
  empty?: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span
                    className={`h-2 w-2 rounded-full ${item.active ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                  <span className="truncate">{item.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{item.meta}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.action && (
                  <Button size="sm" variant="outline" onClick={item.action.onClick}>
                    {item.active ? (
                      <Pause className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {item.action.label}
                  </Button>
                )}
                {item.actions?.map((action) => {
                  const Icon = action.icon ?? Send;
                  return (
                    <Button key={action.label} size="sm" variant="outline" onClick={action.onClick}>
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { awardDemoPurchaseLoyalty } from "./demo-loyalty.ts";
import type {
  CampaignAudience,
  CampaignMediaSource,
  CampaignObjective,
  CampaignStatus,
} from "./mass-campaign.ts";
import type { CouponBenefitType, CouponEligibility } from "./coupon-offers.ts";

export type DemoItemStatus =
  | "active"
  | "paused"
  | "draft"
  | "scheduled"
  | "published"
  | "archived"
  | "sent"
  | "pending"
  | "approved"
  | "rejected"
  | "resolved"
  | "suspended"
  | "removed"
  | "in_review"
  | "invalid_document"
  | "selfie_pending"
  | "reverification"
  | "mismatch";

export interface DemoCreatorPost {
  id: string;
  title: string;
  body?: string | null;
  visibility?: "public" | "subscribers" | "ppv" | "goal";
  price_cents?: number;
  goal_target_cents?: number;
  goal_min_contribution_cents?: number;
  goal_raised_cents?: number;
  media_kind?: "text" | "image" | "video";
  media_url?: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  views: number;
  created_at: string;
}

export interface DemoPlan {
  id: string;
  name: string;
  months: 1 | 3 | 6 | 12;
  price_cents: number;
  discount_percent: number;
  subscribers: number;
  active: boolean;
}

export interface DemoLinkItem {
  id: string;
  title: string;
  slug: string;
  clicks: number;
  active: boolean;
}

export interface DemoGiftItem {
  id: string;
  title: string;
  description: string;
  emoji: string;
  image_url: string | null;
  value_cents: number;
  received_count: number;
  received_cents: number;
  availability: "available" | "on_request";
  track_stock: boolean;
  stock_quantity: number | null;
  active: boolean;
  source: "base" | "custom";
}

export interface DemoCampaign {
  id: string;
  title: string;
  objective: CampaignObjective;
  audience: CampaignAudience;
  body: string;
  media_source: CampaignMediaSource;
  media_title: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  ppv_price_cents: number;
  recipients: number;
  delivered: number;
  opened: number;
  sales: number;
  revenue_cents: number;
  status: CampaignStatus;
  scheduled_at: string | null;
  created_at: string;
}

export interface DemoCoupon {
  id: string;
  code: string;
  benefit_type: CouponBenefitType;
  discount_percent?: number;
  discount_amount_cents?: number;
  promotional_price_cents?: number;
  trial_days?: number;
  normal_price_cents: number;
  post_trial_price_cents?: number;
  auto_renew_after_trial: boolean;
  duration_months: 1 | 3 | 6 | 12;
  uses: number;
  reserved_uses: number;
  max_uses: number;
  max_uses_per_user: number;
  used_by_user_ids: string[];
  eligibility: CouponEligibility;
  expires_at: string | null;
  link_only: boolean;
  active: boolean;
}

export interface DemoCreatorComment {
  id: string;
  username: string;
  body: string;
  reason: string;
  status: "pending" | "approved" | "removed";
}

export interface DemoPayout {
  id: string;
  amount_cents: number;
  status: "pending" | "approved";
  created_at: string;
}

export interface DemoPurchase {
  id: string;
  kind: "ppv" | "subscription" | "goal";
  buyer_id: string;
  creator_id: string;
  creator_name: string;
  reference_id: string;
  label: string;
  amount_cents: number;
  coupon_id?: string;
  coupon_code?: string;
  status: "paid" | "cancelled";
  created_at: string;
}

export interface DemoReport {
  id: string;
  target_type: string;
  target_id: string;
  target_user_id: string;
  target_label: string;
  reason: string;
  details: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface DemoAdminItem {
  id: string;
  title: string;
  description: string;
  status: DemoItemStatus;
  risk?: "low" | "medium" | "high";
}

export interface DemoAuditEntry {
  id: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface DemoOperationsState {
  creatorPosts: DemoCreatorPost[];
  pinnedPostId: string | null;
  plans: DemoPlan[];
  links: DemoLinkItem[];
  giftItems: DemoGiftItem[];
  campaigns: DemoCampaign[];
  coupons: DemoCoupon[];
  creatorComments: DemoCreatorComment[];
  payouts: DemoPayout[];
  purchases: DemoPurchase[];
  reports: DemoReport[];
  users: DemoAdminItem[];
  kyc: DemoAdminItem[];
  dmca: DemoAdminItem[];
  moderation: DemoAdminItem[];
  audit: DemoAuditEntry[];
}

const STORAGE_VERSION = "v4";
export const DEMO_OPERATIONS_CHANGED_EVENT = "venyx:demo-operations-changed";
export const DEMO_EXPERIENCE_RESET_EVENT = "venyx:demo-experience-reset";

function storageKey(userId: string) {
  return `venyx:presentation:operations:${STORAGE_VERSION}:${userId}`;
}

function minutesAgo(value: number) {
  return new Date(Date.now() - value * 60_000).toISOString();
}

function id(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function createDemoOperationsSeed(): DemoOperationsState {
  return {
    pinnedPostId: "demo-post-aline-studio",
    creatorPosts: [
      {
        id: "creator-post-studio",
        title: "Bastidores do estúdio",
        status: "published",
        views: 12_480,
        created_at: minutesAgo(180),
      },
      {
        id: "creator-post-sunday",
        title: "Editorial de domingo",
        status: "scheduled",
        views: 0,
        created_at: minutesAgo(75),
      },
      {
        id: "creator-post-special",
        title: "Ensaio especial",
        status: "draft",
        views: 0,
        created_at: minutesAgo(28),
      },
    ],
    plans: [
      {
        id: "plan-monthly",
        name: "Mensal",
        months: 1,
        price_cents: 4_900,
        discount_percent: 0,
        subscribers: 248,
        active: true,
      },
      {
        id: "plan-quarterly",
        name: "Trimestral",
        months: 3,
        price_cents: 4_165,
        discount_percent: 15,
        subscribers: 61,
        active: true,
      },
      {
        id: "plan-semiannual",
        name: "Semestral",
        months: 6,
        price_cents: 3_675,
        discount_percent: 25,
        subscribers: 34,
        active: true,
      },
      {
        id: "plan-yearly",
        name: "Anual",
        months: 12,
        price_cents: 3_430,
        discount_percent: 30,
        subscribers: 17,
        active: true,
      },
    ],
    links: [
      { id: "link-main", title: "Página principal", slug: "aluana", clicks: 1_204, active: true },
      {
        id: "link-shoot",
        title: "Ensaio exclusivo",
        slug: "aluana/ensaio",
        clicks: 438,
        active: true,
      },
      {
        id: "link-yearly",
        title: "Assinatura anual",
        slug: "aluana/anual",
        clicks: 200,
        active: true,
      },
    ],
    giftItems: [
      {
        id: "gift-lingerie",
        title: "Conjunto de lingerie",
        description: "Conjunto selecionado para novas produções.",
        emoji: "👙",
        image_url: null,
        value_cents: 14_900,
        received_count: 8,
        received_cents: 119_200,
        availability: "available",
        track_stock: false,
        stock_quantity: null,
        active: true,
        source: "base",
      },
      {
        id: "gift-wellness",
        title: "Kit de autocuidado",
        description: "Kit especial de beleza e autocuidado.",
        emoji: "💜",
        image_url: null,
        value_cents: 19_900,
        received_count: 5,
        received_cents: 99_500,
        availability: "available",
        track_stock: false,
        stock_quantity: null,
        active: true,
        source: "base",
      },
      {
        id: "gift-tripod",
        title: "Tripé para gravação",
        description: "Equipamento para os próximos conteúdos.",
        emoji: "🎥",
        image_url: null,
        value_cents: 12_000,
        received_count: 12,
        received_cents: 144_000,
        availability: "available",
        track_stock: true,
        stock_quantity: 12,
        active: true,
        source: "base",
      },
      {
        id: "gift-light",
        title: "Iluminação para conteúdo",
        description: "Iluminação para novas fotos e vídeos.",
        emoji: "💡",
        image_url: null,
        value_cents: 18_000,
        received_count: 7,
        received_cents: 126_000,
        availability: "on_request",
        track_stock: false,
        stock_quantity: null,
        active: true,
        source: "base",
      },
    ],
    campaigns: [
      {
        id: "campaign-new",
        title: "Conteúdo novo disponível",
        objective: "ppv",
        audience: "active_subscribers",
        body: "Preparei um conteúdo exclusivo para você 💕",
        media_source: "library",
        media_title: "Ensaio exclusivo do estúdio",
        media_url: "/demo-creators/aline-investor.webp",
        media_mime_type: "image/webp",
        ppv_price_cents: 1_990,
        recipients: 326,
        delivered: 320,
        opened: 211,
        sales: 28,
        revenue_cents: 55_720,
        status: "sent",
        scheduled_at: null,
        created_at: minutesAgo(1_440),
      },
      {
        id: "campaign-renew",
        title: "Renove seu plano",
        objective: "renewal",
        audience: "expiring_subscribers",
        body: "Sua assinatura está perto de vencer. Renove para continuar acompanhando tudo.",
        media_source: "none",
        media_title: null,
        media_url: null,
        media_mime_type: null,
        ppv_price_cents: 0,
        recipients: 42,
        delivered: 0,
        opened: 0,
        sales: 0,
        revenue_cents: 0,
        status: "draft",
        scheduled_at: null,
        created_at: minutesAgo(240),
      },
      {
        id: "campaign-birthday",
        title: "Oferta de aniversário",
        objective: "coupon",
        audience: "former_subscribers",
        body: "Volte com uma condição especial usando o cupom BEMVINDA20.",
        media_source: "none",
        media_title: null,
        media_url: null,
        media_mime_type: null,
        ppv_price_cents: 0,
        recipients: 18,
        delivered: 0,
        opened: 0,
        sales: 0,
        revenue_cents: 0,
        status: "scheduled",
        scheduled_at: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
        created_at: minutesAgo(90),
      },
    ],
    coupons: [
      {
        id: "coupon-first-ten",
        code: "PRIMEIRAS10",
        benefit_type: "special_price",
        promotional_price_cents: 1_990,
        normal_price_cents: 4_900,
        auto_renew_after_trial: false,
        duration_months: 1,
        uses: 7,
        reserved_uses: 1,
        max_uses: 10,
        max_uses_per_user: 1,
        used_by_user_ids: ["lead-1", "lead-2", "lead-3", "lead-4", "lead-5", "lead-6", "lead-7"],
        eligibility: "new_subscribers",
        expires_at: new Date(Date.now() + 5 * 24 * 60 * 60_000).toISOString(),
        link_only: true,
        active: true,
      },
      {
        id: "coupon-welcome",
        code: "BEMVINDA20",
        benefit_type: "percentage_discount",
        discount_percent: 20,
        normal_price_cents: 4_900,
        auto_renew_after_trial: false,
        duration_months: 3,
        uses: 48,
        reserved_uses: 0,
        max_uses: 100,
        max_uses_per_user: 1,
        used_by_user_ids: [],
        eligibility: "new_subscribers",
        expires_at: null,
        link_only: true,
        active: true,
      },
      {
        id: "coupon-trial",
        code: "TESTE7DIAS",
        benefit_type: "trial",
        trial_days: 7,
        normal_price_cents: 4_900,
        post_trial_price_cents: 4_900,
        auto_renew_after_trial: false,
        duration_months: 1,
        uses: 12,
        reserved_uses: 0,
        max_uses: 30,
        max_uses_per_user: 1,
        used_by_user_ids: [],
        eligibility: "new_subscribers",
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString(),
        link_only: true,
        active: true,
      },
    ],
    creatorComments: [
      {
        id: "creator-comment-1",
        username: "@marcos_88",
        body: "Visite meu perfil para ganhar seguidores.",
        reason: "Palavra bloqueada",
        status: "pending",
      },
      {
        id: "creator-comment-2",
        username: "@fabioclub",
        body: "Mensagem repetida em várias publicações.",
        reason: "Possível spam",
        status: "pending",
      },
    ],
    payouts: [],
    purchases: [],
    reports: [
      {
        id: "report-1",
        target_type: "post",
        target_id: "demo-post-rafaela-personagem",
        target_user_id: "demo-rafaela",
        target_label: "@rafaela",
        reason: "spam",
        details: "Conteúdo repetido em várias publicações.",
        status: "pending",
        created_at: minutesAgo(18),
      },
      {
        id: "report-2",
        target_type: "profile",
        target_id: "demo-marina",
        target_user_id: "demo-marina",
        target_label: "@marina",
        reason: "impersonation",
        details: "Solicitação de verificação de identidade.",
        status: "pending",
        created_at: minutesAgo(47),
      },
      {
        id: "report-3",
        target_type: "comment",
        target_id: "demo-comment-review",
        target_user_id: "demo-comment-user",
        target_label: "Comentário denunciado",
        reason: "harassment",
        details: "Linguagem inadequada identificada pelo usuário.",
        status: "pending",
        created_at: minutesAgo(95),
      },
    ],
    users: [
      {
        id: "user-review-1",
        title: "@conta_em_revisao",
        description: "3 denúncias nos últimos sete dias",
        status: "pending",
        risk: "high",
      },
      {
        id: "user-review-2",
        title: "@novo_assinante",
        description: "Acesso incomum detectado",
        status: "pending",
        risk: "medium",
      },
      {
        id: "user-review-3",
        title: "@perfil_verificado",
        description: "Revisão preventiva concluída",
        status: "approved",
        risk: "low",
      },
    ],
    kyc: [
      {
        id: "kyc-1",
        title: "Camila Nogueira",
        description: "Documento e selfie enviados há 12 min",
        status: "pending",
        risk: "low",
      },
      {
        id: "kyc-2",
        title: "Marina Azevedo",
        description: "Divergência no nome do documento",
        status: "pending",
        risk: "medium",
      },
      {
        id: "kyc-3",
        title: "Rafaela Duarte",
        description: "Revisão de maioridade prioritária",
        status: "pending",
        risk: "high",
      },
    ],
    dmca: [
      {
        id: "dmca-1",
        title: "Solicitação #DM-2048",
        description: "Prova de titularidade recebida",
        status: "pending",
        risk: "medium",
      },
      {
        id: "dmca-2",
        title: "Solicitação #DM-2049",
        description: "Aguardando confirmação do requerente",
        status: "pending",
        risk: "low",
      },
    ],
    moderation: [
      {
        id: "moderation-1",
        title: "Publicação em análise",
        description: "Sinalizada pelo filtro automático",
        status: "pending",
        risk: "high",
      },
      {
        id: "moderation-2",
        title: "Comentário denunciado",
        description: "Possível assédio",
        status: "pending",
        risk: "medium",
      },
      {
        id: "moderation-3",
        title: "Imagem de perfil",
        description: "Revisão humana solicitada",
        status: "pending",
        risk: "low",
      },
    ],
    audit: [
      {
        id: "audit-1",
        action: "Acesso administrativo",
        detail: "Sessão protegida por 2FA",
        created_at: minutesAgo(8),
      },
      {
        id: "audit-2",
        action: "Denúncia encaminhada",
        detail: "Caso #report-1 enviado para análise",
        created_at: minutesAgo(18),
      },
      {
        id: "audit-3",
        action: "Política aplicada",
        detail: "Filtro de palavras atualizado",
        created_at: minutesAgo(64),
      },
    ],
  };
}

export function readDemoOperations(userId: string): DemoOperationsState {
  if (typeof window === "undefined") return createDemoOperationsSeed();
  try {
    const stored = localStorage.getItem(storageKey(userId));
    if (stored) {
      const parsed = JSON.parse(stored) as DemoOperationsState;
      const seed = createDemoOperationsSeed();
      return {
        ...parsed,
        pinnedPostId: Object.prototype.hasOwnProperty.call(parsed, "pinnedPostId")
          ? parsed.pinnedPostId
          : seed.pinnedPostId,
        campaigns: (parsed.campaigns ?? seed.campaigns).map((campaign) => {
          const fallback = seed.campaigns.find((item) => item.id === campaign.id);
          const isLegacyCampaign = (campaign as { objective?: unknown }).objective === undefined;
          return {
            ...campaign,
            objective: campaign.objective ?? fallback?.objective ?? ("custom" as const),
            audience: campaign.audience ?? fallback?.audience ?? ("active_subscribers" as const),
            body: campaign.body ?? fallback?.body ?? campaign.title,
            media_source: campaign.media_source ?? fallback?.media_source ?? ("none" as const),
            media_title: campaign.media_title ?? fallback?.media_title ?? null,
            media_url: campaign.media_url ?? fallback?.media_url ?? null,
            media_mime_type: campaign.media_mime_type ?? fallback?.media_mime_type ?? null,
            ppv_price_cents: campaign.ppv_price_cents ?? fallback?.ppv_price_cents ?? 0,
            delivered:
              campaign.delivered ??
              fallback?.delivered ??
              (campaign.status === "sent" ? campaign.recipients : 0),
            opened: campaign.opened ?? fallback?.opened ?? 0,
            sales: campaign.sales ?? fallback?.sales ?? 0,
            revenue_cents: campaign.revenue_cents ?? fallback?.revenue_cents ?? 0,
            status: isLegacyCampaign ? (fallback?.status ?? "draft") : campaign.status,
            scheduled_at: campaign.scheduled_at ?? fallback?.scheduled_at ?? null,
          };
        }),
        coupons: (parsed.coupons ?? seed.coupons).map((coupon) => {
          const fallback = seed.coupons.find((item) => item.id === coupon.id);
          const legacy = coupon as DemoCoupon & {
            kind?: "fixed" | "discount" | "trial";
            fixed_price_cents?: number;
            new_subscribers_only?: boolean;
          };
          const benefitType =
            coupon.benefit_type ??
            fallback?.benefit_type ??
            (legacy.kind === "trial"
              ? "trial"
              : legacy.kind === "fixed"
                ? "special_price"
                : "percentage_discount");
          return {
            ...coupon,
            benefit_type: benefitType,
            discount_amount_cents: coupon.discount_amount_cents,
            promotional_price_cents:
              coupon.promotional_price_cents ??
              legacy.fixed_price_cents ??
              fallback?.promotional_price_cents,
            normal_price_cents: coupon.normal_price_cents ?? fallback?.normal_price_cents ?? 4_900,
            post_trial_price_cents:
              coupon.post_trial_price_cents ?? fallback?.post_trial_price_cents ?? 4_900,
            auto_renew_after_trial:
              coupon.auto_renew_after_trial ?? fallback?.auto_renew_after_trial ?? false,
            reserved_uses: coupon.reserved_uses ?? fallback?.reserved_uses ?? 0,
            max_uses_per_user: coupon.max_uses_per_user ?? fallback?.max_uses_per_user ?? 1,
            used_by_user_ids: coupon.used_by_user_ids ?? fallback?.used_by_user_ids ?? [],
            eligibility:
              coupon.eligibility ??
              fallback?.eligibility ??
              (legacy.new_subscribers_only === false ? "new_and_former" : "new_subscribers"),
            expires_at: coupon.expires_at ?? fallback?.expires_at ?? null,
            link_only: coupon.link_only ?? fallback?.link_only ?? true,
          };
        }),
        giftItems: (parsed.giftItems ?? seed.giftItems).map((item, index) => {
          const fallback = seed.giftItems.find((seedItem) => seedItem.id === item.id);
          const trackStock = item.track_stock ?? fallback?.track_stock ?? false;
          return {
            ...item,
            title:
              item.id === "gift-wellness" && item.title === "Vibrador / bem-estar"
                ? (fallback?.title ?? item.title)
                : item.title,
            description: item.description || fallback?.description || "",
            image_url: item.image_url ?? fallback?.image_url ?? null,
            received_cents: item.received_cents ?? item.value_cents * item.received_count,
            availability: item.availability ?? fallback?.availability ?? ("available" as const),
            track_stock: trackStock,
            stock_quantity: trackStock
              ? (item.stock_quantity ?? fallback?.stock_quantity ?? 0)
              : null,
            source:
              item.source ??
              (index < seed.giftItems.length ? ("base" as const) : ("custom" as const)),
          };
        }),
      };
    }
  } catch {
    // Invalid local presentation data is replaced with a safe seed.
  }
  const seeded = createDemoOperationsSeed();
  localStorage.setItem(storageKey(userId), JSON.stringify(seeded));
  return seeded;
}

export function writeDemoOperations(userId: string, state: DemoOperationsState) {
  if (typeof window === "undefined") return state;
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
  window.dispatchEvent(new Event(DEMO_OPERATIONS_CHANGED_EVENT));
  return state;
}

export function updateDemoOperations(
  userId: string,
  update: (state: DemoOperationsState) => DemoOperationsState,
) {
  return writeDemoOperations(userId, update(readDemoOperations(userId)));
}

export function setDemoPinnedPost(userId: string, postId: string | null) {
  return updateDemoOperations(userId, (state) => ({
    ...state,
    pinnedPostId: postId,
  }));
}

export function recordDemoPurchase(input: Omit<DemoPurchase, "id" | "status" | "created_at">) {
  const purchase: DemoPurchase = {
    ...input,
    id: id("purchase"),
    status: "paid",
    created_at: new Date().toISOString(),
  };
  updateDemoOperations(input.buyer_id, (state) => ({
    ...state,
    purchases: [purchase, ...state.purchases].slice(0, 100),
    audit: [
      {
        id: id("audit"),
        action: "Pagamento local confirmado",
        detail: `${purchase.label} — R$ ${(purchase.amount_cents / 100).toFixed(2)}`,
        created_at: purchase.created_at,
      },
      ...state.audit,
    ].slice(0, 100),
  }));
  awardDemoPurchaseLoyalty({
    userId: input.buyer_id,
    creatorId: input.creator_id,
    creatorName: input.creator_name,
    kind: input.kind,
    amountCents: input.amount_cents,
    refId: input.reference_id,
  });
  return purchase;
}

export function isDemoPpvUnlocked(userId: string, postId: string) {
  return readDemoOperations(userId).purchases.some(
    (item) => item.kind === "ppv" && item.reference_id === postId && item.status === "paid",
  );
}

export function isDemoGoalContributed(userId: string, postId: string) {
  return readDemoOperations(userId).purchases.some(
    (item) => item.kind === "goal" && item.reference_id === postId && item.status === "paid",
  );
}

export function recordDemoReport(input: {
  userId: string;
  targetType: string;
  targetId: string;
  targetUserId: string;
  targetLabel?: string;
  reason: string;
  details?: string;
}) {
  const report: DemoReport = {
    id: id("report"),
    target_type: input.targetType,
    target_id: input.targetId,
    target_user_id: input.targetUserId,
    target_label: input.targetLabel || input.targetId,
    reason: input.reason,
    details: input.details?.trim() || "Sem detalhes adicionais.",
    status: "pending",
    created_at: new Date().toISOString(),
  };
  updateDemoOperations(input.userId, (state) => ({
    ...state,
    reports: [report, ...state.reports].slice(0, 100),
    audit: [
      {
        id: id("audit"),
        action: "Nova denúncia recebida",
        detail: `${report.target_label} — ${report.reason}`,
        created_at: report.created_at,
      },
      ...state.audit,
    ].slice(0, 100),
  }));
  return report;
}

export function addDemoAudit(userId: string, action: string, detail: string) {
  updateDemoOperations(userId, (state) => ({
    ...state,
    audit: [
      { id: id("audit"), action, detail, created_at: new Date().toISOString() },
      ...state.audit,
    ].slice(0, 100),
  }));
}

export function createDemoId(prefix: string) {
  return id(prefix);
}

export function recordDemoGiftProductPurchase(input: {
  userId: string;
  itemId: string;
  expectedAmountCents: number;
}) {
  let purchased: DemoGiftItem | null = null;
  updateDemoOperations(input.userId, (state) => {
    const current = state.giftItems.find((item) => item.id === input.itemId);
    if (!current) throw new Error("Este produto não está mais disponível.");
    const updated = applyDemoGiftProductPurchase(current, input.expectedAmountCents);
    purchased = updated;
    return {
      ...state,
      giftItems: state.giftItems.map((item) => (item.id === updated.id ? updated : item)),
    };
  });
  return purchased;
}

export function applyDemoGiftProductPurchase(current: DemoGiftItem, expectedAmountCents: number) {
  if (!current.active) throw new Error("Este produto não está mais disponível.");
  if (current.value_cents !== expectedAmountCents)
    throw new Error("O valor deste produto foi atualizado. Abra a lista novamente.");
  if (current.track_stock && (current.stock_quantity ?? 0) <= 0)
    throw new Error("Este produto está sem estoque.");
  return {
    ...current,
    received_count: current.received_count + 1,
    received_cents: current.received_cents + current.value_cents,
    stock_quantity: current.track_stock
      ? Math.max(0, (current.stock_quantity ?? 0) - 1)
      : current.stock_quantity,
  };
}

export function resetDemoExperience(userId: string) {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (
      key &&
      (key.startsWith("venyx:presentation:") ||
        key.startsWith("venyx:demo:") ||
        key.startsWith("venyx:demo-tips:") ||
        key.startsWith("venyx-demo-"))
    ) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
  writeDemoOperations(userId, createDemoOperationsSeed());
  window.dispatchEvent(new Event(DEMO_EXPERIENCE_RESET_EVENT));
}

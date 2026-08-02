export type DemoItemStatus =
  | "active"
  | "paused"
  | "draft"
  | "scheduled"
  | "published"
  | "sent"
  | "pending"
  | "approved"
  | "rejected"
  | "resolved"
  | "suspended"
  | "removed";

export interface DemoCreatorPost {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "published";
  views: number;
  created_at: string;
}

export interface DemoPlan {
  id: string;
  name: string;
  price_cents: number;
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
  emoji: string;
  value_cents: number;
  received_count: number;
  active: boolean;
}

export interface DemoCampaign {
  id: string;
  title: string;
  recipients: number;
  status: "draft" | "scheduled" | "sent";
  created_at: string;
}

export interface DemoCoupon {
  id: string;
  code: string;
  discount_percent: number;
  uses: number;
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
  kind: "ppv" | "subscription";
  buyer_id: string;
  creator_id: string;
  creator_name: string;
  reference_id: string;
  label: string;
  amount_cents: number;
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

const STORAGE_VERSION = "v1";
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
        name: "Plano mensal",
        price_cents: 3_990,
        subscribers: 248,
        active: true,
      },
      {
        id: "plan-quarterly",
        name: "Plano trimestral",
        price_cents: 9_990,
        subscribers: 61,
        active: true,
      },
      {
        id: "plan-yearly",
        name: "Plano anual",
        price_cents: 32_990,
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
        emoji: "👙",
        value_cents: 14_900,
        received_count: 8,
        active: true,
      },
      {
        id: "gift-wellness",
        title: "Vibrador / bem-estar",
        emoji: "💜",
        value_cents: 19_900,
        received_count: 5,
        active: true,
      },
      {
        id: "gift-tripod",
        title: "Tripé para gravação",
        emoji: "🎥",
        value_cents: 12_000,
        received_count: 12,
        active: true,
      },
      {
        id: "gift-light",
        title: "Iluminação para conteúdo",
        emoji: "💡",
        value_cents: 18_000,
        received_count: 7,
        active: true,
      },
    ],
    campaigns: [
      {
        id: "campaign-new",
        title: "Conteúdo novo disponível",
        recipients: 326,
        status: "sent",
        created_at: minutesAgo(1_440),
      },
      {
        id: "campaign-renew",
        title: "Renove seu plano",
        recipients: 42,
        status: "draft",
        created_at: minutesAgo(240),
      },
      {
        id: "campaign-birthday",
        title: "Oferta de aniversário",
        recipients: 18,
        status: "scheduled",
        created_at: minutesAgo(90),
      },
    ],
    coupons: [
      { id: "coupon-welcome", code: "BEMVINDO20", discount_percent: 20, uses: 43, active: true },
      { id: "coupon-vip", code: "VIP30", discount_percent: 30, uses: 28, active: true },
      { id: "coupon-return", code: "VOLTE15", discount_percent: 15, uses: 16, active: true },
      { id: "coupon-weekend", code: "FIMDESEMANA10", discount_percent: 10, uses: 0, active: true },
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
      return { ...parsed, giftItems: parsed.giftItems ?? createDemoOperationsSeed().giftItems };
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
  return purchase;
}

export function isDemoPpvUnlocked(userId: string, postId: string) {
  return readDemoOperations(userId).purchases.some(
    (item) => item.kind === "ppv" && item.reference_id === postId && item.status === "paid",
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

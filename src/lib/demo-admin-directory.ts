import type { DemoItemStatus } from "./demo-operations.ts";

export type AdminAccountType = "lead" | "subscriber" | "creator" | "admin";
export type AdminAccountStatus = "active" | "pending" | "suspended" | "paused" | "deleted";
export type AdminKycStatus =
  | "not_required"
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "invalid_document"
  | "selfie_pending"
  | "reverification"
  | "mismatch";

export interface DemoAdminDirectoryUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  accountType: AdminAccountType;
  defaultAccountStatus: AdminAccountStatus;
  registeredAt: string;
  balanceCents: number;
  subscriptions: number;
  blocks: number;
  kycId: string | null;
  defaultKycStatus: AdminKycStatus;
  kycNote: string;
  kycUpdatedAt: string | null;
}

export interface AdminDirectoryFilters {
  search?: string;
  accountType?: AdminAccountType | "all";
  accountStatus?: AdminAccountStatus | "all";
  kycStatus?: AdminKycStatus | "all";
}

export const DEMO_ADMIN_DIRECTORY: DemoAdminDirectoryUser[] = [
  {
    id: "user-review-1",
    fullName: "Lucas Ribeiro",
    username: "conta_em_revisao",
    email: "lucas.ribeiro@exemplo.com",
    accountType: "lead",
    defaultAccountStatus: "pending",
    registeredAt: "2026-07-28T14:20:00.000Z",
    balanceCents: 0,
    subscriptions: 0,
    blocks: 2,
    kycId: null,
    defaultKycStatus: "not_required",
    kycNote: "KYC não exigido para esta conta.",
    kycUpdatedAt: null,
  },
  {
    id: "user-review-2",
    fullName: "Ana Martins",
    username: "novo_assinante",
    email: "ana.martins@exemplo.com",
    accountType: "subscriber",
    defaultAccountStatus: "pending",
    registeredAt: "2026-08-01T18:42:00.000Z",
    balanceCents: 1_250,
    subscriptions: 2,
    blocks: 0,
    kycId: null,
    defaultKycStatus: "not_required",
    kycNote: "KYC não exigido para esta conta.",
    kycUpdatedAt: null,
  },
  {
    id: "user-review-3",
    fullName: "Aline Souza",
    username: "aline",
    email: "aline.souza@exemplo.com",
    accountType: "creator",
    defaultAccountStatus: "active",
    registeredAt: "2026-02-14T11:08:00.000Z",
    balanceCents: 748_000,
    subscriptions: 327,
    blocks: 0,
    kycId: "kyc-aline",
    defaultKycStatus: "approved",
    kycNote: "Documento, selfie e maioridade confirmados.",
    kycUpdatedAt: "2026-02-15T15:10:00.000Z",
  },
  {
    id: "admin-user-camila",
    fullName: "Camila Nogueira",
    username: "camila",
    email: "camila.nogueira@exemplo.com",
    accountType: "creator",
    defaultAccountStatus: "active",
    registeredAt: "2026-08-03T18:25:00.000Z",
    balanceCents: 0,
    subscriptions: 0,
    blocks: 0,
    kycId: "kyc-1",
    defaultKycStatus: "pending",
    kycNote: "Documento e selfie recebidos. Aguardando triagem.",
    kycUpdatedAt: "2026-08-04T20:48:00.000Z",
  },
  {
    id: "admin-user-marina",
    fullName: "Marina Azevedo",
    username: "marina",
    email: "marina.azevedo@exemplo.com",
    accountType: "creator",
    defaultAccountStatus: "active",
    registeredAt: "2026-08-02T16:04:00.000Z",
    balanceCents: 0,
    subscriptions: 0,
    blocks: 0,
    kycId: "kyc-2",
    defaultKycStatus: "mismatch",
    kycNote: "O nome informado diverge do documento enviado.",
    kycUpdatedAt: "2026-08-04T20:21:00.000Z",
  },
  {
    id: "admin-user-rafaela",
    fullName: "Rafaela Duarte",
    username: "rafaela",
    email: "rafaela.duarte@exemplo.com",
    accountType: "creator",
    defaultAccountStatus: "active",
    registeredAt: "2026-08-01T09:35:00.000Z",
    balanceCents: 0,
    subscriptions: 0,
    blocks: 0,
    kycId: "kyc-3",
    defaultKycStatus: "in_review",
    kycNote: "Revisão de maioridade marcada como prioritária.",
    kycUpdatedAt: "2026-08-04T19:57:00.000Z",
  },
  {
    id: "admin-user-bruno",
    fullName: "Bruno Lima",
    username: "brunolima",
    email: "bruno.lima@exemplo.com",
    accountType: "subscriber",
    defaultAccountStatus: "paused",
    registeredAt: "2026-04-19T12:30:00.000Z",
    balanceCents: 4_990,
    subscriptions: 3,
    blocks: 0,
    kycId: null,
    defaultKycStatus: "not_required",
    kycNote: "KYC não exigido para esta conta.",
    kycUpdatedAt: null,
  },
  {
    id: "admin-user-carla",
    fullName: "Carla Moreira",
    username: "carlamoreira",
    email: "carla.moreira@exemplo.com",
    accountType: "creator",
    defaultAccountStatus: "suspended",
    registeredAt: "2026-07-24T21:11:00.000Z",
    balanceCents: 13_540,
    subscriptions: 18,
    blocks: 1,
    kycId: "kyc-invalid-document",
    defaultKycStatus: "invalid_document",
    kycNote: "A frente do documento está ilegível.",
    kycUpdatedAt: "2026-08-04T17:36:00.000Z",
  },
  {
    id: "admin-user-paula",
    fullName: "Paula Mendes",
    username: "paulamendes",
    email: "paula.mendes@exemplo.com",
    accountType: "creator",
    defaultAccountStatus: "active",
    registeredAt: "2026-07-30T10:18:00.000Z",
    balanceCents: 0,
    subscriptions: 0,
    blocks: 0,
    kycId: "kyc-selfie-pending",
    defaultKycStatus: "selfie_pending",
    kycNote: "Documento válido; uma nova selfie foi solicitada.",
    kycUpdatedAt: "2026-08-04T16:10:00.000Z",
  },
  {
    id: "admin-user-juliana",
    fullName: "Juliana Costa",
    username: "julianacosta",
    email: "juliana.costa@exemplo.com",
    accountType: "creator",
    defaultAccountStatus: "active",
    registeredAt: "2025-11-08T13:57:00.000Z",
    balanceCents: 62_890,
    subscriptions: 64,
    blocks: 0,
    kycId: "kyc-reverification",
    defaultKycStatus: "reverification",
    kycNote: "Nova verificação solicitada após alteração cadastral.",
    kycUpdatedAt: "2026-08-04T14:45:00.000Z",
  },
  {
    id: "admin-user-beatriz",
    fullName: "Beatriz Alves",
    username: "beatrizalves",
    email: "beatriz.alves@exemplo.com",
    accountType: "creator",
    defaultAccountStatus: "suspended",
    registeredAt: "2026-07-25T08:22:00.000Z",
    balanceCents: 0,
    subscriptions: 0,
    blocks: 1,
    kycId: "kyc-rejected",
    defaultKycStatus: "rejected",
    kycNote: "Verificação reprovada por dados cadastrais inconsistentes.",
    kycUpdatedAt: "2026-08-03T12:05:00.000Z",
  },
  {
    id: "admin-user-diego",
    fullName: "Diego Santos",
    username: "diegosantos",
    email: "diego.santos@exemplo.com",
    accountType: "lead",
    defaultAccountStatus: "deleted",
    registeredAt: "2026-01-09T07:40:00.000Z",
    balanceCents: 0,
    subscriptions: 0,
    blocks: 0,
    kycId: null,
    defaultKycStatus: "not_required",
    kycNote: "KYC não exigido para esta conta.",
    kycUpdatedAt: null,
  },
  {
    id: "admin-user-fernanda",
    fullName: "Fernanda Rocha",
    username: "fernandarocha",
    email: "fernanda.rocha@exemplo.com",
    accountType: "admin",
    defaultAccountStatus: "active",
    registeredAt: "2025-08-12T10:00:00.000Z",
    balanceCents: 0,
    subscriptions: 0,
    blocks: 0,
    kycId: null,
    defaultKycStatus: "not_required",
    kycNote: "KYC não exigido para esta conta administrativa.",
    kycUpdatedAt: null,
  },
];

export function resolveAdminAccountStatus(
  user: DemoAdminDirectoryUser,
  override?: DemoItemStatus,
): AdminAccountStatus {
  if (override === "suspended") return "suspended";
  if (override === "paused") return "paused";
  if (override === "removed") return "deleted";
  if (override === "pending") return "pending";
  if (override === "approved" || override === "active") return "active";
  return user.defaultAccountStatus;
}

export function resolveAdminKycStatus(
  user: DemoAdminDirectoryUser,
  override?: DemoItemStatus,
): AdminKycStatus {
  if (!user.kycId) return "not_required";
  if (override === "approved" || override === "rejected") return override;
  if (
    override === "in_review" ||
    override === "invalid_document" ||
    override === "selfie_pending" ||
    override === "reverification" ||
    override === "mismatch"
  ) {
    return override;
  }
  return user.defaultKycStatus;
}

export function isKycOperational(status: AdminKycStatus) {
  return status !== "approved" && status !== "rejected" && status !== "not_required";
}

export function filterAdminDirectory(
  users: DemoAdminDirectoryUser[],
  filters: AdminDirectoryFilters,
  accountStatuses?: Map<string, AdminAccountStatus>,
  kycStatuses?: Map<string, AdminKycStatus>,
) {
  const term = filters.search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  return users.filter((user) => {
    const accountStatus = accountStatuses?.get(user.id) ?? user.defaultAccountStatus;
    const kycStatus = kycStatuses?.get(user.id) ?? user.defaultKycStatus;
    const matchesTerm =
      !term ||
      [user.fullName, user.email, user.username]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term);
    return (
      matchesTerm &&
      (!filters.accountType ||
        filters.accountType === "all" ||
        user.accountType === filters.accountType) &&
      (!filters.accountStatus ||
        filters.accountStatus === "all" ||
        accountStatus === filters.accountStatus) &&
      (!filters.kycStatus || filters.kycStatus === "all" || kycStatus === filters.kycStatus)
    );
  });
}

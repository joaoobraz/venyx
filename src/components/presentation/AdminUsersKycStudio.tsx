import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  Check,
  CircleDollarSign,
  ExternalLink,
  FileWarning,
  IdCard,
  LockKeyhole,
  Mail,
  PauseCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEMO_ADMIN_DIRECTORY,
  filterAdminDirectory,
  isKycOperational,
  resolveAdminAccountStatus,
  resolveAdminKycStatus,
  type AdminAccountStatus,
  type AdminAccountType,
  type AdminKycStatus,
  type DemoAdminDirectoryUser,
} from "@/lib/demo-admin-directory";
import {
  DEMO_OPERATIONS_CHANGED_EVENT,
  createDemoId,
  readDemoOperations,
  updateDemoOperations,
  type DemoItemStatus,
  type DemoOperationsState,
} from "@/lib/demo-operations";
import { useI18n } from "@/lib/i18n";

type StudioSection = "users" | "kyc";
type DirectoryRow = DemoAdminDirectoryUser & {
  accountStatus: AdminAccountStatus;
  kycStatus: AdminKycStatus;
};

const ACCOUNT_TYPES: AdminAccountType[] = ["lead", "subscriber", "creator", "admin"];
const ACCOUNT_STATUSES: AdminAccountStatus[] = [
  "active",
  "pending",
  "suspended",
  "paused",
  "deleted",
];
const KYC_STATUSES: AdminKycStatus[] = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "invalid_document",
  "selfie_pending",
  "reverification",
  "mismatch",
  "not_required",
];

function accountTypeLabel(type: AdminAccountType, tr: (pt: string, en: string) => string) {
  return {
    lead: tr("Lead", "Lead"),
    subscriber: tr("Assinante", "Subscriber"),
    creator: tr("Modelo", "Creator"),
    admin: tr("Administrador", "Administrator"),
  }[type];
}

function accountStatusLabel(status: AdminAccountStatus, tr: (pt: string, en: string) => string) {
  return {
    active: tr("Ativa", "Active"),
    pending: tr("Em acompanhamento", "Under review"),
    suspended: tr("Suspensa", "Suspended"),
    paused: tr("Pausada", "Paused"),
    deleted: tr("Excluída", "Deleted"),
  }[status];
}

function kycStatusLabel(status: AdminKycStatus, tr: (pt: string, en: string) => string) {
  return {
    not_required: tr("Não exigido", "Not required"),
    pending: tr("Aguardando análise", "Awaiting review"),
    in_review: tr("Em análise", "Under review"),
    approved: tr("Aprovado", "Approved"),
    rejected: tr("Reprovado", "Rejected"),
    invalid_document: tr("Documento inválido", "Invalid document"),
    selfie_pending: tr("Selfie pendente", "Selfie pending"),
    reverification: tr("Necessita nova verificação", "Reverification required"),
    mismatch: tr("Dados divergentes", "Mismatched data"),
  }[status];
}

function AccountStatusBadge({ status }: { status: AdminAccountStatus }) {
  const { tr } = useI18n();
  const cls = {
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    suspended: "border-destructive/30 bg-destructive/10 text-destructive",
    paused: "border-sky-500/30 bg-sky-500/10 text-sky-600",
    deleted: "border-border bg-muted text-muted-foreground",
  }[status];
  return (
    <Badge variant="outline" className={cls}>
      {accountStatusLabel(status, tr)}
    </Badge>
  );
}

function KycStatusBadge({ status }: { status: AdminKycStatus }) {
  const { tr } = useI18n();
  const cls =
    status === "approved"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
      : status === "rejected" || status === "invalid_document" || status === "mismatch"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : status === "not_required"
          ? "border-border bg-muted text-muted-foreground"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600";
  return (
    <Badge variant="outline" className={cls}>
      {kycStatusLabel(status, tr)}
    </Badge>
  );
}

function MetricCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-2xl text-foreground">{value}</strong>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </Card>
  );
}

export function AdminUsersKycStudio({
  section,
  userId,
}: {
  section: StudioSection;
  userId: string;
}) {
  const { locale, tr } = useI18n();
  const [operations, setOperations] = useState<DemoOperationsState>(() =>
    readDemoOperations(userId),
  );
  const [search, setSearch] = useState("");
  const [accountType, setAccountType] = useState<AdminAccountType | "all">("all");
  const [accountStatus, setAccountStatus] = useState<AdminAccountStatus | "all">("all");
  const [kycStatus, setKycStatus] = useState<AdminKycStatus | "all">("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"general" | "kyc">("general");

  useEffect(() => {
    const load = () => setOperations(readDemoOperations(userId));
    load();
    window.addEventListener(DEMO_OPERATIONS_CHANGED_EVENT, load);
    return () => window.removeEventListener(DEMO_OPERATIONS_CHANGED_EVENT, load);
  }, [userId]);

  const directoryRows = useMemo<DirectoryRow[]>(() => {
    const accountOverrides = new Map(operations.users.map((item) => [item.id, item.status]));
    const kycOverrides = new Map(operations.kyc.map((item) => [item.id, item.status]));
    return DEMO_ADMIN_DIRECTORY.map((user) => ({
      ...user,
      accountStatus: resolveAdminAccountStatus(user, accountOverrides.get(user.id)),
      kycStatus: resolveAdminKycStatus(user, user.kycId ? kycOverrides.get(user.kycId) : undefined),
    }));
  }, [operations]);

  const visibleRows = useMemo(() => {
    const accountStatuses = new Map(directoryRows.map((row) => [row.id, row.accountStatus]));
    const kycStatuses = new Map(directoryRows.map((row) => [row.id, row.kycStatus]));
    const filtered = filterAdminDirectory(
      DEMO_ADMIN_DIRECTORY,
      {
        search,
        accountType,
        accountStatus: section === "users" ? accountStatus : "all",
        kycStatus,
      },
      accountStatuses,
      kycStatuses,
    );
    const ids = new Set(filtered.map((row) => row.id));
    return directoryRows.filter(
      (row) => ids.has(row.id) && (section === "users" || row.kycId !== null),
    );
  }, [accountStatus, accountType, directoryRows, kycStatus, search, section]);

  const selectedUser = directoryRows.find((row) => row.id === selectedUserId) ?? null;
  const operationalKyc = directoryRows.filter((row) => isKycOperational(row.kycStatus));
  const exceptionAccounts = directoryRows.filter((row) =>
    ["suspended", "paused", "deleted"].includes(row.accountStatus),
  );

  const update = (fn: (state: DemoOperationsState) => DemoOperationsState) => {
    setOperations(updateDemoOperations(userId, fn));
  };

  const audit = (state: DemoOperationsState, action: string, detail: string) =>
    [
      { id: createDemoId("audit"), action, detail, created_at: new Date().toISOString() },
      ...state.audit,
    ].slice(0, 100);

  const changeAccountStatus = (user: DirectoryRow, next: AdminAccountStatus) => {
    const storedStatus: DemoItemStatus = next === "deleted" ? "removed" : next;
    update((state) => {
      const current = state.users.find((item) => item.id === user.id);
      const nextItem = {
        id: user.id,
        title: `@${user.username}`,
        description: tr(
          "Status alterado no cadastro administrativo",
          "Status changed in admin record",
        ),
        status: storedStatus,
        risk: next === "suspended" ? ("high" as const) : ("low" as const),
      };
      return {
        ...state,
        users: current
          ? state.users.map((item) => (item.id === user.id ? { ...item, ...nextItem } : item))
          : [...state.users, nextItem],
        audit: audit(
          state,
          tr("Status da conta alterado", "Account status changed"),
          `${user.fullName}: ${accountStatusLabel(next, tr)}`,
        ),
      };
    });
    toast.success(tr("Status da conta atualizado.", "Account status updated."));
  };

  const changeKycStatus = (user: DirectoryRow, next: Exclude<AdminKycStatus, "not_required">) => {
    if (!user.kycId) return;
    update((state) => {
      const current = state.kyc.find((item) => item.id === user.kycId);
      const nextItem = {
        id: user.kycId as string,
        title: user.fullName,
        description: user.kycNote,
        status: next as DemoItemStatus,
        risk:
          next === "rejected" || next === "invalid_document" || next === "mismatch"
            ? ("high" as const)
            : next === "approved"
              ? ("low" as const)
              : ("medium" as const),
      };
      return {
        ...state,
        kyc: current
          ? state.kyc.map((item) => (item.id === user.kycId ? { ...item, ...nextItem } : item))
          : [...state.kyc, nextItem],
        audit: audit(
          state,
          tr("Status do KYC alterado", "KYC status changed"),
          `${user.fullName}: ${kycStatusLabel(next, tr)}`,
        ),
      };
    });
    toast.success(
      tr("Fila e cadastro atualizados juntos.", "Queue and user record updated together."),
    );
  };

  const openUser = (id: string, tab: "general" | "kyc") => {
    setSelectedUserId(id);
    setDetailTab(tab);
  };

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
  const date = (value: string) => new Date(value).toLocaleDateString(locale);

  return (
    <div className="mt-5 space-y-4">
      <Card className="border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" />
              {tr("Usuários e KYC conectados", "Connected users and KYC")}
            </h3>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              {section === "users"
                ? tr(
                    "Esta é a visão cadastral completa. O status do KYC aparece em cada usuário e a análise pode ser aberta no mesmo cadastro.",
                    "This is the full account view. KYC status is shown for every user and review opens in the same record.",
                  )
                : tr(
                    "Esta fila organiza a análise de documentos. Cada item abre o cadastro completo do mesmo usuário, sem duplicar registros.",
                    "This queue organizes document review. Every item opens the same complete user record without duplicate registrations.",
                  )}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link
              to="/presentation/$section"
              params={{ section: section === "users" ? "kyc" : "users" }}
            >
              {section === "users"
                ? tr("Abrir fila KYC", "Open KYC queue")
                : tr("Abrir usuários", "Open users")}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {section === "users" ? (
          <>
            <MetricCard
              label={tr("Usuários cadastrados", "Registered users")}
              value={directoryRows.length}
              note={tr("Todos os tipos de conta", "All account types")}
            />
            <MetricCard
              label={tr("Modelos", "Creators")}
              value={directoryRows.filter((row) => row.accountType === "creator").length}
              note={tr("Inclui cadastros em análise", "Includes records under review")}
            />
            <MetricCard
              label={tr("KYC operacional", "Operational KYC")}
              value={operationalKyc.length}
              note={tr("Exige alguma ação", "Requires an action")}
            />
            <MetricCard
              label={tr("Contas com exceção", "Account exceptions")}
              value={exceptionAccounts.length}
              note={tr("Suspensas, pausadas ou excluídas", "Suspended, paused or deleted")}
            />
          </>
        ) : (
          <>
            <MetricCard
              label={tr("Fila operacional", "Operational queue")}
              value={operationalKyc.length}
              note={tr("Pendências que exigem ação", "Items requiring action")}
            />
            <MetricCard
              label={tr("Aguardando análise", "Awaiting review")}
              value={directoryRows.filter((row) => row.kycStatus === "pending").length}
              note={tr("Ainda sem analista", "Not assigned yet")}
            />
            <MetricCard
              label={tr("Em análise", "Under review")}
              value={directoryRows.filter((row) => row.kycStatus === "in_review").length}
              note={tr("Com analista responsável", "Assigned to an analyst")}
            />
            <MetricCard
              label={tr("Com divergência", "With issues")}
              value={
                directoryRows.filter((row) =>
                  ["invalid_document", "selfie_pending", "reverification", "mismatch"].includes(
                    row.kycStatus,
                  ),
                ).length
              }
              note={tr("Documento, selfie ou dados", "Document, selfie or data")}
            />
          </>
        )}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label={tr("Buscar usuário", "Search user")}
              className="pl-9"
              placeholder={tr(
                "Buscar por nome, e-mail ou @username",
                "Search name, email or @username",
              )}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            value={accountType}
            onValueChange={(value) => setAccountType(value as typeof accountType)}
          >
            <SelectTrigger aria-label={tr("Tipo de conta", "Account type")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr("Todos os tipos", "All types")}</SelectItem>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {accountTypeLabel(type, tr)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {section === "users" ? (
            <Select
              value={accountStatus}
              onValueChange={(value) => setAccountStatus(value as typeof accountStatus)}
            >
              <SelectTrigger aria-label={tr("Status da conta", "Account status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("Todos os status", "All statuses")}</SelectItem>
                {ACCOUNT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {accountStatusLabel(status, tr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={kycStatus}
              onValueChange={(value) => setKycStatus(value as typeof kycStatus)}
            >
              <SelectTrigger aria-label={tr("Status do KYC", "KYC status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("Todos os status KYC", "All KYC statuses")}</SelectItem>
                {KYC_STATUSES.filter((status) => status !== "not_required").map((status) => (
                  <SelectItem key={status} value={status}>
                    {kycStatusLabel(status, tr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {section === "users" && (
          <div className="mt-3 max-w-xs">
            <Select
              value={kycStatus}
              onValueChange={(value) => setKycStatus(value as typeof kycStatus)}
            >
              <SelectTrigger aria-label={tr("Filtrar por KYC", "Filter by KYC")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("Qualquer status KYC", "Any KYC status")}</SelectItem>
                {KYC_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {kycStatusLabel(status, tr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {visibleRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {tr("Nenhum usuário corresponde aos filtros.", "No user matches these filters.")}
          </div>
        ) : section === "users" ? (
          <UsersTable rows={visibleRows} money={money} date={date} onOpen={openUser} />
        ) : (
          <KycQueue rows={visibleRows} date={date} onOpen={openUser} />
        )}
      </Card>

      <Dialog
        open={Boolean(selectedUser)}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
      >
        {selectedUser && (
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedUser.fullName}</DialogTitle>
              <DialogDescription>
                @{selectedUser.username} · {selectedUser.email}
              </DialogDescription>
            </DialogHeader>
            <Tabs
              value={detailTab}
              onValueChange={(value) => setDetailTab(value as typeof detailTab)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">{tr("Dados do usuário", "User details")}</TabsTrigger>
                <TabsTrigger value="kyc" disabled={!selectedUser.kycId}>
                  KYC
                </TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="space-y-4 pt-2">
                <UserDetailGrid user={selectedUser} money={money} date={date} />
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {selectedUser.accountStatus !== "active" && (
                    <Button size="sm" onClick={() => changeAccountStatus(selectedUser, "active")}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      {tr("Reativar conta", "Reactivate account")}
                    </Button>
                  )}
                  {selectedUser.accountStatus !== "paused" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeAccountStatus(selectedUser, "paused")}
                    >
                      <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                      {tr("Pausar", "Pause")}
                    </Button>
                  )}
                  {selectedUser.accountStatus !== "suspended" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => changeAccountStatus(selectedUser, "suspended")}
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" />
                      {tr("Suspender", "Suspend")}
                    </Button>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="kyc" className="space-y-4 pt-2">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {tr("Status atual", "Current status")}
                      </p>
                      <div className="mt-2">
                        <KycStatusBadge status={selectedUser.kycStatus} />
                      </div>
                    </div>
                    <IdCard className="h-8 w-8 text-primary/70" />
                  </div>
                  <p className="mt-3 text-sm text-foreground">{selectedUser.kycNote}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedUser.kycUpdatedAt
                      ? `${tr("Última atualização", "Last update")}: ${new Date(
                          selectedUser.kycUpdatedAt,
                        ).toLocaleString(locale)}`
                      : tr("Sem envio de documentos.", "No document submission.")}
                  </p>
                </div>
                {selectedUser.kycId && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      onClick={() => changeKycStatus(selectedUser, "in_review")}
                    >
                      <UserCog className="mr-1.5 h-4 w-4" />
                      {tr("Marcar em análise", "Mark under review")}
                    </Button>
                    <Button onClick={() => changeKycStatus(selectedUser, "approved")}>
                      <Check className="mr-1.5 h-4 w-4" />
                      {tr("Aprovar KYC", "Approve KYC")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => changeKycStatus(selectedUser, "rejected")}
                    >
                      <X className="mr-1.5 h-4 w-4" />
                      {tr("Reprovar", "Reject")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => changeKycStatus(selectedUser, "invalid_document")}
                    >
                      <FileWarning className="mr-1.5 h-4 w-4" />
                      {tr("Documento inválido", "Invalid document")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => changeKycStatus(selectedUser, "selfie_pending")}
                    >
                      <IdCard className="mr-1.5 h-4 w-4" />
                      {tr("Solicitar selfie", "Request selfie")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => changeKycStatus(selectedUser, "reverification")}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      {tr("Solicitar nova verificação", "Request reverification")}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function UsersTable({
  rows,
  money,
  date,
  onOpen,
}: {
  rows: DirectoryRow[];
  money: (value: number) => string;
  date: (value: string) => string;
  onOpen: (id: string, tab: "general" | "kyc") => void;
}) {
  const { tr } = useI18n();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">{tr("Usuário", "User")}</TableHead>
          <TableHead>{tr("Tipo", "Type")}</TableHead>
          <TableHead>{tr("Status", "Status")}</TableHead>
          <TableHead>{tr("Cadastro", "Registered")}</TableHead>
          <TableHead>KYC</TableHead>
          <TableHead>{tr("Saldo", "Balance")}</TableHead>
          <TableHead>{tr("Assinaturas", "Subscriptions")}</TableHead>
          <TableHead>{tr("Bloqueios", "Blocks")}</TableHead>
          <TableHead className="text-right">{tr("Ações", "Actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium text-foreground">{row.fullName}</div>
              <div className="text-xs text-muted-foreground">{row.email}</div>
              <div className="text-xs text-muted-foreground">@{row.username}</div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{accountTypeLabel(row.accountType, tr)}</Badge>
            </TableCell>
            <TableCell>
              <AccountStatusBadge status={row.accountStatus} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs">{date(row.registeredAt)}</TableCell>
            <TableCell>
              <KycStatusBadge status={row.kycStatus} />
            </TableCell>
            <TableCell className="whitespace-nowrap">{money(row.balanceCents)}</TableCell>
            <TableCell>{row.subscriptions}</TableCell>
            <TableCell>{row.blocks}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => onOpen(row.id, "general")}>
                  {tr("Abrir", "Open")}
                </Button>
                {row.kycId && (
                  <Button size="sm" variant="outline" onClick={() => onOpen(row.id, "kyc")}>
                    KYC
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function KycQueue({
  rows,
  date,
  onOpen,
}: {
  rows: DirectoryRow[];
  date: (value: string) => string;
  onOpen: (id: string, tab: "general" | "kyc") => void;
}) {
  const { tr } = useI18n();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">{tr("Usuário", "User")}</TableHead>
          <TableHead>{tr("Tipo de conta", "Account type")}</TableHead>
          <TableHead>{tr("Status do KYC", "KYC status")}</TableHead>
          <TableHead className="min-w-[260px]">{tr("Pendência", "Review note")}</TableHead>
          <TableHead>{tr("Atualizado", "Updated")}</TableHead>
          <TableHead className="text-right">{tr("Ações", "Actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium text-foreground">{row.fullName}</div>
              <div className="text-xs text-muted-foreground">@{row.username}</div>
              <div className="text-xs text-muted-foreground">{row.email}</div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{accountTypeLabel(row.accountType, tr)}</Badge>
            </TableCell>
            <TableCell>
              <KycStatusBadge status={row.kycStatus} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{row.kycNote}</TableCell>
            <TableCell className="whitespace-nowrap text-xs">
              {row.kycUpdatedAt ? date(row.kycUpdatedAt) : "—"}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => onOpen(row.id, "general")}>
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  {tr("Usuário", "User")}
                </Button>
                <Button size="sm" onClick={() => onOpen(row.id, "kyc")}>
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  {tr("Analisar", "Review")}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UserDetailGrid({
  user,
  money,
  date,
}: {
  user: DirectoryRow;
  money: (value: number) => string;
  date: (value: string) => string;
}) {
  const { tr } = useI18n();
  const fields = [
    { icon: Mail, label: tr("E-mail", "Email"), value: user.email },
    {
      icon: UserCog,
      label: tr("Tipo de conta", "Account type"),
      value: accountTypeLabel(user.accountType, tr),
    },
    {
      icon: CalendarDays,
      label: tr("Data de cadastro", "Registration date"),
      value: date(user.registeredAt),
    },
    { icon: CircleDollarSign, label: tr("Saldo", "Balance"), value: money(user.balanceCents) },
    { icon: Users, label: tr("Assinaturas", "Subscriptions"), value: String(user.subscriptions) },
    { icon: LockKeyhole, label: tr("Bloqueios", "Blocks"), value: String(user.blocks) },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <AccountStatusBadge status={user.accountStatus} />
        <KycStatusBadge status={user.kycStatus} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const Icon = field.icon;
          return (
            <div key={field.label} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {field.label}
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">{field.value}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

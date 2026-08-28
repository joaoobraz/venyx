import { useEffect, useState } from "react";
import { Check, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  DEMO_OPERATIONS_CHANGED_EVENT,
  createDemoId,
  readDemoOperations,
  updateDemoOperations,
  type DemoAdminItem,
  type DemoOperationsState,
  type DemoReport,
} from "@/lib/demo-operations";
import { addDemoNotification } from "@/lib/demo-notifications";
import { AdminUsersKycStudio } from "@/components/presentation/AdminUsersKycStudio";

type AdminSection =
  "overview" | "reports" | "users" | "kyc" | "dmca" | "audit" | "moderation" | "reconciliation";

const INITIAL_RECONCILIATION_ISSUES = [
  {
    id: "reconciliation-1",
    title: "Pagamento confirmado, entrega pendente",
    description: "Assinatura · R$ 29,90 · 2 tentativas",
    risk: "high" as const,
  },
  {
    id: "reconciliation-2",
    title: "Consulta temporariamente indisponível",
    description: "Mimo · R$ 15,00 · 1 tentativa",
    risk: "medium" as const,
  },
];

function Metrics({ rows }: { rows: Array<[string, string]> }) {
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

export function ModeratorOperations({ section, userId }: { section: string; userId: string }) {
  const { tr } = useI18n();
  const [operations, setOperations] = useState<DemoOperationsState>(() =>
    readDemoOperations(userId),
  );
  const [reconciliationIssues, setReconciliationIssues] = useState(INITIAL_RECONCILIATION_ISSUES);

  useEffect(() => {
    const load = () => setOperations(readDemoOperations(userId));
    load();
    window.addEventListener(DEMO_OPERATIONS_CHANGED_EVENT, load);
    return () => window.removeEventListener(DEMO_OPERATIONS_CHANGED_EVENT, load);
  }, [userId]);

  const update = (fn: (state: DemoOperationsState) => DemoOperationsState) => {
    setOperations(updateDemoOperations(userId, fn));
  };

  const audit = (state: DemoOperationsState, action: string, detail: string) =>
    [
      { id: createDemoId("audit"), action, detail, created_at: new Date().toISOString() },
      ...state.audit,
    ].slice(0, 100);

  const decideReport = (item: DemoReport, status: "approved" | "rejected") => {
    update((state) => ({
      ...state,
      reports: state.reports.map((report) =>
        report.id === item.id ? { ...report, status } : report,
      ),
      audit: audit(
        state,
        status === "approved" ? "Denúncia confirmada" : "Denúncia arquivada",
        item.target_label,
      ),
    }));
    addDemoNotification(userId, {
      type: "moderation",
      title: status === "approved" ? "Denúncia confirmada" : "Denúncia arquivada",
      title_en: status === "approved" ? "Report confirmed" : "Report dismissed",
      body: `${item.target_label}: a decisão foi registrada na auditoria.`,
      body_en: `${item.target_label}: the decision was recorded in the audit log.`,
      link: "/presentation/audit",
    });
    toast.success(
      status === "approved"
        ? tr("Denúncia confirmada.", "Report confirmed.")
        : tr("Denúncia arquivada.", "Report dismissed."),
    );
  };

  const decideItem = (
    collection: "users" | "kyc" | "dmca" | "moderation",
    item: DemoAdminItem,
    status: DemoAdminItem["status"],
    action: string,
  ) => {
    update((state) => ({
      ...state,
      [collection]: state[collection].map((current) =>
        current.id === item.id ? { ...current, status } : current,
      ),
      audit: audit(state, action, item.title),
    }));
    toast.success(tr("Decisão registrada na auditoria.", "Decision recorded in the audit log."));
  };

  const pendingReports = operations.reports.filter((item) => item.status === "pending");
  const pendingKyc = operations.kyc.filter((item) => item.status === "pending");
  const pendingDmca = operations.dmca.filter((item) => item.status === "pending");
  const pendingModeration = operations.moderation.filter((item) => item.status === "pending");
  const pendingUsers = operations.users.filter((item) => item.status === "pending");
  const pendingPayouts = operations.payouts.filter((item) => item.status === "pending");

  const rows: Array<[string, string]> =
    section === "audit"
      ? [
          [tr("Eventos registrados", "Recorded events"), String(operations.audit.length)],
          [
            tr("Decisões hoje", "Decisions today"),
            String(operations.audit.filter((item) => !item.action.includes("Acesso")).length),
          ],
          [tr("Acessos negados", "Denied accesses"), "14"],
        ]
      : section === "kyc"
        ? [
            [tr("Aguardando revisão", "Awaiting review"), String(pendingKyc.length)],
            [
              tr("Dentro do prazo", "Within SLA"),
              String(pendingKyc.filter((item) => item.risk !== "high").length),
            ],
            [
              tr("Prioridade alta", "High priority"),
              String(pendingKyc.filter((item) => item.risk === "high").length),
            ],
          ]
        : section === "reconciliation"
          ? [
              [tr("PIX em análise", "PIX under review"), "6"],
              [tr("Divergências abertas", "Open mismatches"), String(reconciliationIssues.length)],
              [tr("Recuperadas hoje", "Recovered today"), "3"],
            ]
          : section === "overview"
            ? [
                [
                  tr("Filas pendentes", "Pending queues"),
                  String(
                    pendingReports.length +
                      pendingKyc.length +
                      pendingDmca.length +
                      pendingModeration.length +
                      pendingUsers.length,
                  ),
                ],
                [tr("Denúncias", "Reports"), String(pendingReports.length)],
                [tr("Saques pendentes", "Pending payouts"), String(pendingPayouts.length)],
              ]
            : [
                [
                  tr("Novos", "New"),
                  String(
                    section === "reports"
                      ? pendingReports.length
                      : section === "users"
                        ? pendingUsers.length
                        : section === "dmca"
                          ? pendingDmca.length
                          : pendingModeration.length,
                  ),
                ],
                [
                  tr("Resolvidos", "Resolved"),
                  String(
                    section === "reports"
                      ? operations.reports.length - pendingReports.length
                      : section === "users"
                        ? operations.users.length - pendingUsers.length
                        : section === "dmca"
                          ? operations.dmca.length - pendingDmca.length
                          : operations.moderation.length - pendingModeration.length,
                  ),
                ],
                [tr("SLA atendido", "SLA met"), "98,7%"],
              ];

  return (
    <>
      {section !== "users" && section !== "kyc" && <Metrics rows={rows} />}
      {(section === "users" || section === "kyc") && (
        <AdminUsersKycStudio section={section} userId={userId} />
      )}
      {section === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminList
            title={tr("Prioridades operacionais", "Operational priorities")}
            empty={tr("Nenhuma fila pendente.", "No pending queues.")}
            items={[
              ...pendingReports
                .slice(0, 2)
                .map((item) => ({
                  id: item.id,
                  title: item.target_label,
                  description: `${tr("Denúncia", "Report")}: ${item.reason}`,
                  risk: "high" as const,
                })),
              ...pendingKyc
                .slice(0, 2)
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  risk: item.risk,
                })),
            ]}
          />
          <AdminList
            title={tr("Saques para aprovação", "Payout approvals")}
            empty={tr("Nenhum saque pendente.", "No pending payout.")}
            items={pendingPayouts.map((item) => ({
              id: item.id,
              title: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                item.amount_cents / 100,
              ),
              description: tr("Solicitação da Modelo", "Creator request"),
              risk: "low" as const,
              actions: [
                {
                  label: tr("Aprovar", "Approve"),
                  icon: Check,
                  onClick: () =>
                    update((state) => ({
                      ...state,
                      payouts: state.payouts.map((payout) =>
                        payout.id === item.id ? { ...payout, status: "approved" } : payout,
                      ),
                      audit: audit(
                        state,
                        "Saque aprovado",
                        `R$ ${(item.amount_cents / 100).toFixed(2)}`,
                      ),
                    })),
                },
              ],
            }))}
          />
        </div>
      )}

      {section === "reports" && (
        <AdminList
          title={tr("Denúncias aguardando decisão", "Reports awaiting decision")}
          empty={tr("Nenhuma denúncia pendente.", "No pending reports.")}
          items={pendingReports.map((item) => ({
            id: item.id,
            title: item.target_label,
            description: `${item.reason} · ${item.details}`,
            risk: item.reason === "underage" || item.reason === "illegal" ? "high" : "medium",
            actions: [
              {
                label: tr("Confirmar", "Confirm"),
                icon: Check,
                onClick: () => decideReport(item, "approved"),
              },
              {
                label: tr("Arquivar", "Dismiss"),
                icon: X,
                onClick: () => decideReport(item, "rejected"),
              },
            ],
          }))}
        />
      )}
      {section === "dmca" && (
        <AdminList
          title={tr("Solicitações DMCA", "DMCA requests")}
          empty={tr("Nenhuma solicitação pendente.", "No pending request.")}
          items={pendingDmca.map((item) => ({
            ...item,
            actions: [
              {
                label: tr("Resolver", "Resolve"),
                icon: ShieldCheck,
                onClick: () => decideItem("dmca", item, "resolved", "DMCA resolvido"),
              },
              {
                label: tr("Rejeitar", "Reject"),
                icon: X,
                onClick: () => decideItem("dmca", item, "rejected", "DMCA rejeitado"),
              },
            ],
          }))}
        />
      )}
      {section === "reconciliation" && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {tr("Varredura de contingência", "Fallback sweep")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr(
                  "Simula a conferência das cobranças pendentes sem movimentar dinheiro real.",
                  "Simulates pending-charge checks without moving real money.",
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast.success(
                  tr(
                    "Varredura local concluída: 6 cobranças analisadas.",
                    "Local sweep completed: 6 charges checked.",
                  ),
                )
              }
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {tr("Executar varredura", "Run sweep")}
            </Button>
          </div>
          <AdminList
            title={tr("Divergências financeiras", "Financial mismatches")}
            empty={tr("Nenhuma divergência aberta.", "No open mismatches.")}
            items={reconciliationIssues.map((item) => ({
              ...item,
              actions: [
                {
                  label: tr("Marcar como resolvida", "Mark resolved"),
                  icon: Check,
                  onClick: () => {
                    setReconciliationIssues((current) =>
                      current.filter((issue) => issue.id !== item.id),
                    );
                    update((state) => ({
                      ...state,
                      audit: audit(state, "Divergência financeira resolvida", item.title),
                    }));
                    toast.success(
                      tr(
                        "Pendência resolvida e registrada na auditoria.",
                        "Issue resolved and recorded in the audit log.",
                      ),
                    );
                  },
                },
              ],
            }))}
          />
        </div>
      )}
      {section === "moderation" && (
        <AdminList
          title={tr("Conteúdos em revisão", "Content under review")}
          empty={tr("Nenhum conteúdo pendente.", "No pending content.")}
          items={pendingModeration.map((item) => ({
            ...item,
            actions: [
              {
                label: tr("Aprovar", "Approve"),
                icon: Check,
                onClick: () => decideItem("moderation", item, "approved", "Conteúdo aprovado"),
              },
              {
                label: tr("Remover", "Remove"),
                icon: Trash2,
                onClick: () => decideItem("moderation", item, "removed", "Conteúdo removido"),
              },
            ],
          }))}
        />
      )}
      {section === "audit" && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {tr("Histórico imutável da demonstração", "Demo audit history")}
          </h3>
          <div className="mt-3 divide-y divide-border">
            {operations.audit.slice(0, 20).map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="text-sm font-medium text-foreground">{item.action}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {item.detail} · {new Date(item.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

type AdminAction = { label: string; icon: typeof Check; onClick: () => void };
type AdminListItem = {
  id: string;
  title: string;
  description: string;
  risk?: "low" | "medium" | "high";
  actions?: AdminAction[];
};

function AdminList({
  title,
  items,
  empty,
}: {
  title: string;
  items: AdminListItem[];
  empty: string;
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
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${item.risk === "high" ? "bg-destructive" : item.risk === "medium" ? "bg-amber-500" : "bg-emerald-500"}`}
                  />
                  <span>{item.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {item.actions?.map((action) => {
                  const Icon = action.icon;
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

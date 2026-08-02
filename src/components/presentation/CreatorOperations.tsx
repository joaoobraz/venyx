import { useEffect, useMemo, useState } from "react";
import { Banknote, Check, ExternalLink, Gift, Pause, Play, Plus, Send, Trash2 } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";
import { DEMO_SUBSCRIPTIONS_CHANGED_EVENT, readDemoSubscriptions } from "@/lib/demo-content";
import { DEMO_TIPS_CHANGED_EVENT, readDemoTips } from "@/lib/demo-tips";
import {
  DEMO_OPERATIONS_CHANGED_EVENT,
  createDemoId,
  readDemoOperations,
  updateDemoOperations,
  type DemoOperationsState,
} from "@/lib/demo-operations";

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

  const tipCents = tips.reduce((total, item) => total + item.amount_cents, 0);
  const ppvCents = operations.purchases
    .filter((item) => item.kind === "ppv" && item.status === "paid")
    .reduce((total, item) => total + item.amount_cents, 0);
  const subscriptionCents = operations.purchases
    .filter((item) => item.kind === "subscription" && item.status === "paid")
    .reduce((total, item) => total + item.amount_cents, 0);

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
        return [
          [tr("Visitas ao perfil", "Profile visits"), "8.420"],
          [tr("Conversão", "Conversion"), "6,7%"],
          [tr("Retenção", "Retention"), "91,4%"],
        ];
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
        return [
          [
            tr("Receita no mês", "Revenue this month"),
            money(1_874_000 + tipCents + ppvCents + subscriptionCents, locale),
          ],
          [tr("Assinantes ativos", "Active subscribers"), String(323 + subscriptionCount)],
          [tr("Novos no mês", "New this month"), "48"],
        ];
    }
  }, [locale, operations, ppvCents, section, subscriptionCents, subscriptionCount, tipCents, tr]);

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
      case "subscriptions":
        return {
          button: tr("Novo plano", "New plan"),
          title: tr("Criar plano", "Create plan"),
          name: tr("Nome do plano", "Plan name"),
          value: tr("Preço (R$)", "Price (BRL)"),
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
      case "coupons":
        return {
          button: tr("Novo cupom", "New coupon"),
          title: tr("Criar cupom", "Create coupon"),
          name: tr("Código do cupom", "Coupon code"),
          value: tr("Desconto (%)", "Discount (%)"),
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
    } else if (section === "subscriptions") {
      const cents = Math.round(Number(value.replace(",", ".")) * 100);
      if (!cents) return toast.error(tr("Informe um preço válido.", "Enter a valid price."));
      update((state) => ({
        ...state,
        plans: [
          ...state.plans,
          {
            id: createDemoId("plan"),
            name: name.trim(),
            price_cents: cents,
            subscribers: 0,
            active: true,
          },
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
    } else if (section === "coupons") {
      update((state) => ({
        ...state,
        coupons: [
          {
            id: createDemoId("coupon"),
            code: name.trim().toUpperCase().replace(/\s+/g, ""),
            discount_percent: Math.min(90, Math.max(1, Number(value) || 10)),
            uses: 0,
            active: true,
          },
          ...state.coupons,
        ],
      }));
    }
    setName("");
    setValue("");
    setPostStatus("draft");
    setDialogOpen(false);
    toast.success(tr("Ação salva nesta demonstração.", "Action saved in this demo."));
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

      {section === "posts" && (
        <OperationList
          title={tr("Conteúdos", "Content")}
          items={operations.creatorPosts.map((item) => ({
            id: item.id,
            title: item.title,
            meta:
              item.status === "published"
                ? `${item.views.toLocaleString(locale === "en" ? "en-US" : "pt-BR")} ${tr("visualizações", "views")}`
                : tr(
                    item.status === "scheduled" ? "Agendada" : "Rascunho",
                    item.status === "scheduled" ? "Scheduled" : "Draft",
                  ),
            active: item.status === "published",
            action:
              item.status !== "published"
                ? {
                    label: tr("Publicar", "Publish"),
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
        <OperationList
          title={tr("Origem das visitas", "Traffic sources")}
          items={[
            {
              id: "instagram",
              title: "Instagram",
              meta: tr("4.286 visitas", "4,286 visits"),
              active: true,
            },
            {
              id: "search",
              title: tr("Busca da Venyx", "Venyx search"),
              meta: tr("2.192 visitas", "2,192 visits"),
              active: true,
            },
            {
              id: "direct",
              title: tr("Links diretos", "Direct links"),
              meta: tr("1.942 visitas", "1,942 visits"),
              active: true,
            },
          ]}
        />
      )}
      {section === "subscriptions" && (
        <OperationList
          title={tr("Planos disponíveis", "Available plans")}
          items={operations.plans.map((item) => ({
            id: item.id,
            title: item.name,
            meta: `${item.subscribers} ${tr("assinantes", "subscribers")} · ${money(item.price_cents, locale)}`,
            active: item.active,
            action: {
              label: item.active ? tr("Pausar", "Pause") : tr("Ativar", "Activate"),
              onClick: () => setCollectionStatus("plans", item.id),
            },
          }))}
        />
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
        <OperationList
          title={tr("Cupons e ofertas", "Coupons and offers")}
          items={operations.coupons.map((item) => ({
            id: item.id,
            title: item.code,
            meta: `${item.discount_percent}% · ${item.uses} ${tr("usos", "uses")}`,
            active: item.active,
            action: {
              label: item.active ? tr("Pausar", "Pause") : tr("Ativar", "Activate"),
              onClick: () => setCollectionStatus("coupons", item.id),
            },
          }))}
        />
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
          <OperationList
            title={tr("Recebimentos locais", "Local receipts")}
            items={[
              ...operations.purchases
                .slice(0, 5)
                .map((item) => ({
                  id: item.id,
                  title: item.creator_name,
                  meta: `${item.label} · ${money(item.amount_cents, locale)}`,
                  active: true,
                })),
              ...tips
                .slice(-5)
                .reverse()
                .map((item) => ({
                  id: item.id,
                  title: item.creator_name,
                  meta: `${tr("Mimo", "Tip")} · ${money(item.amount_cents, locale)}`,
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

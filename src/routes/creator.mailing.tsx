import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send,
  Tag as TagIcon,
  Plus,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  Lightbulb,
  Lock,
  Loader2,
  Mail,
  Calendar,
  Download,
  Eye,
  FileText,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  MousePointerClick,
  Ban,
} from "lucide-react";
import { detectExternalContact, contactBlockMessage } from "@/lib/contact-guard";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/creator/mailing")({
  component: MailingPage,
});

type Segment =
  "active_subscribers" | "expired_subscribers" | "non_subscribers" | "all_contacts" | "tag";

interface SubTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  count?: number;
}
interface Template {
  id: string;
  name: string;
  body: string;
  default_ppv_price_cents: number;
  uses_count: number;
}
interface Campaign {
  id: string;
  segment: Segment;
  body: string | null;
  recipients_count: number;
  sent_count: number;
  total_failed: number;
  total_pending: number;
  ppv_price_cents: number;
  created_at: string;
  scheduled_at: string | null;
  status: string;
}
interface PreviewRow {
  user_id: string;
  username: string;
  display_name: string | null;
  is_active_sub: boolean;
  is_expired_sub: boolean;
  has_thread: boolean;
  last_chat_at: string | null;
  tags: string[];
}

const TAG_SUGGESTIONS = [
  {
    pt: "Superfã",
    en: "Superfan",
    color: "#FF6B6B",
    ptDesc: "Fãs muito engajados",
    enDesc: "Highly engaged fans",
  },
  {
    pt: "Querido",
    en: "Favorite",
    color: "#FFB4D8",
    ptDesc: "Fãs queridos",
    enDesc: "Favorite fans",
  },
  { pt: "VIP", en: "VIP", color: "#FFD700", ptDesc: "Maiores compradores", enDesc: "Top spenders" },
  {
    pt: "Inativo",
    en: "Inactive",
    color: "#888888",
    ptDesc: "Não interage há semanas",
    enDesc: "No activity for weeks",
  },
  {
    pt: "Novo",
    en: "New",
    color: "#4ECDC4",
    ptDesc: "Acabou de assinar",
    enDesc: "Just subscribed",
  },
  {
    pt: "Comprador PPV",
    en: "PPV buyer",
    color: "#A78BFA",
    ptDesc: "Compra PPV com frequência",
    enDesc: "Frequently buys PPV",
  },
];

const SEGMENT_META: Record<
  Segment,
  { pt: string; en: string; icon: any; ptDesc: string; enDesc: string }
> = {
  active_subscribers: {
    pt: "Assinantes ativos",
    en: "Active subscribers",
    icon: UserCheck,
    ptDesc: "Quem está pagando agora",
    enDesc: "Currently paying subscribers",
  },
  expired_subscribers: {
    pt: "Ex-assinantes",
    en: "Former subscribers",
    icon: UserMinus,
    ptDesc: "Cancelados ou expirados",
    enDesc: "Canceled or expired",
  },
  non_subscribers: {
    pt: "Leads (não assinantes)",
    en: "Leads (non-subscribers)",
    icon: UserX,
    ptDesc: "Já conversaram, mas não assinaram",
    enDesc: "Messaged you but did not subscribe",
  },
  all_contacts: {
    pt: "Todos os contatos",
    en: "All contacts",
    icon: Users,
    ptDesc: "Todos que já interagiram",
    enDesc: "Everyone who has interacted",
  },
  tag: {
    pt: "Por tag",
    en: "By tag",
    icon: TagIcon,
    ptDesc: "Filtrar por uma tag específica",
    enDesc: "Filter by a specific tag",
  },
};

const TEMPLATE_VARS = [
  { key: "{{nome}}", pt: "Primeiro nome do destinatário", en: "Recipient's first name" },
  { key: "{{username}}", pt: "@username", en: "@username" },
  { key: "{{ppv}}", pt: "Preço do PPV formatado", en: "Formatted PPV price" },
  { key: "{{criadora}}", pt: "Seu @ de criadora", en: "Your creator @username" },
];

const FILTER_HOURS = [
  { value: "any", pt: "Qualquer momento", en: "Any time" },
  { value: "24", pt: "Última conversa em 24 h", en: "Last conversation within 24h" },
  { value: "72", pt: "Última conversa em 3 dias", en: "Last conversation within 3 days" },
  { value: "168", pt: "Última conversa em 7 dias", en: "Last conversation within 7 days" },
  { value: "720", pt: "Última conversa em 30 dias", en: "Last conversation within 30 days" },
];

function renderTemplate(
  body: string,
  vars: { nome?: string; username?: string; ppv?: string; criadora?: string },
) {
  return body
    .replaceAll("{{nome}}", vars.nome ?? "")
    .replaceAll("{{username}}", vars.username ? `@${vars.username}` : "")
    .replaceAll("{{ppv}}", vars.ppv ?? "")
    .replaceAll("{{criadora}}", vars.criadora ? `@${vars.criadora}` : "");
}

export function MailingPage() {
  const { locale, tr } = useI18n();
  const { user, profile, isCreator, loading } = useAuth();
  const [tags, setTags] = useState<SubTag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Compose
  const [segment, setSegment] = useState<Segment>("active_subscribers");
  const [tagId, setTagId] = useState<string>("");
  const [body, setBody] = useState("");
  const [ppvPrice, setPpvPrice] = useState<string>("0");
  const [filterHours, setFilterHours] = useState<string>("any");
  const [filterClicked, setFilterClicked] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [selectedTpl, setSelectedTpl] = useState<string>("");
  const [sending, setSending] = useState(false);

  // Preview
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Tag
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#D4AF7A");

  // Template form
  const [tplName, setTplName] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplPpv, setTplPpv] = useState("0");

  const contactWarn = useMemo(() => {
    if (!body.trim()) return null;
    const d = detectExternalContact(body);
    return d.blocked
      ? locale === "en"
        ? "External contact information is not allowed. Keep the conversation on Fanlira."
        : contactBlockMessage(d)
      : null;
  }, [body, locale]);

  const previewSample = useMemo(() => {
    const sample = preview[0];
    return renderTemplate(body, {
      nome: sample?.display_name?.split(" ")[0] ?? "Maria",
      username: sample?.username ?? "maria",
      ppv: parseInt(ppvPrice || "0", 10) > 0 ? `R$ ${ppvPrice}` : tr("grátis", "free"),
      criadora: profile?.username ?? "vc",
    });
  }, [body, ppvPrice, preview, profile]);

  const loadAll = async () => {
    if (!user) return;
    setLoadingData(true);
    const [{ data: tagRows }, { data: tplRows }, { data: campRows }, { data: assignments }] =
      await Promise.all([
        supabase.from("subscriber_tags").select("*").eq("creator_id", user.id).order("created_at"),
        supabase
          .from("dm_templates")
          .select("*")
          .eq("creator_id", user.id)
          .order("uses_count", { ascending: false }),
        supabase
          .from("mass_dm_campaigns")
          .select("*")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("user_tag_assignments").select("tag_id").eq("creator_id", user.id),
      ]);
    const counts = new Map<string, number>();
    (assignments ?? []).forEach((a: any) => counts.set(a.tag_id, (counts.get(a.tag_id) ?? 0) + 1));
    setTags(((tagRows ?? []) as any[]).map((t) => ({ ...t, count: counts.get(t.id) ?? 0 })));
    setTemplates((tplRows as Template[]) ?? []);
    setCampaigns((campRows as Campaign[]) ?? []);
    setLoadingData(false);
  };

  useEffect(() => {
    if (user && isCreator) loadAll();
  }, [user, isCreator]);

  const loadPreview = async () => {
    if (segment === "tag" && !tagId) {
      toast.error(tr("Escolha uma tag primeiro", "Choose a tag first"));
      return;
    }
    setPreviewLoading(true);
    const { data, error } = await supabase.rpc("preview_mass_dm_recipients", {
      _segment: segment,
      _tag_id: (segment === "tag" ? tagId : null) as any,
      _filter_hours: (filterHours === "any" ? null : parseInt(filterHours, 10)) as any,
      _filter_link_clicked: filterClicked,
    });
    setPreviewLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPreview((data as PreviewRow[]) ?? []);
    setPreviewOpen(true);
  };

  const reach = preview.length;

  const exportCSV = () => {
    if (preview.length === 0) {
      toast.error(tr("Carregue a prévia primeiro", "Load the preview first"));
      return;
    }
    const header = [
      "user_id",
      "username",
      "display_name",
      "ativa",
      "expirada",
      "tem_chat",
      "ultima_conversa",
      "tags",
    ];
    const rows = preview.map((p) => [
      p.user_id,
      p.username,
      p.display_name ?? "",
      p.is_active_sub ? tr("sim", "yes") : tr("não", "no"),
      p.is_expired_sub ? tr("sim", "yes") : tr("não", "no"),
      p.has_thread ? tr("sim", "yes") : tr("não", "no"),
      p.last_chat_at ? new Date(p.last_chat_at).toISOString() : "",
      p.tags.join("|"),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mailing-destinatarios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      tr(`Exportados ${preview.length} destinatários`, `Exported ${preview.length} recipients`),
    );
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setBody(t.body);
    setPpvPrice(String(Math.round(t.default_ppv_price_cents / 100)));
    setSelectedTpl(id);
    toast.success(tr(`Modelo "${t.name}" aplicado`, `Template "${t.name}" applied`));
  };

  const saveTemplate = async () => {
    if (!user || !tplName.trim() || !tplBody.trim()) {
      toast.error(tr("Nome e mensagem são obrigatórios", "Name and message are required"));
      return;
    }
    const { error } = await supabase.from("dm_templates").insert({
      creator_id: user.id,
      name: tplName.trim(),
      body: tplBody.trim(),
      default_ppv_price_cents: parseInt(tplPpv || "0", 10) * 100,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Modelo salvo", "Template saved"));
    setTplName("");
    setTplBody("");
    setTplPpv("0");
    loadAll();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm(tr("Apagar este modelo?", "Delete this template?"))) return;
    await supabase.from("dm_templates").delete().eq("id", id);
    loadAll();
  };

  const insertVar = (k: string) => setBody((b) => b + " " + k);

  const createTag = async (name: string, color: string, description?: string) => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("subscriber_tags").insert({
      creator_id: user.id,
      name: name.trim(),
      color,
      description: description ?? null,
    });
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? tr("A tag já existe", "Tag already exists")
          : error.message,
      );
      return;
    }
    setNewTagName("");
    loadAll();
  };

  const deleteTag = async (id: string) => {
    if (!confirm(tr("Apagar a tag?", "Delete tag?"))) return;
    await supabase.from("subscriber_tags").delete().eq("id", id);
    loadAll();
  };

  const cancelCampaign = async (c: Campaign) => {
    if (c.total_pending === 0) {
      toast.error(tr("Nada pendente para cancelar", "Nothing pending to cancel"));
      return;
    }
    if (
      !confirm(
        tr(
          `Cancelar ${c.total_pending} mensagens pendentes desta campanha?`,
          `Cancel ${c.total_pending} pending messages from this campaign?`,
        ),
      )
    )
      return;
    const { error, count } = await supabase
      .from("mass_dm_jobs")
      .update(
        {
          status: "cancelled",
          processed_at: new Date().toISOString(),
          error_reason: "Cancelado pela criadora",
        },
        { count: "exact" },
      )
      .eq("campaign_id", c.id)
      .eq("status", "pending");
    if (error) {
      toast.error(error.message);
      return;
    }
    const cancelled = count ?? 0;
    await supabase
      .from("mass_dm_campaigns")
      .update({
        status: "cancelled",
        total_pending: Math.max(c.total_pending - cancelled, 0),
      })
      .eq("id", c.id);
    toast.success(tr(`${cancelled} envios cancelados`, `${cancelled} sends canceled`));
    loadAll();
  };

  const send = async () => {
    if (contactWarn) {
      toast.error(
        tr("A mensagem contém contato externo", "Message contains external contact information"),
      );
      return;
    }
    if (!body.trim()) {
      toast.error(tr("Escreva uma mensagem", "Write a message"));
      return;
    }
    if (segment === "tag" && !tagId) {
      toast.error(tr("Escolha uma tag", "Choose a tag"));
      return;
    }

    const sched = scheduleDate ? new Date(scheduleDate) : null;
    if (sched && sched.getTime() < Date.now() - 60_000) {
      toast.error(tr("A data de agendamento já passou", "Scheduled time is in the past"));
      return;
    }
    if (
      !confirm(
        sched
          ? tr(
              `Agendar para ${sched.toLocaleString(locale)}?`,
              `Schedule for ${sched.toLocaleString(locale)}?`,
            )
          : tr("Enfileirar disparo agora?", "Queue this campaign now?"),
      )
    )
      return;

    setSending(true);
    const { data, error } = await supabase.rpc("enqueue_mass_dm", {
      _segment: segment,
      _tag_id: (segment === "tag" ? tagId : null) as any,
      _body: body,
      _media_path: null as any,
      _mime_type: null as any,
      _ppv_price_cents: parseInt(ppvPrice || "0", 10) * 100,
      _scheduled_at: (sched ? sched.toISOString() : null) as any,
      _template_id: (selectedTpl || null) as any,
      _filter_hours: (filterHours === "any" ? null : parseInt(filterHours, 10)) as any,
      _filter_link_clicked: filterClicked,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = (data as any)?.[0];
    toast.success(
      sched
        ? tr(
            `Agendado para ${r?.recipients ?? 0} destinatários`,
            `Scheduled for ${r?.recipients ?? 0} recipients`,
          )
        : tr(
            `Enfileirado: ${r?.recipients ?? 0} mensagens — entrega em cerca de 1 min`,
            `Queued: ${r?.recipients ?? 0} messages—delivery in about 1 min`,
          ),
    );
    setBody("");
    setPpvPrice("0");
    setScheduleDate("");
    setSelectedTpl("");
    setPreview([]);
    setPreviewOpen(false);
    loadAll();
  };

  if (loading) return <div className="p-8">{tr("Carregando…", "Loading…")}</div>;
  if (!isCreator)
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          {tr(
            "Apenas criadoras podem usar os envios em massa.",
            "Only creators can use mass messaging.",
          )}
        </p>
        <Link to="/become-creator" className="mt-4 inline-block text-primary underline">
          {tr("Tornar-se criadora", "Become a creator")}
        </Link>
      </div>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 p-3">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tr("Mensagens em massa", "Mass messaging")}</h1>
            <p className="text-sm text-muted-foreground">
              {tr(
                "Modelos, segmentação avançada, agendamento e fila — tudo dentro da Fanlira.",
                "Templates, advanced segmentation, scheduling and queueing—all inside Fanlira.",
              )}
            </p>
          </div>
        </header>

        <Tabs defaultValue="compose" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="compose">
              <Send className="mr-2 h-4 w-4" /> {tr("Enviar", "Send")}
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="mr-2 h-4 w-4" /> {tr("Modelos", "Templates")} ({templates.length}
              )
            </TabsTrigger>
            <TabsTrigger value="tags">
              <TagIcon className="mr-2 h-4 w-4" /> Tags ({tags.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="mr-2 h-4 w-4" /> {tr("Histórico", "History")}
            </TabsTrigger>
          </TabsList>

          {/* COMPOSE */}
          <TabsContent value="compose" className="space-y-4">
            <Card className="space-y-4 p-5">
              {/* Templates rápidos */}
              {templates.length > 0 && (
                <div>
                  <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                    {tr("Aplicar modelo", "Apply template")}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {templates.slice(0, 6).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t.id)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${selectedTpl === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
                      >
                        <FileText className="mr-1 inline h-3 w-3" /> {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{tr("1. Para quem enviar?", "1. Who should receive it?")}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(SEGMENT_META) as Segment[]).map((s) => {
                    const m = SEGMENT_META[s];
                    const Icon = m.icon;
                    const active = segment === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSegment(s)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}
                      >
                        <Icon
                          className={`mt-0.5 h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{tr(m.pt, m.en)}</div>
                          <div className="text-xs text-muted-foreground">
                            {tr(m.ptDesc, m.enDesc)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {segment === "tag" && (
                  <Select value={tagId} onValueChange={setTagId}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr("Escolha uma tag…", "Choose a tag…")} />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {tr(
                            "Nenhuma tag — crie uma na aba Tags.",
                            "No tags—create one in the Tags tab.",
                          )}
                        </div>
                      )}
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: t.color }}
                            />
                            {t.name} ({t.count ?? 0})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Filtros avançados */}
              <div className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {tr("Filtro: última conversa", "Filter: last conversation")}
                  </Label>
                  <Select value={filterHours} onValueChange={setFilterHours}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_HOURS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {tr(f.pt, f.en)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 self-end rounded-md p-2 text-xs hover:bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterClicked}
                    onChange={(e) => setFilterClicked(e.target.checked)}
                  />
                  <MousePointerClick className="h-3.5 w-3.5 text-primary" />
                  {tr("Apenas quem já abriu link ou PPV", "Only contacts who opened a link or PPV")}
                </label>
              </div>

              {/* Mensagem */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{tr("2. Mensagem", "2. Message")}</Label>
                  <div className="flex flex-wrap gap-1">
                    {TEMPLATE_VARS.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVar(v.key)}
                        title={tr(v.pt, v.en)}
                        className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={tr(
                    "Oi {{nome}} 💋 saiu conteúdo novo por {{ppv}}…",
                    "Hi {{nome}} 💋 new content is out for {{ppv}}…",
                  )}
                  rows={5}
                  className={contactWarn ? "border-destructive" : ""}
                />
                {contactWarn && <p className="text-xs text-destructive">{contactWarn}</p>}
              </div>

              {/* PPV + Schedule */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tr("3. PPV (opcional)", "3. PPV (optional)")}</Label>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={ppvPrice}
                      onChange={(e) => setPpvPrice(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />{" "}
                    {tr("Agendar (opcional)", "Schedule (optional)")}
                  </Label>
                  <Input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview + Export */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={loadPreview} disabled={previewLoading}>
                  {previewLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  {tr("Pré-visualizar destinatários", "Preview recipients")}
                </Button>
                <Button variant="outline" onClick={exportCSV} disabled={preview.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> {tr("Exportar CSV", "Export CSV")} (
                  {preview.length})
                </Button>
              </div>

              {previewOpen && (
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      <Users className="mr-1.5 inline h-4 w-4 text-primary" />
                      {tr(`${reach} destinatários estimados`, `${reach} estimated recipients`)}
                    </div>
                    <button
                      onClick={() => setPreviewOpen(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {tr("Fechar", "Close")}
                    </button>
                  </div>

                  {/* Sample message preview */}
                  {body.trim() && (
                    <div className="rounded-lg bg-background p-3">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {tr("Como aparecerá no chat:", "How it will appear in chat:")}
                      </p>
                      <div className="rounded-2xl bg-primary/10 p-3 text-sm">
                        {previewSample.split("\n").map((l, i) => (
                          <p key={i}>{l}</p>
                        ))}
                        {parseInt(ppvPrice || "0", 10) > 0 && (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] text-accent">
                            <Lock className="h-3 w-3" /> PPV R$ {ppvPrice}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {preview.slice(0, 50).map((p) => (
                      <div
                        key={p.user_id}
                        className="flex items-center justify-between rounded-md bg-background/60 px-2 py-1.5 text-xs"
                      >
                        <div>
                          <span className="font-medium">{p.display_name ?? p.username}</span>
                          <span className="ml-1 text-muted-foreground">@{p.username}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {p.is_active_sub && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              {tr("ativa", "active")}
                            </Badge>
                          )}
                          {p.tags.slice(0, 2).map((t) => (
                            <Badge key={t} className="h-5 bg-accent/20 text-[10px] text-accent">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                    {preview.length > 50 && (
                      <p className="pt-2 text-center text-xs text-muted-foreground">
                        {tr(`… e mais ${preview.length - 50}`, `… and ${preview.length - 50} more`)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={send}
                disabled={sending || !body.trim() || !!contactWarn}
                className="w-full"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr("Enviando…", "Sending…")}
                  </>
                ) : scheduleDate ? (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />{" "}
                    {tr("Agendar disparo", "Schedule campaign")}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> {tr("Enviar agora", "Send now")}
                  </>
                )}
              </Button>
            </Card>
          </TabsContent>

          {/* TEMPLATES */}
          <TabsContent value="templates" className="space-y-4">
            <Card className="space-y-3 p-5">
              <h2 className="font-semibold">{tr("Novo modelo", "New template")}</h2>
              <Input
                placeholder={tr(
                  "Nome (ex.: promoção de fim de semana)",
                  "Name (e.g. weekend promotion)",
                )}
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
              <Textarea
                placeholder={tr(
                  "Oi {{nome}} 💋 hoje tem promoção de {{ppv}} no novo conteúdo…",
                  "Hi {{nome}} 💋 today's new content is available for {{ppv}}…",
                )}
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                rows={4}
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs">{tr("PPV padrão R$", "Default PPV R$")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={tplPpv}
                  onChange={(e) => setTplPpv(e.target.value)}
                  className="w-24"
                />
                <Button onClick={saveTemplate} className="ml-auto">
                  <Plus className="mr-1 h-4 w-4" /> {tr("Salvar", "Save")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {tr("Variáveis", "Variables")}: <code>{`{{nome}}`}</code>{" "}
                <code>{`{{username}}`}</code> <code>{`{{ppv}}`}</code> <code>{`{{criadora}}`}</code>
              </p>
            </Card>

            <div className="space-y-2">
              {templates.length === 0 && (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {tr("Nenhum modelo ainda.", "No templates yet.")}
                </p>
              )}
              {templates.map((t) => (
                <Card key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">{t.name}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {t.uses_count} {tr("usos", "uses")}
                        </Badge>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                        {t.body}
                      </p>
                      {t.default_ppv_price_cents > 0 && (
                        <Badge className="mt-2 bg-accent/20 text-accent">
                          <Lock className="mr-1 h-3 w-3" />
                          R$ {(t.default_ppv_price_cents / 100).toFixed(0)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" onClick={() => applyTemplate(t.id)}>
                        {tr("Usar", "Use")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTemplate(t.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAGS */}
          <TabsContent value="tags" className="space-y-4">
            <Card className="space-y-4 p-5">
              <div>
                <Label className="mb-2 block">{tr("Criar tag", "Create tag")}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={tr("Nome da tag", "Tag name")}
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border bg-transparent"
                  />
                  <Button onClick={() => createTag(newTagName, newTagColor)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="mb-2 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-accent" /> {tr("Sugestões", "Suggestions")}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_SUGGESTIONS.filter(
                    (s) => !tags.some((t) => t.name.toLowerCase() === tr(s.pt, s.en).toLowerCase()),
                  ).map((s) => (
                    <button
                      key={s.pt}
                      type="button"
                      onClick={() => createTag(tr(s.pt, s.en), s.color, tr(s.ptDesc, s.enDesc))}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs hover:border-primary hover:bg-primary/5"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{" "}
                      {tr(s.pt, s.en)}
                      <Plus className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            </Card>
            <div className="space-y-2">
              {tags.map((t) => (
                <Card key={t.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                    <span className="font-medium">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.count ?? 0} {tr("contatos", "contacts")}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteTag(t.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="space-y-2">
            {campaigns.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {tr("Nenhuma campanha ainda.", "No campaigns yet.")}
              </p>
            )}
            {campaigns.map((c) => {
              const statusIcon =
                c.total_failed > 0 ? XCircle : c.total_pending > 0 ? Clock : CheckCircle2;
              const StatusIcon = statusIcon;
              const statusColor =
                c.total_failed > 0
                  ? "text-destructive"
                  : c.total_pending > 0
                    ? "text-accent"
                    : "text-primary";
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                        <span className="text-sm font-medium">
                          {SEGMENT_META[c.segment]
                            ? tr(SEGMENT_META[c.segment].pt, SEGMENT_META[c.segment].en)
                            : c.segment}
                        </span>
                        {c.scheduled_at && new Date(c.scheduled_at).getTime() > Date.now() && (
                          <Badge variant="outline" className="text-[10px]">
                            <Calendar className="mr-1 h-3 w-3" />
                            {new Date(c.scheduled_at).toLocaleString(locale)}
                          </Badge>
                        )}
                      </div>
                      {c.body && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                          {c.body}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <Badge variant="outline">
                          {c.recipients_count} {tr("destinos", "recipients")}
                        </Badge>
                        <Badge className="bg-primary/15 text-primary">
                          {c.sent_count} {tr("enviados", "sent")}
                        </Badge>
                        {c.total_pending > 0 && (
                          <Badge className="bg-accent/15 text-accent">
                            {c.total_pending} {tr("pendentes", "pending")}
                          </Badge>
                        )}
                        {c.total_failed > 0 && (
                          <Badge className="bg-destructive/15 text-destructive">
                            {c.total_failed} {tr("falharam", "failed")}
                          </Badge>
                        )}
                        {c.ppv_price_cents > 0 && (
                          <Badge variant="outline">
                            PPV R$ {(c.ppv_price_cents / 100).toFixed(0)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString(locale)}
                      </span>
                      {c.total_pending > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelCampaign(c)}
                          className="h-7 border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          <Ban className="mr-1 h-3.5 w-3.5" /> {tr("Cancelar", "Cancel")} (
                          {c.total_pending})
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send, Tag as TagIcon, Plus, Users, UserCheck, UserX, UserMinus,
  Sparkles, Lock, Loader2, Mail, Calendar, Download, Eye, FileText, Trash2,
  Clock, CheckCircle2, XCircle, MousePointerClick,
} from "lucide-react";
import { detectExternalContact, contactBlockMessage } from "@/lib/contact-guard";

export const Route = createFileRoute("/creator/mailing")({
  component: MailingPage,
});

type Segment = "active_subscribers" | "expired_subscribers" | "non_subscribers" | "all_contacts" | "tag";

interface SubTag { id: string; name: string; color: string; description: string | null; count?: number; }
interface Template { id: string; name: string; body: string; default_ppv_price_cents: number; uses_count: number; }
interface Campaign {
  id: string; segment: Segment; body: string | null;
  recipients_count: number; sent_count: number; total_failed: number; total_pending: number;
  ppv_price_cents: number; created_at: string; scheduled_at: string | null; status: string;
}
interface PreviewRow {
  user_id: string; username: string; display_name: string | null;
  is_active_sub: boolean; is_expired_sub: boolean; has_thread: boolean;
  last_chat_at: string | null; tags: string[];
}

const TAG_SUGGESTIONS = [
  { name: "Gado", color: "#FF6B6B", desc: "Fãs muito engajados" },
  { name: "Corinho", color: "#FFB4D8", desc: "Fãs queridos" },
  { name: "VIP", color: "#FFD700", desc: "Top spenders" },
  { name: "Inativo", color: "#888888", desc: "Não interage há semanas" },
  { name: "Novo", color: "#4ECDC4", desc: "Acabou de assinar" },
  { name: "PPV Buyer", color: "#A78BFA", desc: "Compra PPV com frequência" },
];

const SEGMENT_META: Record<Segment, { label: string; icon: any; desc: string }> = {
  active_subscribers: { label: "Assinantes ativos", icon: UserCheck, desc: "Quem está pagando agora" },
  expired_subscribers: { label: "Ex-assinantes", icon: UserMinus, desc: "Cancelados ou expirados" },
  non_subscribers: { label: "Leads (não-assinantes)", icon: UserX, desc: "Já conversaram, não assinaram" },
  all_contacts: { label: "Todos os contatos", icon: Users, desc: "Todo mundo que já interagiu" },
  tag: { label: "Por tag", icon: TagIcon, desc: "Filtrar por tag específica" },
};

const TEMPLATE_VARS = [
  { key: "{{nome}}", label: "Primeiro nome do destinatário" },
  { key: "{{username}}", label: "@username" },
  { key: "{{ppv}}", label: "Preço do PPV (formatado)" },
  { key: "{{criadora}}", label: "Seu @ de criadora" },
];

const FILTER_HOURS = [
  { value: "any", label: "Qualquer momento" },
  { value: "24", label: "Última conversa em 24h" },
  { value: "72", label: "Última conversa em 3 dias" },
  { value: "168", label: "Última conversa em 7 dias" },
  { value: "720", label: "Última conversa em 30 dias" },
];

function renderTemplate(body: string, vars: { nome?: string; username?: string; ppv?: string; criadora?: string }) {
  return body
    .replaceAll("{{nome}}", vars.nome ?? "")
    .replaceAll("{{username}}", vars.username ? `@${vars.username}` : "")
    .replaceAll("{{ppv}}", vars.ppv ?? "")
    .replaceAll("{{criadora}}", vars.criadora ? `@${vars.criadora}` : "");
}

function MailingPage() {
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
    return d.blocked ? contactBlockMessage(d) : null;
  }, [body]);

  const previewSample = useMemo(() => {
    const sample = preview[0];
    return renderTemplate(body, {
      nome: sample?.display_name?.split(" ")[0] ?? "Maria",
      username: sample?.username ?? "maria",
      ppv: parseInt(ppvPrice || "0", 10) > 0 ? `R$ ${ppvPrice}` : "grátis",
      criadora: profile?.username ?? "vc",
    });
  }, [body, ppvPrice, preview, profile]);

  const loadAll = async () => {
    if (!user) return;
    setLoadingData(true);
    const [{ data: tagRows }, { data: tplRows }, { data: campRows }, { data: assignments }] = await Promise.all([
      supabase.from("subscriber_tags").select("*").eq("creator_id", user.id).order("created_at"),
      supabase.from("dm_templates").select("*").eq("creator_id", user.id).order("uses_count", { ascending: false }),
      supabase.from("mass_dm_campaigns").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("user_tag_assignments").select("tag_id").eq("creator_id", user.id),
    ]);
    const counts = new Map<string, number>();
    (assignments ?? []).forEach((a: any) => counts.set(a.tag_id, (counts.get(a.tag_id) ?? 0) + 1));
    setTags(((tagRows ?? []) as any[]).map((t) => ({ ...t, count: counts.get(t.id) ?? 0 })));
    setTemplates((tplRows as Template[]) ?? []);
    setCampaigns((campRows as Campaign[]) ?? []);
    setLoadingData(false);
  };

  useEffect(() => { if (user && isCreator) loadAll(); }, [user, isCreator]);

  const loadPreview = async () => {
    if (segment === "tag" && !tagId) {
      toast.error("Escolha uma tag primeiro");
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
    if (error) { toast.error(error.message); return; }
    setPreview((data as PreviewRow[]) ?? []);
    setPreviewOpen(true);
  };

  const reach = preview.length;

  const exportCSV = () => {
    if (preview.length === 0) { toast.error("Carregue a prévia primeiro"); return; }
    const header = ["user_id", "username", "display_name", "ativa", "expirada", "tem_chat", "ultima_conversa", "tags"];
    const rows = preview.map((p) => [
      p.user_id, p.username, p.display_name ?? "",
      p.is_active_sub ? "sim" : "não",
      p.is_expired_sub ? "sim" : "não",
      p.has_thread ? "sim" : "não",
      p.last_chat_at ? new Date(p.last_chat_at).toISOString() : "",
      p.tags.join("|"),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mailing-destinatarios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportado ${preview.length} destinatário(s)`);
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setBody(t.body);
    setPpvPrice(String(Math.round(t.default_ppv_price_cents / 100)));
    setSelectedTpl(id);
    toast.success(`Template "${t.name}" aplicado`);
  };

  const saveTemplate = async () => {
    if (!user || !tplName.trim() || !tplBody.trim()) { toast.error("Nome e mensagem obrigatórios"); return; }
    const { error } = await supabase.from("dm_templates").insert({
      creator_id: user.id,
      name: tplName.trim(),
      body: tplBody.trim(),
      default_ppv_price_cents: parseInt(tplPpv || "0", 10) * 100,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Template salvo");
    setTplName(""); setTplBody(""); setTplPpv("0");
    loadAll();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Apagar este template?")) return;
    await supabase.from("dm_templates").delete().eq("id", id);
    loadAll();
  };

  const insertVar = (k: string) => setBody((b) => b + " " + k);

  const createTag = async (name: string, color: string, description?: string) => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("subscriber_tags").insert({
      creator_id: user.id, name: name.trim(), color, description: description ?? null,
    });
    if (error) { toast.error(error.message.includes("duplicate") ? "Tag já existe" : error.message); return; }
    setNewTagName("");
    loadAll();
  };

  const deleteTag = async (id: string) => {
    if (!confirm("Apagar tag?")) return;
    await supabase.from("subscriber_tags").delete().eq("id", id);
    loadAll();
  };

  const cancelCampaign = async (c: Campaign) => {
    if (c.total_pending === 0) { toast.error("Nada pendente para cancelar"); return; }
    if (!confirm(`Cancelar ${c.total_pending} mensagem(ns) pendente(s) desta campanha?`)) return;
    const { error, count } = await supabase
      .from("mass_dm_jobs")
      .update({ status: "cancelled", processed_at: new Date().toISOString(), error_reason: "Cancelado pela criadora" }, { count: "exact" })
      .eq("campaign_id", c.id)
      .eq("status", "pending");
    if (error) { toast.error(error.message); return; }
    const cancelled = count ?? 0;
    await supabase
      .from("mass_dm_campaigns")
      .update({
        status: "cancelled",
        total_pending: Math.max(c.total_pending - cancelled, 0),
      })
      .eq("id", c.id);
    toast.success(`${cancelled} envio(s) cancelado(s)`);
    loadAll();
  };

  const send = async () => {
    if (contactWarn) { toast.error("Mensagem contém contato externo"); return; }
    if (!body.trim()) { toast.error("Escreva uma mensagem"); return; }
    if (segment === "tag" && !tagId) { toast.error("Escolha uma tag"); return; }

    const sched = scheduleDate ? new Date(scheduleDate) : null;
    if (sched && sched.getTime() < Date.now() - 60_000) {
      toast.error("Agendamento no passado"); return;
    }
    if (!confirm(sched ? `Agendar para ${sched.toLocaleString("pt-BR")}?` : `Enfileirar disparo agora?`)) return;

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
    if (error) { toast.error(error.message); return; }
    const r = (data as any)?.[0];
    toast.success(sched
      ? `Agendado para ${r?.recipients ?? 0} destinatário(s)`
      : `Enfileirado: ${r?.recipients ?? 0} mensagem(ns) — entrega em ~1min`);
    setBody(""); setPpvPrice("0"); setScheduleDate(""); setSelectedTpl("");
    setPreview([]); setPreviewOpen(false);
    loadAll();
  };

  if (loading) return <div className="p-8">Carregando…</div>;
  if (!isCreator)
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Apenas criadoras podem usar o Mailing.</p>
        <Link to="/become-creator" className="mt-4 inline-block text-primary underline">Tornar-se criadora</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 p-3">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mailing em massa</h1>
          <p className="text-sm text-muted-foreground">Templates, segmentação avançada, agendamento e fila — tudo dentro da Venyx.</p>
        </div>
      </header>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="compose"><Send className="mr-2 h-4 w-4" /> Disparar</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="mr-2 h-4 w-4" /> Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="tags"><TagIcon className="mr-2 h-4 w-4" /> Tags ({tags.length})</TabsTrigger>
          <TabsTrigger value="history"><Clock className="mr-2 h-4 w-4" /> Histórico</TabsTrigger>
        </TabsList>

        {/* COMPOSE */}
        <TabsContent value="compose" className="space-y-4">
          <Card className="space-y-4 p-5">
            {/* Templates rápidos */}
            {templates.length > 0 && (
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Aplicar template</Label>
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
              <Label>1. Para quem enviar?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(SEGMENT_META) as Segment[]).map((s) => {
                  const m = SEGMENT_META[s];
                  const Icon = m.icon;
                  const active = segment === s;
                  return (
                    <button key={s} type="button" onClick={() => setSegment(s)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}>
                      <Icon className={`mt-0.5 h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="flex-1">
                        <div className="font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {segment === "tag" && (
                <Select value={tagId} onValueChange={setTagId}>
                  <SelectTrigger><SelectValue placeholder="Escolha uma tag…" /></SelectTrigger>
                  <SelectContent>
                    {tags.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma tag — crie em "Tags".</div>}
                    {tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
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
                <Label className="text-xs">Filtro: última conversa</Label>
                <Select value={filterHours} onValueChange={setFilterHours}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILTER_HOURS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 self-end rounded-md p-2 text-xs hover:bg-muted/40 cursor-pointer">
                <input type="checkbox" checked={filterClicked} onChange={(e) => setFilterClicked(e.target.checked)} />
                <MousePointerClick className="h-3.5 w-3.5 text-primary" />
                Apenas quem já abriu link/PPV antes
              </label>
            </div>

            {/* Mensagem */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>2. Mensagem</Label>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARS.map((v) => (
                    <button key={v.key} type="button" onClick={() => insertVar(v.key)} title={v.label}
                      className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary">
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Oi {{nome}} 💋 saiu conteúdo novo por {{ppv}}…"
                rows={5} className={contactWarn ? "border-destructive" : ""} />
              {contactWarn && <p className="text-xs text-destructive">{contactWarn}</p>}
            </div>

            {/* PPV + Schedule */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>3. PPV (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input type="number" min={0} step={1} value={ppvPrice} onChange={(e) => setPpvPrice(e.target.value)} className="w-32" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Agendar (opcional)</Label>
                <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
              </div>
            </div>

            {/* Preview + Export */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadPreview} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                Pré-visualizar destinatários
              </Button>
              <Button variant="outline" onClick={exportCSV} disabled={preview.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar CSV ({preview.length})
              </Button>
            </div>

            {previewOpen && (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    <Users className="mr-1.5 inline h-4 w-4 text-primary" />
                    {reach} destinatário(s) estimado(s)
                  </div>
                  <button onClick={() => setPreviewOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
                </div>

                {/* Sample message preview */}
                {body.trim() && (
                  <div className="rounded-lg bg-background p-3">
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Como aparecerá no chat:</p>
                    <div className="rounded-2xl bg-primary/10 p-3 text-sm">
                      {previewSample.split("\n").map((l, i) => <p key={i}>{l}</p>)}
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
                    <div key={p.user_id} className="flex items-center justify-between rounded-md bg-background/60 px-2 py-1.5 text-xs">
                      <div>
                        <span className="font-medium">{p.display_name ?? p.username}</span>
                        <span className="ml-1 text-muted-foreground">@{p.username}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {p.is_active_sub && <Badge variant="outline" className="h-5 text-[10px]">ativa</Badge>}
                        {p.tags.slice(0, 2).map((t) => <Badge key={t} className="h-5 bg-accent/20 text-[10px] text-accent">{t}</Badge>)}
                      </div>
                    </div>
                  ))}
                  {preview.length > 50 && <p className="pt-2 text-center text-xs text-muted-foreground">… e mais {preview.length - 50}</p>}
                </div>
              </div>
            )}

            <Button onClick={send} disabled={sending || !body.trim() || !!contactWarn} className="w-full" size="lg">
              {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
                : scheduleDate ? <><Calendar className="mr-2 h-4 w-4" /> Agendar disparo</>
                : <><Send className="mr-2 h-4 w-4" /> Enviar agora</>}
            </Button>
          </Card>
        </TabsContent>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="space-y-4">
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">Novo template</h2>
            <Input placeholder="Nome (ex: Promo de fim de semana)" value={tplName} onChange={(e) => setTplName(e.target.value)} />
            <Textarea
              placeholder="Oi {{nome}} 💋 hoje tem promo de {{ppv}} no novo conteúdo…"
              value={tplBody} onChange={(e) => setTplBody(e.target.value)} rows={4}
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs">PPV padrão R$</Label>
              <Input type="number" min={0} value={tplPpv} onChange={(e) => setTplPpv(e.target.value)} className="w-24" />
              <Button onClick={saveTemplate} className="ml-auto"><Plus className="mr-1 h-4 w-4" /> Salvar</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Variáveis: <code>{`{{nome}}`}</code> <code>{`{{username}}`}</code> <code>{`{{ppv}}`}</code> <code>{`{{criadora}}`}</code>
            </p>
          </Card>

          <div className="space-y-2">
            {templates.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum template ainda.</p>}
            {templates.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{t.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{t.uses_count} usos</Badge>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                    {t.default_ppv_price_cents > 0 && (
                      <Badge className="mt-2 bg-accent/20 text-accent"><Lock className="mr-1 h-3 w-3" />R$ {(t.default_ppv_price_cents / 100).toFixed(0)}</Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => applyTemplate(t.id)}>Usar</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)} className="text-destructive">
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
              <Label className="mb-2 block">Criar tag</Label>
              <div className="flex gap-2">
                <Input placeholder="Nome da tag" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border bg-transparent" />
                <Button onClick={() => createTag(newTagName, newTagColor)}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <Label className="mb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" /> Sugestões</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_SUGGESTIONS.filter((s) => !tags.some((t) => t.name.toLowerCase() === s.name.toLowerCase())).map((s) => (
                  <button key={s.name} type="button" onClick={() => createTag(s.name, s.color, s.desc)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs hover:border-primary hover:bg-primary/5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.name}
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
                  <Badge variant="outline" className="text-[10px]">{t.count ?? 0} contatos</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteTag(t.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-2">
          {campaigns.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma campanha ainda.</p>}
          {campaigns.map((c) => {
            const statusIcon = c.total_failed > 0 ? XCircle : c.total_pending > 0 ? Clock : CheckCircle2;
            const StatusIcon = statusIcon;
            const statusColor = c.total_failed > 0 ? "text-destructive" : c.total_pending > 0 ? "text-accent" : "text-primary";
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                      <span className="text-sm font-medium">{SEGMENT_META[c.segment]?.label ?? c.segment}</span>
                      {c.scheduled_at && new Date(c.scheduled_at).getTime() > Date.now() && (
                        <Badge variant="outline" className="text-[10px]">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(c.scheduled_at).toLocaleString("pt-BR")}
                        </Badge>
                      )}
                    </div>
                    {c.body && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{c.body}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <Badge variant="outline">{c.recipients_count} destino</Badge>
                      <Badge className="bg-primary/15 text-primary">{c.sent_count} enviado</Badge>
                      {c.total_pending > 0 && <Badge className="bg-accent/15 text-accent">{c.total_pending} pendente</Badge>}
                      {c.total_failed > 0 && <Badge className="bg-destructive/15 text-destructive">{c.total_failed} falhou</Badge>}
                      {c.ppv_price_cents > 0 && <Badge variant="outline">PPV R$ {(c.ppv_price_cents / 100).toFixed(0)}</Badge>}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

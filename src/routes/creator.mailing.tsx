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
  X,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  Sparkles,
  Lock,
  Loader2,
  Mail,
} from "lucide-react";
import { detectExternalContact, contactBlockMessage } from "@/lib/contact-guard";

export const Route = createFileRoute("/creator/mailing")({
  component: MailingPage,
});

type Segment = "active_subscribers" | "expired_subscribers" | "non_subscribers" | "all_contacts" | "tag";

interface SubTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  count?: number;
}

interface Contact {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_expired: boolean;
  has_thread: boolean;
}

interface Campaign {
  id: string;
  segment: Segment;
  body: string | null;
  recipients_count: number;
  sent_count: number;
  ppv_price_cents: number;
  created_at: string;
}

const TAG_SUGGESTIONS = [
  { name: "Gado", color: "#FF6B6B", desc: "Fãs muito engajados, gastam alto" },
  { name: "Corinho", color: "#FFB4D8", desc: "Fãs queridos, conversam bastante" },
  { name: "VIP", color: "#FFD700", desc: "Top spenders" },
  { name: "Inativo", color: "#888888", desc: "Não interage há semanas" },
  { name: "Novo", color: "#4ECDC4", desc: "Acabou de assinar" },
  { name: "PPV Buyer", color: "#A78BFA", desc: "Compra PPV com frequência" },
  { name: "Tip Lover", color: "#F59E0B", desc: "Manda gorjetas" },
  { name: "Quase pegando", color: "#EC4899", desc: "Quase converteu, vale insistir" },
];

const SEGMENT_META: Record<Segment, { label: string; icon: any; desc: string }> = {
  active_subscribers: { label: "Assinantes ativos", icon: UserCheck, desc: "Quem está pagando agora" },
  expired_subscribers: { label: "Ex-assinantes", icon: UserMinus, desc: "Já assinaram, cancelaram ou expiraram" },
  non_subscribers: { label: "Não-assinantes (leads)", icon: UserX, desc: "Já conversaram, mas nunca assinaram" },
  all_contacts: { label: "Todos os contatos", icon: Users, desc: "Todo mundo que já interagiu" },
  tag: { label: "Por tag", icon: TagIcon, desc: "Filtrar por uma tag específica" },
};

function MailingPage() {
  const { user, isCreator, loading } = useAuth();
  const [tags, setTags] = useState<SubTag[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Compose form
  const [segment, setSegment] = useState<Segment>("active_subscribers");
  const [tagId, setTagId] = useState<string>("");
  const [body, setBody] = useState("");
  const [ppvPrice, setPpvPrice] = useState<string>("0");
  const [sending, setSending] = useState(false);

  // Tag form
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#D4AF7A");

  const contactWarn = useMemo(() => {
    if (!body.trim()) return null;
    const d = detectExternalContact(body);
    return d.blocked ? contactBlockMessage(d) : null;
  }, [body]);

  const reach = useMemo(() => {
    if (segment === "active_subscribers") return contacts.filter((c) => c.is_active).length;
    if (segment === "expired_subscribers") return contacts.filter((c) => c.is_expired && !c.is_active).length;
    if (segment === "non_subscribers") return contacts.filter((c) => c.has_thread && !c.is_active).length;
    if (segment === "all_contacts") return contacts.length;
    if (segment === "tag") return tags.find((t) => t.id === tagId)?.count ?? 0;
    return 0;
  }, [segment, contacts, tagId, tags]);

  const loadAll = async () => {
    if (!user) return;
    setLoadingData(true);
    const [{ data: tagRows }, { data: campRows }, { data: subs }, { data: threads }, { data: assignments }] =
      await Promise.all([
        supabase.from("subscriber_tags").select("*").eq("creator_id", user.id).order("created_at"),
        supabase
          .from("mass_dm_campaigns")
          .select("*")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("subscriptions").select("subscriber_id,status").eq("creator_id", user.id),
        supabase.from("chat_threads").select("user_a,user_b").or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
        supabase.from("user_tag_assignments").select("tag_id,user_id").eq("creator_id", user.id),
      ]);

    // Build contact map
    const map = new Map<string, Contact>();
    (subs ?? []).forEach((s: any) => {
      const cur = map.get(s.subscriber_id) ?? {
        user_id: s.subscriber_id,
        username: "",
        display_name: null,
        avatar_url: null,
        is_active: false,
        is_expired: false,
        has_thread: false,
      };
      if (s.status === "active") cur.is_active = true;
      if (s.status === "canceled" || s.status === "expired") cur.is_expired = true;
      map.set(s.subscriber_id, cur);
    });
    (threads ?? []).forEach((t: any) => {
      const other = t.user_a === user.id ? t.user_b : t.user_a;
      const cur = map.get(other) ?? {
        user_id: other,
        username: "",
        display_name: null,
        avatar_url: null,
        is_active: false,
        is_expired: false,
        has_thread: false,
      };
      cur.has_thread = true;
      map.set(other, cur);
    });

    // Hydrate profile info
    const ids = Array.from(map.keys());
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,username,display_name,avatar_url")
        .in("user_id", ids);
      (profs ?? []).forEach((p: any) => {
        const cur = map.get(p.user_id);
        if (cur) {
          cur.username = p.username;
          cur.display_name = p.display_name;
          cur.avatar_url = p.avatar_url;
        }
      });
    }

    // Tag counts
    const counts = new Map<string, number>();
    (assignments ?? []).forEach((a: any) => counts.set(a.tag_id, (counts.get(a.tag_id) ?? 0) + 1));
    const enrichedTags = (tagRows ?? []).map((t: any) => ({ ...t, count: counts.get(t.id) ?? 0 }));

    setTags(enrichedTags);
    setCampaigns((campRows as Campaign[]) ?? []);
    setContacts(Array.from(map.values()));
    setLoadingData(false);
  };

  useEffect(() => {
    if (user && isCreator) loadAll();
  }, [user, isCreator]);

  const createTag = async (name: string, color: string, description?: string) => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("subscriber_tags").insert({
      creator_id: user.id,
      name: name.trim(),
      color,
      description: description ?? null,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Tag já existe" : error.message);
      return;
    }
    toast.success(`Tag "${name}" criada`);
    setNewTagName("");
    loadAll();
  };

  const deleteTag = async (id: string) => {
    if (!confirm("Apagar esta tag e remover todas as atribuições?")) return;
    await supabase.from("subscriber_tags").delete().eq("id", id);
    toast.success("Tag removida");
    loadAll();
  };

  const send = async () => {
    if (contactWarn) {
      toast.error("Mensagem contém contato externo bloqueado");
      return;
    }
    if (!body.trim()) {
      toast.error("Escreva uma mensagem");
      return;
    }
    if (segment === "tag" && !tagId) {
      toast.error("Escolha uma tag");
      return;
    }
    if (reach === 0) {
      toast.error("Nenhum destinatário no segmento escolhido");
      return;
    }
    if (!confirm(`Enviar para ${reach} ${reach === 1 ? "pessoa" : "pessoas"}?`)) return;

    setSending(true);
    const { data, error } = await supabase.rpc("mass_send_dm", {
      _segment: segment,
      _tag_id: (segment === "tag" ? tagId : null) as unknown as string,
      _body: body,
      _media_path: null as unknown as string,
      _mime_type: null as unknown as string,
      _ppv_price_cents: parseInt(ppvPrice || "0", 10) * 100,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const sent = (data as any)?.[0]?.sent ?? 0;
    toast.success(`Enviado para ${sent} ${sent === 1 ? "pessoa" : "pessoas"}!`);
    setBody("");
    setPpvPrice("0");
    loadAll();
  };

  if (loading) return <div className="p-8">Carregando…</div>;
  if (!isCreator)
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Apenas criadoras podem usar o Mailing.</p>
        <Link to="/become-creator" className="mt-4 inline-block text-primary underline">
          Tornar-se criadora
        </Link>
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
          <p className="text-sm text-muted-foreground">Dispare DMs segmentadas para sua base — direto no chat da plataforma.</p>
        </div>
      </header>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="compose">
            <Send className="mr-2 h-4 w-4" /> Disparar
          </TabsTrigger>
          <TabsTrigger value="tags">
            <TagIcon className="mr-2 h-4 w-4" /> Tags ({tags.length})
          </TabsTrigger>
          <TabsTrigger value="history">Histórico ({campaigns.length})</TabsTrigger>
        </TabsList>

        {/* COMPOSE */}
        <TabsContent value="compose" className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>1. Para quem enviar?</Label>
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
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
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
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma tag…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhuma tag criada — vá em "Tags" primeiro.
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

            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <Users className="mr-2 inline h-4 w-4 text-primary" />
              Alcance estimado: <strong className="text-primary">{reach}</strong>{" "}
              {reach === 1 ? "pessoa" : "pessoas"}
            </div>

            <div className="space-y-2">
              <Label>2. Mensagem</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Oi amor 💋 saiu conteúdo novo, dá uma olhada…"
                rows={5}
                className={contactWarn ? "border-destructive" : ""}
              />
              {contactWarn && <p className="text-xs text-destructive">{contactWarn}</p>}
            </div>

            <div className="space-y-2">
              <Label>3. PPV (opcional) — cobrar para destravar?</Label>
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
                <span className="text-xs text-muted-foreground">
                  {parseInt(ppvPrice || "0", 10) > 0 ? "Vai bloqueada até pagar" : "Mensagem aberta"}
                </span>
              </div>
            </div>

            <Button
              onClick={send}
              disabled={sending || !body.trim() || !!contactWarn}
              className="w-full"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" /> Enviar para {reach}{" "}
                  {reach === 1 ? "pessoa" : "pessoas"}
                </>
              )}
            </Button>
          </Card>
        </TabsContent>

        {/* TAGS */}
        <TabsContent value="tags" className="space-y-4">
          <Card className="space-y-4 p-5">
            <div>
              <Label className="mb-2 block">Criar tag personalizada</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da tag (ex: Gado, Corinho…)"
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
                <Sparkles className="h-3.5 w-3.5 text-accent" /> Sugestões rápidas
              </Label>
              <div className="flex flex-wrap gap-2">
                {TAG_SUGGESTIONS.filter((s) => !tags.some((t) => t.name.toLowerCase() === s.name.toLowerCase())).map(
                  (s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => createTag(s.name, s.color, s.desc)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs transition hover:border-primary hover:bg-primary/5"
                      title={s.desc}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                      <Plus className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                    </button>
                  )
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {tags.length === 0 && !loadingData && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma tag ainda. Crie uma acima ou use as sugestões.
              </p>
            )}
            {tags.map((t) => (
              <Card key={t.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: t.color, boxShadow: `0 0 12px ${t.color}66` }}
                  />
                  <div>
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </div>
                  <Badge variant="secondary">{t.count ?? 0}</Badge>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteTag(t.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>

          {/* Atribuir tags rapidamente */}
          {tags.length > 0 && contacts.length > 0 && (
            <Card className="space-y-3 p-5">
              <Label>Atribuir tags aos seus contatos</Label>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {contacts.slice(0, 50).map((c) => (
                  <ContactRow key={c.user_id} contact={c} tags={tags} creatorId={user!.id} onChange={loadAll} />
                ))}
              </div>
              {contacts.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Mostrando 50 de {contacts.length}. Use o chat para mais.
                </p>
              )}
            </Card>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-2">
          {campaigns.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum disparo ainda.
            </p>
          )}
          {campaigns.map((c) => (
            <Card key={c.id} className="space-y-1 p-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{SEGMENT_META[c.segment]?.label ?? c.segment}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="line-clamp-2 text-sm">{c.body}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>📤 {c.sent_count} enviadas</span>
                {c.ppv_price_cents > 0 && <span>🔒 R$ {(c.ppv_price_cents / 100).toFixed(0)} PPV</span>}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContactRow({
  contact,
  tags,
  creatorId,
  onChange,
}: {
  contact: Contact;
  tags: SubTag[];
  creatorId: string;
  onChange: () => void;
}) {
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("user_tag_assignments")
      .select("tag_id")
      .eq("creator_id", creatorId)
      .eq("user_id", contact.user_id)
      .then(({ data }) => {
        setAssigned(((data ?? []) as { tag_id: string }[]).map((r) => r.tag_id));
        setLoaded(true);
      });
  }, [contact.user_id, creatorId]);

  const toggle = async (tagId: string) => {
    if (assigned.includes(tagId)) {
      await supabase
        .from("user_tag_assignments")
        .delete()
        .eq("tag_id", tagId)
        .eq("user_id", contact.user_id);
      setAssigned((a) => a.filter((x) => x !== tagId));
    } else {
      await supabase.from("user_tag_assignments").insert({
        tag_id: tagId,
        user_id: contact.user_id,
        creator_id: creatorId,
      });
      setAssigned((a) => [...a, tagId]);
    }
    onChange();
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs">
        {contact.avatar_url ? (
          <img src={contact.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          (contact.display_name ?? contact.username ?? "?").slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{contact.display_name ?? contact.username}</div>
        <div className="flex gap-1 text-[10px] text-muted-foreground">
          {contact.is_active && <span className="text-green-500">● ativo</span>}
          {contact.is_expired && !contact.is_active && <span className="text-amber-500">● expirado</span>}
          {contact.has_thread && !contact.is_active && !contact.is_expired && <span>● lead</span>}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        {loaded &&
          tags.map((t) => {
            const on = assigned.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                  on ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
                style={{
                  background: on ? t.color : "transparent",
                  border: `1px solid ${t.color}`,
                }}
              >
                {t.name}
              </button>
            );
          })}
      </div>
    </div>
  );
}

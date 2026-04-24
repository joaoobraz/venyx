import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Link2,
  ArrowUp,
  ArrowDown,
  Star,
  ExternalLink,
  Eye,
  Sparkles,
  Loader2,
  Upload,
  X as XIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/creator/links")({
  component: CreatorLinksPage,
});

interface LinkRow {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  position: number;
  is_active: boolean;
  is_featured: boolean;
  clicks_count: number;
}

interface LinkPage {
  user_id: string;
  bio: string | null;
  theme: string;
  button_style: string;
  cover_url: string | null;
  avatar_url: string | null;
  show_avatar: boolean;
  is_published: boolean;
  views_count: number;
}

const ICON_PRESETS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "twitter", label: "X / Twitter" },
  { id: "youtube", label: "YouTube" },
  { id: "telegram", label: "Telegram (canal público)" },
  { id: "spotify", label: "Spotify" },
  { id: "venyx", label: "Venyx (perfil)" },
  { id: "globe", label: "Site" },
  { id: "heart", label: "Mimo / PIX" },
  { id: "shopping", label: "Loja" },
];

const TEMPLATES = [
  { title: "Meu Venyx 💕", url: "", icon: "venyx", featured: true },
  { title: "Instagram", url: "https://instagram.com/", icon: "instagram" },
  { title: "TikTok", url: "https://tiktok.com/@", icon: "tiktok" },
  { title: "Mimo via PIX", url: "", icon: "heart" },
];

function CreatorLinksPage() {
  const { user, profile, isCreator, loading } = useAuth();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [page, setPage] = useState<LinkPage | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("globe");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoadingData(true);
    const [{ data: lks }, { data: pg }] = await Promise.all([
      supabase
        .from("creator_links")
        .select("*")
        .eq("user_id", user.id)
        .order("position"),
      supabase.from("creator_link_pages").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setLinks((lks as LinkRow[]) ?? []);
    if (pg) {
      setPage(pg as LinkPage);
    } else {
      // cria default
      const { data } = await supabase
        .from("creator_link_pages")
        .insert({ user_id: user.id })
        .select()
        .single();
      setPage(data as LinkPage);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (user && isCreator) load();
  }, [user, isCreator]);

  const addLink = async () => {
    if (!user || !newTitle.trim() || !newUrl.trim()) {
      toast.error("Preencha título e URL");
      return;
    }
    const pos = links.length;
    const { error } = await supabase.from("creator_links").insert({
      user_id: user.id,
      title: newTitle.trim(),
      url: newUrl.trim(),
      icon: newIcon,
      position: pos,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link adicionado");
    setNewTitle("");
    setNewUrl("");
    load();
  };

  const updateLink = async (id: string, patch: Partial<LinkRow>) => {
    await supabase.from("creator_links").update(patch).eq("id", id);
    load();
  };

  const removeLink = async (id: string) => {
    if (!confirm("Remover este link?")) return;
    await supabase.from("creator_links").delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = links.findIndex((l) => l.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= links.length) return;
    const a = links[idx];
    const b = links[swap];
    await Promise.all([
      supabase.from("creator_links").update({ position: b.position }).eq("id", a.id),
      supabase.from("creator_links").update({ position: a.position }).eq("id", b.id),
    ]);
    load();
  };

  const updatePage = async (patch: Partial<LinkPage>) => {
    if (!user) return;
    setSaving(true);
    await supabase.from("creator_link_pages").update(patch).eq("user_id", user.id);
    setPage((p) => (p ? { ...p, ...patch } : p));
    setSaving(false);
  };

  const seedTemplates = async () => {
    if (!user || !profile) return;
    if (links.length > 0 && !confirm("Adicionar templates ao final dos seus links?")) return;
    const start = links.length;
    const rows = TEMPLATES.map((t, i) => ({
      user_id: user.id,
      title: t.title,
      url: t.url || `https://venyx.app/profile/${profile.username}`,
      icon: t.icon,
      position: start + i,
      is_featured: !!t.featured,
    }));
    await supabase.from("creator_links").insert(rows);
    toast.success("Templates adicionados");
    load();
  };

  if (loading) return <div className="p-8">Carregando…</div>;
  if (!isCreator)
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Apenas criadoras podem usar a árvore de links.</p>
        <Link to="/become-creator" className="mt-4 inline-block text-primary underline">
          Tornar-se criadora
        </Link>
      </div>
    );

  const publicUrl = profile ? `${typeof window !== "undefined" ? window.location.origin : ""}/links/${profile.username}` : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 p-3">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Árvore de links</h1>
            <p className="text-sm text-muted-foreground">
              Sua bio link segura — para postar nas redes sem risco de banimento.
            </p>
          </div>
        </div>
        {profile && (
          <a
            href={`/links/${profile.username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
          >
            <Eye className="h-3.5 w-3.5" /> Ver pública
          </a>
        )}
      </header>

      {profile && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Sua URL pública</p>
            <p className="truncate text-sm font-medium">{publicUrl}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Copiado!");
            }}
          >
            Copiar
          </Button>
        </Card>
      )}

      {/* Configurações da página */}
      {page && (
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Página pública</h2>
          <div className="space-y-2">
            <Label>Bio (aparece no topo)</Label>
            <Textarea
              value={page.bio ?? ""}
              onChange={(e) => setPage({ ...page, bio: e.target.value })}
              onBlur={() => updatePage({ bio: page.bio })}
              placeholder="Olá, sou a Maria 💋 confere meus links abaixo"
              rows={2}
              maxLength={200}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tema</Label>
              <Select value={page.theme} onValueChange={(v) => updatePage({ theme: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="champagne">Champagne (dourado)</SelectItem>
                  <SelectItem value="midnight">Midnight (preto-vinho)</SelectItem>
                  <SelectItem value="rose">Rosé</SelectItem>
                  <SelectItem value="minimal">Minimal claro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estilo dos botões</Label>
              <Select value={page.button_style} onValueChange={(v) => updatePage({ button_style: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">Arredondado</SelectItem>
                  <SelectItem value="pill">Pílula</SelectItem>
                  <SelectItem value="square">Quadrado</SelectItem>
                  <SelectItem value="outline">Contorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <Label className="block">Publicada</Label>
                <p className="text-xs text-muted-foreground">{page.is_published ? "Visível ao público" : "Oculta"}</p>
              </div>
              <Switch
                checked={page.is_published}
                onCheckedChange={(v) => updatePage({ is_published: v })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Visualizações totais: <strong className="text-foreground">{page.views_count}</strong></span>
            {saving && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> salvando…</span>}
          </div>
        </Card>
      )}

      {/* Add link */}
      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Adicionar link</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_180px_auto]">
          <Input
            placeholder="Título (ex: Meu Instagram)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Input
            placeholder="https://…"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <Select value={newIcon} onValueChange={setNewIcon}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ICON_PRESETS.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addLink}><Plus className="h-4 w-4" /></Button>
        </div>
        {links.length === 0 && (
          <button
            onClick={seedTemplates}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-4 w-4" /> Adicionar templates iniciais (Venyx, IG, TikTok, PIX)
          </button>
        )}
      </Card>

      {/* Lista */}
      <div className="space-y-2">
        {loadingData && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!loadingData && links.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum link ainda. Adicione acima ou use os templates.
          </p>
        )}
        {links.map((l, i) => (
          <Card key={l.id} className={`flex items-center gap-3 p-3 transition ${!l.is_active ? "opacity-50" : ""}`}>
            <div className="flex flex-col gap-1">
              <button onClick={() => move(l.id, -1)} disabled={i === 0} className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => move(l.id, 1)} disabled={i === links.length - 1} className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Input
                  value={l.title}
                  onChange={(e) => setLinks((arr) => arr.map((x) => x.id === l.id ? { ...x, title: e.target.value } : x))}
                  onBlur={() => updateLink(l.id, { title: l.title })}
                  className="h-8 text-sm font-medium"
                />
                {l.is_featured && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  value={l.url}
                  onChange={(e) => setLinks((arr) => arr.map((x) => x.id === l.id ? { ...x, url: e.target.value } : x))}
                  onBlur={() => updateLink(l.id, { url: l.url })}
                  className="h-7 text-xs text-muted-foreground"
                />
                <a href={l.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {l.clicks_count} cliques
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Switch checked={l.is_active} onCheckedChange={(v) => updateLink(l.id, { is_active: v })} />
              <button
                onClick={() => updateLink(l.id, { is_featured: !l.is_featured })}
                className={`rounded p-1 transition ${l.is_featured ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                title="Destacar"
              >
                <Star className={`h-4 w-4 ${l.is_featured ? "fill-current" : ""}`} />
              </button>
              <button onClick={() => removeLink(l.id)} className="rounded p-1 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

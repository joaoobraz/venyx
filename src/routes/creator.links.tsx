import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { normalizeCreatorLinkUrl } from "@/lib/creator-link-url";

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
  { id: "instagram", pt: "Instagram", en: "Instagram" },
  { id: "tiktok", pt: "TikTok", en: "TikTok" },
  { id: "twitter", pt: "X / Twitter", en: "X / Twitter" },
  { id: "youtube", pt: "YouTube", en: "YouTube" },
  { id: "telegram", pt: "Telegram (canal público)", en: "Telegram (public channel)" },
  { id: "spotify", pt: "Spotify", en: "Spotify" },
  { id: "venyx", pt: "Venyx (perfil)", en: "Venyx (profile)" },
  { id: "globe", pt: "Site", en: "Website" },
  { id: "heart", pt: "Mimo / Pix", en: "Tip / Pix" },
  { id: "shopping", pt: "Loja", en: "Store" },
];

const TEMPLATES = [
  { pt: "Meu Venyx 💕", en: "My Venyx 💕", url: "", icon: "venyx", featured: true },
  { pt: "Instagram", en: "Instagram", url: "https://instagram.com/", icon: "instagram" },
  { pt: "TikTok", en: "TikTok", url: "https://tiktok.com/@", icon: "tiktok" },
  { pt: "Mimo via Pix", en: "Tip via Pix", url: "", icon: "heart" },
];

function CreatorLinksPage() {
  const { tr } = useI18n();
  const { user, profile, isCreator, loading } = useAuth();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [page, setPage] = useState<LinkPage | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("globe");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (!f.type.startsWith("image/")) {
      toast.error(tr("Apenas imagens", "Images only"));
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error(tr("Máximo de 5 MB", "Maximum size is 5 MB"));
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${user.id}/linktree-${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from("avatars").upload(path, f, {
        contentType: f.type,
        upsert: true,
      });
      if (ue) throw ue;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      await updatePage({ avatar_url: pub.publicUrl });
      toast.success(tr("Foto da árvore de links atualizada", "Link page photo updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Erro no envio", "Upload failed"));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const removeLinktreeAvatar = async () => {
    if (!confirm(tr("Voltar a usar a foto do perfil?", "Use your profile photo again?"))) return;
    await updatePage({ avatar_url: null });
    toast.success(tr("Removida — usando a foto do perfil", "Removed—using your profile photo"));
  };

  const load = async () => {
    if (!user) return;
    setLoadingData(true);
    const [{ data: lks }, { data: pg }] = await Promise.all([
      supabase.from("creator_links").select("*").eq("user_id", user.id).order("position"),
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
      toast.error(tr("Preencha o título e a URL", "Enter a title and URL"));
      return;
    }
    const safeUrl = normalizeCreatorLinkUrl(newUrl);
    if (!safeUrl) {
      toast.error(
        tr(
          "Use um endereço válido começando com https://",
          "Use a valid address starting with https://",
        ),
      );
      return;
    }
    const pos = links.length;
    const { error } = await supabase.from("creator_links").insert({
      user_id: user.id,
      title: newTitle.trim(),
      url: safeUrl,
      icon: newIcon,
      position: pos,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Link adicionado", "Link added"));
    setNewTitle("");
    setNewUrl("");
    load();
  };

  const updateLink = async (id: string, patch: Partial<LinkRow>) => {
    if (typeof patch.url === "string") {
      const safeUrl = normalizeCreatorLinkUrl(patch.url);
      if (!safeUrl) {
        toast.error(
          tr(
            "Link inválido. Use apenas endereços HTTP ou HTTPS.",
            "Invalid link. Use only HTTP or HTTPS addresses.",
          ),
        );
        await load();
        return;
      }
      patch = { ...patch, url: safeUrl };
    }
    const { error } = await supabase.from("creator_links").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    load();
  };

  const removeLink = async (id: string) => {
    if (!confirm(tr("Remover este link?", "Remove this link?"))) return;
    await supabase.from("creator_links").delete().eq("id", id);
    toast.success(tr("Removido", "Removed"));
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
    if (
      links.length > 0 &&
      !confirm(
        tr(
          "Adicionar modelos ao final dos seus links?",
          "Add templates after your existing links?",
        ),
      )
    )
      return;
    const start = links.length;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://venyx.app";
    const rows = TEMPLATES.map((t, i) => ({
      user_id: user.id,
      title: tr(t.pt, t.en),
      url:
        t.url ||
        (t.icon === "heart"
          ? `${origin}/gifts/${profile.username}`
          : `${origin}/profile/${profile.username}`),
      icon: t.icon,
      position: start + i,
      is_featured: !!t.featured,
    }));
    await supabase.from("creator_links").insert(rows);
    toast.success(tr("Modelos adicionados", "Templates added"));
    load();
  };

  if (loading) return <div className="p-8">{tr("Carregando…", "Loading…")}</div>;
  if (!isCreator)
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          {tr("Apenas criadoras podem usar o Venyx Links.", "Only creators can use the link page.")}
        </p>
        <Link to="/become-creator" className="mt-4 inline-block text-primary underline">
          {tr("Tornar-se criadora", "Become a creator")}
        </Link>
      </div>
    );

  const publicUrl = profile
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/links/${profile.username}`
    : "";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 p-3">
              <Link2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Venyx Links</h1>
              <p className="text-sm text-muted-foreground">
                {tr(
                  "Seu mini perfil para compartilhar na bio de todas as redes.",
                  "Your mini profile to share in every social bio.",
                )}
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
              <Eye className="h-3.5 w-3.5" /> {tr("Ver página pública", "View public page")}
            </a>
          )}
        </header>

        {profile && (
          <Card className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {tr("Sua URL pública", "Your public URL")}
              </p>
              <p className="truncate text-sm font-medium">{publicUrl}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success(tr("Copiado!", "Copied!"));
              }}
            >
              {tr("Copiar", "Copy")}
            </Button>
          </Card>
        )}

        {/* Configurações da página */}
        {page && (
          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-semibold">{tr("Página pública", "Public page")}</h2>

            {/* Avatar do linktree (separado do perfil) */}
            <div className="flex items-start gap-4 rounded-xl border border-dashed bg-muted/20 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-primary/30">
                {(page.avatar_url ?? profile?.avatar_url) ? (
                  <img
                    src={page.avatar_url ?? profile?.avatar_url ?? ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
                    {profile?.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label className="block">{tr("Foto do Venyx Links", "Venyx Links photo")}</Label>
                <p className="text-xs text-muted-foreground">
                  {page.avatar_url
                    ? tr(
                        "Foto exclusiva da página de links, separada do perfil.",
                        "A separate photo used only on your link page.",
                      )
                    : tr(
                        "Usando a foto do perfil. Você pode enviar uma foto exclusiva para esta página.",
                        "Using your profile photo. You can upload a separate photo for this page.",
                      )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={uploadAvatar}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{" "}
                        {tr("Enviando…", "Uploading…")}
                      </>
                    ) : (
                      <>
                        <Upload className="mr-1.5 h-3.5 w-3.5" />{" "}
                        {page.avatar_url
                          ? tr("Trocar", "Change")
                          : tr("Enviar foto", "Upload photo")}
                      </>
                    )}
                  </Button>
                  {page.avatar_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={removeLinktreeAvatar}
                      className="text-destructive"
                    >
                      <XIcon className="mr-1 h-3.5 w-3.5" />{" "}
                      {tr("Usar foto do perfil", "Use profile photo")}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tr("Bio (aparece no topo)", "Bio (shown at the top)")}</Label>
              <Textarea
                value={page.bio ?? ""}
                onChange={(e) => setPage({ ...page, bio: e.target.value })}
                onBlur={() => updatePage({ bio: page.bio })}
                placeholder={tr(
                  "Olá, sou a Maria 💋 confira meus links abaixo",
                  "Hi, I'm Maria 💋 check out my links below",
                )}
                rows={2}
                maxLength={200}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{tr("Tema", "Theme")}</Label>
                <Select value={page.theme} onValueChange={(v) => updatePage({ theme: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="champagne">
                      {tr("Champagne (dourado)", "Champagne (gold)")}
                    </SelectItem>
                    <SelectItem value="midnight">
                      {tr("Noturno (preto e vinho)", "Midnight (black and burgundy)")}
                    </SelectItem>
                    <SelectItem value="rose">Rosé</SelectItem>
                    <SelectItem value="minimal">
                      {tr("Minimalista claro", "Light minimal")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr("Estilo dos botões", "Button style")}</Label>
                <Select
                  value={page.button_style}
                  onValueChange={(v) => updatePage({ button_style: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rounded">{tr("Arredondado", "Rounded")}</SelectItem>
                    <SelectItem value="pill">{tr("Pílula", "Pill")}</SelectItem>
                    <SelectItem value="square">{tr("Quadrado", "Square")}</SelectItem>
                    <SelectItem value="outline">{tr("Contorno", "Outline")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <Label className="block">{tr("Publicada", "Published")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {page.is_published
                      ? tr("Visível ao público", "Publicly visible")
                      : tr("Oculta", "Hidden")}
                  </p>
                </div>
                <Switch
                  checked={page.is_published}
                  onCheckedChange={(v) => updatePage({ is_published: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {tr("Visualizações totais", "Total views")}:{" "}
                <strong className="text-foreground">{page.views_count}</strong>
              </span>
              {saving && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> {tr("salvando…", "saving…")}
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Add link */}
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">{tr("Adicionar link", "Add link")}</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_180px_auto]">
            <Input
              placeholder={tr("Título (ex.: Meu Instagram)", "Title (e.g. My Instagram)")}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Input
              placeholder="https://…"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
            <Select value={newIcon} onValueChange={setNewIcon}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_PRESETS.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {tr(i.pt, i.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addLink}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {links.length === 0 && (
            <button
              onClick={seedTemplates}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-primary hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" />{" "}
              {tr(
                "Adicionar modelos iniciais (Venyx, Instagram, TikTok e Pix)",
                "Add starter templates (Venyx, Instagram, TikTok and Pix)",
              )}
            </button>
          )}
        </Card>

        {/* Lista */}
        <div className="space-y-2">
          {loadingData && (
            <div className="text-sm text-muted-foreground">{tr("Carregando…", "Loading…")}</div>
          )}
          {!loadingData && links.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {tr(
                "Nenhum link ainda. Adicione um acima ou use os modelos.",
                "No links yet. Add one above or use the templates.",
              )}
            </p>
          )}
          {links.map((l, i) => (
            <Card
              key={l.id}
              className={`flex items-center gap-3 p-3 transition ${!l.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(l.id, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(l.id, 1)}
                  disabled={i === links.length - 1}
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={l.title}
                    onChange={(e) =>
                      setLinks((arr) =>
                        arr.map((x) => (x.id === l.id ? { ...x, title: e.target.value } : x)),
                      )
                    }
                    onBlur={() => updateLink(l.id, { title: l.title })}
                    className="h-8 text-sm font-medium"
                  />
                  {l.is_featured && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    value={l.url}
                    onChange={(e) =>
                      setLinks((arr) =>
                        arr.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)),
                      )
                    }
                    onBlur={() => updateLink(l.id, { url: l.url })}
                    className="h-7 text-xs text-muted-foreground"
                  />
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {l.clicks_count} {tr("cliques", "clicks")}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch
                  checked={l.is_active}
                  onCheckedChange={(v) => updateLink(l.id, { is_active: v })}
                />
                <button
                  onClick={() => updateLink(l.id, { is_featured: !l.is_featured })}
                  className={`rounded p-1 transition ${l.is_featured ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                  title={tr("Destacar", "Feature")}
                >
                  <Star className={`h-4 w-4 ${l.is_featured ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={() => removeLink(l.id)}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

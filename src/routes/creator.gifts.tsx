import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Gift, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { GiftProductImage } from "@/components/GiftProductImage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { GIFT_PRESETS, type GiftPreset } from "@/lib/demo-gifts";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/creator/gifts")({ component: CreatorGiftsPage });

type GiftSettings = Tables<"creator_gift_settings">;
type GiftItem = Tables<"creator_gift_items">;
type Draft = Pick<
  GiftItem,
  | "title"
  | "description"
  | "emoji"
  | "image_url"
  | "value_cents"
  | "availability"
  | "track_stock"
  | "stock_quantity"
  | "is_active"
>;

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  emoji: "🎁",
  image_url: null,
  value_cents: 10000,
  availability: "available",
  track_stock: false,
  stock_quantity: null,
  is_active: true,
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function errorMessage(error: { message?: string } | null, tr: (pt: string, en: string) => string) {
  if (error?.message?.includes("VENYX_KYC_REQUIRED"))
    return tr(
      "Conclua e aprove o KYC antes de publicar.",
      "Complete and approve KYC before publishing.",
    );
  if (error?.message?.includes("VENYX_CONSENT_REQUIRED"))
    return tr(
      "Aceite os consentimentos obrigatórios antes de publicar.",
      "Accept the required consents before publishing.",
    );
  if (error?.message?.includes("VENYX_PROFILE_REQUIRED"))
    return tr("Complete seu perfil antes de publicar.", "Complete your profile before publishing.");
  if (error?.message?.includes("VENYX_PAYOUT_KEY_REQUIRED"))
    return tr(
      "Cadastre sua chave de recebimento antes de publicar.",
      "Add your payout key before publishing.",
    );
  return error?.message || tr("Não foi possível salvar.", "Could not save.");
}

export function CreatorGiftsPage() {
  const { user, profile, isCreator, loading } = useAuth();
  const { tr } = useI18n();
  const [settings, setSettings] = useState<GiftSettings | null>(null);
  const [items, setItems] = useState<GiftItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoadingData(true);
    const [{ data: currentSettings }, { data: currentItems }] = await Promise.all([
      supabase.from("creator_gift_settings").select("*").eq("creator_id", user.id).maybeSingle(),
      supabase.from("creator_gift_items").select("*").eq("creator_id", user.id).order("position"),
    ]);
    if (currentSettings) {
      setSettings(currentSettings);
    } else {
      const { data, error } = await supabase
        .from("creator_gift_settings")
        .insert({ creator_id: user.id })
        .select()
        .single();
      if (error) toast.error(errorMessage(error, tr));
      setSettings(data ?? null);
    }
    setItems(currentItems ?? []);
    setLoadingData(false);
  };

  useEffect(() => {
    if (user && isCreator) void load();
  }, [user, isCreator]);

  const updateSettings = async (patch: Partial<GiftSettings>) => {
    if (!user || !settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    const { error } = await supabase
      .from("creator_gift_settings")
      .update(patch)
      .eq("creator_id", user.id);
    if (error) {
      setSettings(previous);
      toast.error(errorMessage(error, tr));
    }
  };

  const openNew = (preset?: GiftPreset) => {
    setEditingId(null);
    setImageFile(null);
    setDraft(
      preset
        ? {
            title: preset.title,
            description: preset.description,
            emoji: preset.emoji,
            image_url: preset.image_url,
            value_cents: preset.value_cents,
            availability: preset.availability,
            track_stock: preset.track_stock,
            stock_quantity: preset.stock_quantity,
            is_active: true,
          }
        : { ...EMPTY_DRAFT },
    );
    setDialogOpen(true);
  };

  const openEdit = (item: GiftItem) => {
    setEditingId(item.id);
    setImageFile(null);
    setDraft({
      title: item.title,
      description: item.description,
      emoji: item.emoji,
      image_url: item.image_url,
      value_cents: item.value_cents,
      availability: item.availability,
      track_stock: item.track_stock,
      stock_quantity: item.stock_quantity,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const saveItem = async () => {
    if (!user || !draft.title.trim() || draft.value_cents < 100) {
      toast.error(tr("Preencha nome e valor do mimo.", "Enter the gift name and value."));
      return;
    }
    if (draft.track_stock && (draft.stock_quantity === null || draft.stock_quantity < 0)) {
      toast.error(tr("Informe uma quantidade de estoque válida.", "Enter a valid stock quantity."));
      return;
    }
    setSaving(true);
    let imageUrl = draft.image_url;
    if (imageFile) {
      if (!imageFile.type.startsWith("image/") || imageFile.size > 5 * 1024 * 1024) {
        toast.error(tr("Envie uma imagem de até 5 MB.", "Upload an image up to 5 MB."));
        setSaving(false);
        return;
      }
      const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("gift-products")
        .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
      if (uploadError) {
        toast.error(errorMessage(uploadError, tr));
        setSaving(false);
        return;
      }
      imageUrl = supabase.storage.from("gift-products").getPublicUrl(path).data.publicUrl;
    }
    const payload = {
      ...draft,
      category: "custom",
      image_url: imageUrl,
      stock_quantity: draft.track_stock ? draft.stock_quantity : null,
      title: draft.title.trim(),
      description: draft.description.trim(),
    };
    const result = editingId
      ? await supabase.from("creator_gift_items").update(payload).eq("id", editingId)
      : await supabase
          .from("creator_gift_items")
          .insert({ ...payload, creator_id: user.id, position: items.length });
    if (result.error) {
      toast.error(errorMessage(result.error, tr));
      setSaving(false);
      return;
    }
    toast.success(
      editingId ? tr("Mimo atualizado.", "Gift updated.") : tr("Mimo adicionado.", "Gift added."),
    );
    setDialogOpen(false);
    setSaving(false);
    await load();
  };

  const updateItem = async (id: string, patch: Partial<GiftItem>) => {
    const { error } = await supabase.from("creator_gift_items").update(patch).eq("id", id);
    if (error) toast.error(errorMessage(error, tr));
    await load();
  };

  const move = async (item: GiftItem, direction: -1 | 1) => {
    const index = items.findIndex((current) => current.id === item.id);
    const other = items[index + direction];
    if (!other) return;
    await Promise.all([
      supabase.from("creator_gift_items").update({ position: other.position }).eq("id", item.id),
      supabase.from("creator_gift_items").update({ position: item.position }).eq("id", other.id),
    ]);
    await load();
  };

  const remove = async (item: GiftItem) => {
    if (!confirm(tr(`Remover “${item.title}”?`, `Remove “${item.title}”?`))) return;
    const { error } = await supabase.from("creator_gift_items").delete().eq("id", item.id);
    if (error) toast.error(errorMessage(error, tr));
    else toast.success(tr("Mimo removido.", "Gift removed."));
    await load();
  };

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">{tr("Carregando…", "Loading…")}</div>
    );
  if (!isCreator)
    return (
      <div className="p-8 text-center text-muted-foreground">
        {tr("A Lista de Mimos é exclusiva para criadoras.", "The Gift List is for creators only.")}
      </div>
    );
  if (loadingData)
    return (
      <div className="p-8 text-center text-muted-foreground">{tr("Carregando…", "Loading…")}</div>
    );

  const publicUrl =
    profile && typeof window !== "undefined"
      ? `${window.location.origin}/gifts/${profile.username}`
      : "";
  const activeCount = items.filter(
    (item) => item.is_active && (!item.track_stock || (item.stock_quantity ?? 0) > 0),
  ).length;
  const totalReceived = items.reduce((sum, item) => sum + item.received_cents, 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="rounded-2xl bg-primary/10 p-3">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tr("Lista de Mimos", "Gift List")}</h1>
              <p className="text-sm text-muted-foreground">
                {tr(
                  "Use produtos base da Fanlira ou adicione produtos personalizados à sua lista.",
                  "Use Fanlira base products or add custom products to your list.",
                )}
              </p>
            </div>
          </div>
          {profile && (
            <Button variant="outline" asChild>
              <Link to="/gifts/$username" params={{ username: profile.username }} target="_blank">
                <Eye className="mr-2 h-4 w-4" />
                {tr("Ver página pública", "View public page")}
              </Link>
            </Button>
          )}
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">
              {tr("Produtos ativos", "Active products")}
            </div>
            <strong className="mt-1 block text-2xl">{activeCount}</strong>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">
              {tr("Mimos recebidos", "Gifts received")}
            </div>
            <strong className="mt-1 block text-2xl">
              {items.reduce((sum, item) => sum + item.received_count, 0)}
            </strong>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">
              {tr("Valor bruto recebido", "Gross amount received")}
            </div>
            <strong className="mt-1 block text-2xl text-primary">{money(totalReceived)}</strong>
          </Card>
        </section>

        {settings && (
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">{tr("Página pública", "Public page")}</h2>
                <p className="text-xs text-muted-foreground">{publicUrl}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="gift-published">
                  {settings.is_published ? tr("Publicada", "Published") : tr("Rascunho", "Draft")}
                </Label>
                <Switch
                  id="gift-published"
                  checked={settings.is_published}
                  disabled={activeCount === 0}
                  onCheckedChange={(value) => void updateSettings({ is_published: value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tr("Título", "Title")}</Label>
                <Input
                  value={settings.title}
                  maxLength={80}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                  onBlur={() =>
                    void updateSettings({ title: settings.title.trim() || "Minha Lista de Mimos" })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tr("Mensagem após o envio", "Message after sending")}</Label>
                <Input
                  value={settings.thank_you_message}
                  maxLength={200}
                  onChange={(e) => setSettings({ ...settings, thank_you_message: e.target.value })}
                  onBlur={() =>
                    void updateSettings({ thank_you_message: settings.thank_you_message })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr("Apresentação", "Introduction")}</Label>
              <Textarea
                value={settings.intro}
                maxLength={300}
                onChange={(e) => setSettings({ ...settings, intro: e.target.value })}
                onBlur={() => void updateSettings({ intro: settings.intro })}
              />
            </div>
            {activeCount === 0 && (
              <p className="text-xs text-amber-600">
                {tr(
                  "Adicione e ative pelo menos um produto disponível para publicar.",
                  "Add and enable at least one available product to publish.",
                )}
              </p>
            )}
          </Card>
        )}

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{tr("Catálogo de produtos", "Product catalog")}</h2>
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Comece com um produto base ou crie algo personalizado.",
                  "Start with a base product or create something custom.",
                )}
              </p>
            </div>
            <Button onClick={() => openNew()}>
              <Plus className="mr-2 h-4 w-4" />
              {tr("Novo produto", "New product")}
            </Button>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr("Produtos base da Fanlira", "Fanlira base products")}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {GIFT_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => openNew(preset)}
                  className="shrink-0 rounded-full border border-border bg-background px-3 py-2 text-xs hover:border-primary"
                >
                  <span className="mr-1">{preset.emoji}</span>
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {tr(
                "Sua lista ainda está vazia. Escolha um produto base ou adicione um novo.",
                "Your list is empty. Choose a base product or add a new one.",
              )}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 ${item.is_active ? "border-border bg-background" : "border-dashed opacity-65"}`}
                >
                  <div className="flex gap-3">
                    <GiftProductImage
                      src={item.image_url}
                      alt={item.title}
                      emoji={item.emoji}
                      className="h-24 w-[4.8rem] shrink-0 rounded-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {item.availability === "on_request"
                              ? tr("Sob encomenda", "On request")
                              : tr("Disponível agora", "Available now")}
                            {item.track_stock
                              ? ` · ${item.stock_quantity ?? 0} ${tr("em estoque", "in stock")}`
                              : ""}
                          </p>
                        </div>
                        <strong className="text-primary">{money(item.value_cents)}</strong>
                      </div>
                      {item.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                      )}
                      <p className="mt-3 text-xs text-muted-foreground">
                        {item.received_count} {tr("recebidos", "received")} ·{" "}
                        {money(item.received_cents)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={(value) => void updateItem(item.id, { is_active: value })}
                      />
                      <span className="text-xs">
                        {item.is_active ? tr("Ativo", "Active") : tr("Pausado", "Paused")}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => void move(item, -1)}
                        aria-label={tr("Mover para cima", "Move up")}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === items.length - 1}
                        onClick={() => void move(item, 1)}
                        aria-label={tr("Mover para baixo", "Move down")}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(item)}
                        aria-label={tr("Editar", "Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        aria-label={tr("Remover", "Remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? tr("Editar produto", "Edit product")
                : tr("Adicionar produto", "Add product")}
            </DialogTitle>
            <DialogDescription>
              {tr(
                "Defina como o produto aparecerá para os clientes da modelo.",
                "Define how the product appears to the creator's fans.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 sm:grid-cols-[112px_1fr]">
              <GiftProductImage
                src={draft.image_url}
                alt={draft.title || tr("Prévia do produto", "Product preview")}
                emoji={draft.emoji}
                className="aspect-[4/5] w-full rounded-2xl border border-border"
              />
              <div className="space-y-2">
                <Label>{tr("Imagem do produto", "Product image")}</Label>
                <p className="text-[11px] text-muted-foreground">
                  {tr(
                    "Fotos verticais são reconhecidas e exibidas inteiras automaticamente.",
                    "Portrait photos are detected and shown in full automatically.",
                  )}
                </p>
                <label className="flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted">
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {imageFile ? imageFile.name : tr("Escolher arquivo", "Choose file")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <Input
                  value={draft.image_url ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, image_url: event.target.value.trim() || null })
                  }
                  placeholder={tr("Ou cole a URL da imagem", "Or paste an image URL")}
                />
              </div>
            </div>
            <div className="grid grid-cols-[84px_1fr] gap-3">
              <div className="space-y-2">
                <Label>{tr("Ícone", "Icon")}</Label>
                <Input
                  value={draft.emoji}
                  maxLength={16}
                  onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr("Nome", "Name")}</Label>
                <Input
                  value={draft.title}
                  maxLength={80}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr("Descrição", "Description")}</Label>
              <Textarea
                value={draft.description}
                maxLength={300}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{tr("Disponibilidade", "Availability")}</Label>
                <Select
                  value={draft.availability}
                  onValueChange={(availability) => setDraft({ ...draft, availability })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">
                      {tr("Disponível agora", "Available now")}
                    </SelectItem>
                    <SelectItem value="on_request">
                      {tr("Sob encomenda", "Available on request")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr("Valor (R$)", "Price (BRL)")}</Label>
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  step="0.5"
                  value={(draft.value_cents / 100).toString()}
                  onChange={(e) =>
                    setDraft({ ...draft, value_cents: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="gift-track-stock">{tr("Controlar estoque", "Track stock")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {tr(
                      "Ao chegar a zero, o produto deixa de aparecer para o lead.",
                      "At zero, the product is hidden from fans.",
                    )}
                  </p>
                </div>
                <Switch
                  id="gift-track-stock"
                  checked={draft.track_stock}
                  onCheckedChange={(track_stock) =>
                    setDraft({
                      ...draft,
                      track_stock,
                      stock_quantity: track_stock ? (draft.stock_quantity ?? 0) : null,
                    })
                  }
                />
              </div>
              {draft.track_stock && (
                <div className="mt-3 space-y-2">
                  <Label>{tr("Quantidade em estoque", "Stock quantity")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.stock_quantity ?? 0}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        stock_quantity: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                      })
                    }
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <Label htmlFor="gift-active">{tr("Produto ativo", "Active product")}</Label>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    "Produtos desativados não aparecem para o lead.",
                    "Disabled products are hidden from fans.",
                  )}
                </p>
              </div>
              <Switch
                id="gift-active"
                checked={draft.is_active}
                onCheckedChange={(is_active) => setDraft({ ...draft, is_active })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button disabled={saving} onClick={() => void saveItem()}>
              {saving ? tr("Salvando…", "Saving…") : tr("Salvar produto", "Save product")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

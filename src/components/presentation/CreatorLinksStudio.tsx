import { useEffect, useState, type ReactNode } from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Copy,
  ExternalLink,
  Gift,
  Globe,
  Instagram,
  Link2,
  Megaphone,
  Music2,
  Pin,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CreatorPixelManager } from "@/components/presentation/CreatorPixelManager";
import { normalizeCreatorLinkUrl } from "@/lib/creator-link-url";
import {
  DEMO_LINKS_CHANGED_EVENT,
  buildDemoTrackingUrl,
  createDemoLinksSeed,
  createDemoPageLink,
  createDemoTrackingLink,
  demoLinkButtonRadius,
  demoLinkFontFamily,
  demoTrackingLinkAvailable,
  readDemoLinksState,
  writeDemoLinksState,
  type DemoLinkIcon,
  type DemoLinkPageSettings,
  type DemoLinksState,
  type DemoTrackingChannel,
} from "@/lib/demo-links";
import { useI18n } from "@/lib/i18n";

const PAGE_TEMPLATES: Array<{
  id: string;
  label: string;
  colors: Pick<
    DemoLinkPageSettings,
    "backgroundColor" | "buttonColor" | "textColor" | "buttonTextColor" | "accentColor"
  >;
}> = [
  {
    id: "champagne",
    label: "Champagne",
    colors: {
      backgroundColor: "#24140d",
      buttonColor: "#4a2f1d",
      textColor: "#f8e9c8",
      buttonTextColor: "#fff3d6",
      accentColor: "#d7a85d",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    colors: {
      backgroundColor: "#100813",
      buttonColor: "#28162d",
      textColor: "#f2e8f5",
      buttonTextColor: "#ffffff",
      accentColor: "#b28bc2",
    },
  },
  {
    id: "rose",
    label: "Rosé",
    colors: {
      backgroundColor: "#32101f",
      buttonColor: "#6b2945",
      textColor: "#ffe7f0",
      buttonTextColor: "#fff6fa",
      accentColor: "#f2a7c4",
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    colors: {
      backgroundColor: "#f7f2ef",
      buttonColor: "#ffffff",
      textColor: "#251b1d",
      buttonTextColor: "#251b1d",
      accentColor: "#a56b78",
    },
  },
];

const LINK_SUGGESTIONS: Array<{
  title: string;
  url: string;
  icon: DemoLinkIcon;
}> = [
  { title: "Minha Lista de Mimos", url: "/gifts/aline", icon: "gift" },
  { title: "Meu perfil na Fanlira", url: "/profile/aline", icon: "venyx" },
  { title: "Instagram", url: "https://instagram.com/", icon: "instagram" },
  { title: "TikTok", url: "https://tiktok.com/", icon: "tiktok" },
];

function iconForLink(icon: DemoLinkIcon) {
  if (icon === "instagram") return Instagram;
  if (icon === "tiktok") return Music2;
  if (icon === "venyx") return Link2;
  if (icon === "gift") return Gift;
  if (icon === "campaign") return Megaphone;
  if (icon === "coupon") return Tag;
  return Globe;
}

function validDestination(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return normalizeCreatorLinkUrl(value);
}

function channelLabel(channel: DemoTrackingChannel) {
  if (channel === "instagram") return "Instagram";
  if (channel === "tiktok") return "TikTok";
  if (channel === "meta_ads") return "Meta Ads";
  if (channel === "google_ads") return "Google Ads";
  if (channel === "campaign") return "Campanha";
  if (channel === "coupon") return "Cupom";
  return "Link próprio";
}

export function CreatorLinksStudio({ userId }: { userId: string }) {
  const { tr, locale } = useI18n();
  const [state, setState] = useState<DemoLinksState>(() => readDemoLinksState());
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState<DemoLinkIcon>("globe");
  const [newText, setNewText] = useState("");
  const [trackingName, setTrackingName] = useState("");
  const [trackingChannel, setTrackingChannel] = useState<DemoTrackingChannel>("instagram");
  const [trackingDestination, setTrackingDestination] = useState("/profile/aline");
  const [trackingCampaign, setTrackingCampaign] = useState("");
  const [trackingContent, setTrackingContent] = useState("");
  const [trackingCoupon, setTrackingCoupon] = useState("");
  const [trackingExpiration, setTrackingExpiration] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "https://fanlira.com.br";
  const publicUrl = `${origin}/links/aline`;

  useEffect(() => {
    const load = () => setState(readDemoLinksState());
    window.addEventListener(DEMO_LINKS_CHANGED_EVENT, load);
    return () => window.removeEventListener(DEMO_LINKS_CHANGED_EVENT, load);
  }, [userId]);

  const save = (next: DemoLinksState) => {
    setState(writeDemoLinksState(next));
  };

  const updatePage = (patch: Partial<DemoLinkPageSettings>) => {
    save({
      ...state,
      page: { ...state.page, ...patch, updatedAt: new Date().toISOString() },
    });
  };

  const updateLink = (id: string, patch: Partial<(typeof state.links)[number]>) => {
    save({
      ...state,
      links: state.links.map((link) => (link.id === id ? { ...link, ...patch } : link)),
    });
  };

  const moveLink = (id: string, direction: -1 | 1) => {
    const index = state.links.findIndex((link) => link.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.links.length) return;
    const links = [...state.links];
    [links[index], links[target]] = [links[target], links[index]];
    save({ ...state, links });
  };

  const addPageLink = (title = newTitle, url = newUrl, icon = newIcon) => {
    const destination = validDestination(url.trim());
    if (!title.trim() || !destination) {
      toast.error(tr("Informe um título e um endereço válido.", "Enter a title and valid URL."));
      return;
    }
    save({
      ...state,
      links: [
        ...state.links,
        createDemoPageLink({
          kind: "link",
          title: title.trim(),
          url: destination,
          icon,
          active: true,
          featured: false,
        }),
      ],
    });
    setNewTitle("");
    setNewUrl("");
    setNewIcon("globe");
    toast.success(tr("Link adicionado à página.", "Link added to the page."));
  };

  const addTextBlock = () => {
    if (!newText.trim()) {
      toast.error(tr("Escreva o texto que deseja adicionar.", "Enter the text to add."));
      return;
    }
    save({
      ...state,
      links: [
        ...state.links,
        createDemoPageLink({
          kind: "text",
          title: newText.trim(),
          url: "",
          icon: "globe",
          active: true,
          featured: false,
        }),
      ],
    });
    setNewText("");
    toast.success(tr("Bloco de texto adicionado.", "Text block added."));
  };

  const uploadImage = (file: File | undefined, field: "avatarUrl" | "bannerUrl") => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1024 * 1024) {
      toast.error(tr("Use uma imagem de até 1 MB.", "Use an image up to 1 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updatePage({ [field]: String(reader.result ?? "") });
    reader.readAsDataURL(file);
  };

  const createTracking = () => {
    const destination = validDestination(trackingDestination.trim());
    const needsCampaign = ["meta_ads", "google_ads", "campaign"].includes(trackingChannel);
    if (!trackingName.trim() || !destination) {
      toast.error(
        tr("Informe o nome e o destino do link.", "Enter the link name and destination."),
      );
      return;
    }
    if (needsCampaign && !trackingCampaign.trim()) {
      toast.error(tr("Informe o nome da campanha.", "Enter the campaign name."));
      return;
    }
    if (trackingChannel === "coupon" && !trackingCoupon.trim()) {
      toast.error(tr("Informe o código do cupom.", "Enter the coupon code."));
      return;
    }
    const link = createDemoTrackingLink({
      name: trackingName,
      channel: trackingChannel,
      destinationUrl: destination,
      campaign: trackingCampaign,
      content: trackingContent,
      couponCode: trackingCoupon,
      expiresAt: trackingExpiration,
    });
    save({ ...state, trackingLinks: [link, ...state.trackingLinks] });
    setTrackingName("");
    setTrackingCampaign("");
    setTrackingContent("");
    setTrackingCoupon("");
    setTrackingExpiration("");
    toast.success(tr("Link rastreável criado.", "Trackable link created."));
  };

  const totalClicks = state.trackingLinks.reduce((total, link) => total + link.clicks, 0);
  const totalConversions = state.trackingLinks.reduce((total, link) => total + link.conversions, 0);
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const pageClicks = state.links.reduce((total, link) => total + link.clicks, 0);
  const pageClickRate = state.views > 0 ? (pageClicks / state.views) * 100 : 0;

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Link2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">
                {tr("1. Página de Links", "1. Link Page")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {tr(
                  "Sua página pública no estilo Linktree/Beacons, com identidade visual, redes, perfil, ofertas e chamadas para assinatura.",
                  "Your public Linktree/Beacons-style page with branding, social profiles, offers and subscription calls to action.",
                )}
              </p>
            </div>
          </div>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <BarChart3 className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <h3 className="font-semibold text-foreground">
                {tr("2. Links Rastreáveis", "2. Trackable Links")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {tr(
                  "Crie URLs para Instagram, TikTok, anúncios, campanhas e cupons. Os identificadores alimentam a origem das visitas no Analytics.",
                  "Create URLs for Instagram, TikTok, ads, campaigns and coupons. Their identifiers feed traffic-source analytics.",
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="page" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-background p-1">
          <TabsTrigger value="page" className="gap-2 py-2.5">
            <Link2 className="h-4 w-4" /> {tr("Página de Links", "Link Page")}
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-2 py-2.5">
            <BarChart3 className="h-4 w-4" /> {tr("Links Rastreáveis", "Trackable Links")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="page" className="space-y-5">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {tr("Endereço público", "Public address")}
              </div>
              <div className="truncate text-sm font-semibold text-foreground">{publicUrl}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {tr(
                  "No lançamento, este endereço usará o domínio oficial da Fanlira.",
                  "At launch, this address will use the official Fanlira domain.",
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(publicUrl);
                  toast.success(tr("Endereço copiado.", "Address copied."));
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> {tr("Copiar", "Copy")}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/links/aline" target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {tr("Visualizar", "Preview")}
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={tr("Visualizações da página", "Page views")}
              value={state.views.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}
            />
            <Metric
              label={tr("Cliques nos botões", "Button clicks")}
              value={pageClicks.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}
            />
            <Metric
              label={tr("Taxa de clique", "Click-through rate")}
              value={
                pageClickRate.toLocaleString(locale === "en" ? "en-US" : "pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }) + "%"
              }
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
            <div className="space-y-5">
              <Card className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {tr("Identidade da página", "Page identity")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {tr(
                        "Título, descrição, foto e banner independentes.",
                        "Independent title, description, photo and banner.",
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="links-published" className="text-xs">
                      {state.page.isPublished
                        ? tr("Publicada", "Published")
                        : tr("Oculta", "Hidden")}
                    </Label>
                    <Switch
                      id="links-published"
                      checked={state.page.isPublished}
                      onCheckedChange={(isPublished) => updatePage({ isPublished })}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="links-title">{tr("Título", "Title")}</Label>
                    <Input
                      id="links-title"
                      value={state.page.title}
                      onChange={(event) => updatePage({ title: event.target.value })}
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="links-font">{tr("Fonte", "Font")}</Label>
                    <Select
                      value={state.page.font}
                      onValueChange={(font) =>
                        updatePage({ font: font as DemoLinkPageSettings["font"] })
                      }
                    >
                      <SelectTrigger id="links-font">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="playfair">Playfair</SelectItem>
                        <SelectItem value="inter">Inter</SelectItem>
                        <SelectItem value="poppins">Poppins</SelectItem>
                        <SelectItem value="cursive">Cursiva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="links-description">{tr("Descrição", "Description")}</Label>
                  <Textarea
                    id="links-description"
                    value={state.page.description}
                    onChange={(event) => updatePage({ description: event.target.value })}
                    maxLength={220}
                    rows={3}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="links-avatar">{tr("Foto de perfil", "Profile photo")}</Label>
                    <Input
                      id="links-avatar"
                      type="file"
                      accept="image/*"
                      onChange={(event) => uploadImage(event.target.files?.[0], "avatarUrl")}
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        id="links-show-avatar"
                        checked={state.page.showAvatar}
                        onCheckedChange={(showAvatar) => updatePage({ showAvatar })}
                      />
                      <Label htmlFor="links-show-avatar" className="text-xs">
                        {tr("Mostrar foto", "Show photo")}
                      </Label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="links-banner">{tr("Banner", "Banner")}</Label>
                    <Input
                      id="links-banner"
                      type="file"
                      accept="image/*"
                      onChange={(event) => uploadImage(event.target.files?.[0], "bannerUrl")}
                    />
                    {state.page.bannerUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-destructive"
                        onClick={() => updatePage({ bannerUrl: "" })}
                      >
                        {tr("Remover banner", "Remove banner")}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="space-y-4 p-5">
                <div>
                  <h3 className="font-semibold text-foreground">{tr("Aparência", "Appearance")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {tr(
                      "Use um modelo pronto ou personalize cada cor.",
                      "Use a preset or customize every color.",
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PAGE_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => updatePage(template.colors)}
                      className="rounded-xl border border-border p-2 text-left transition hover:border-primary"
                    >
                      <span
                        className="block h-10 rounded-lg"
                        style={{
                          background: template.colors.backgroundColor,
                          border: `2px solid ${template.colors.accentColor}`,
                        }}
                      />
                      <span className="mt-1.5 block text-xs font-medium text-foreground">
                        {template.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["backgroundColor", tr("Fundo", "Background")],
                    ["buttonColor", tr("Botões", "Buttons")],
                    ["textColor", tr("Texto", "Text")],
                    ["buttonTextColor", tr("Texto dos botões", "Button text")],
                    ["accentColor", tr("Destaque", "Accent")],
                  ].map(([field, label]) => (
                    <div key={field} className="space-y-1.5">
                      <Label htmlFor={`links-${field}`} className="text-xs">
                        {label}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`links-${field}`}
                          type="color"
                          value={state.page[field as keyof DemoLinkPageSettings] as string}
                          onChange={(event) => updatePage({ [field]: event.target.value })}
                          className="h-10 w-14 cursor-pointer p-1"
                        />
                        <code className="text-[11px] text-muted-foreground">
                          {state.page[field as keyof DemoLinkPageSettings] as string}
                        </code>
                      </div>
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <Label htmlFor="links-button-style" className="text-xs">
                      {tr("Formato dos botões", "Button shape")}
                    </Label>
                    <Select
                      value={state.page.buttonStyle}
                      onValueChange={(buttonStyle) =>
                        updatePage({
                          buttonStyle: buttonStyle as DemoLinkPageSettings["buttonStyle"],
                        })
                      }
                    >
                      <SelectTrigger id="links-button-style">
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
                </div>
              </Card>

              <Card className="space-y-4 p-5">
                <div>
                  <h3 className="font-semibold text-foreground">
                    {tr("Links da página", "Page links")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {tr(
                      "Edite, destaque, oculte, reorganize ou remova.",
                      "Edit, feature, hide, reorder or remove.",
                    )}
                  </p>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    {tr("Quatro sugestões prontas", "Four ready-made suggestions")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {LINK_SUGGESTIONS.map((suggestion) => (
                      <Button
                        key={suggestion.title}
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          addPageLink(suggestion.title, suggestion.url, suggestion.icon)
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> {suggestion.title}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_1.3fr_150px_auto]">
                  <Input
                    aria-label={tr("Título do novo link", "New link title")}
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder={tr("Título do link", "Link title")}
                  />
                  <Input
                    aria-label={tr("Endereço do novo link", "New link URL")}
                    value={newUrl}
                    onChange={(event) => setNewUrl(event.target.value)}
                    placeholder="https://..."
                  />
                  <Select
                    value={newIcon}
                    onValueChange={(icon) => setNewIcon(icon as DemoLinkIcon)}
                  >
                    <SelectTrigger aria-label={tr("Ícone do novo link", "New link icon")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="globe">Site</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="venyx">Fanlira</SelectItem>
                      <SelectItem value="gift">Mimo</SelectItem>
                      <SelectItem value="campaign">Campanha</SelectItem>
                      <SelectItem value="coupon">Cupom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => addPageLink()}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    {tr("Adicionar", "Add")}
                  </Button>
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3 sm:flex-row">
                  <Input
                    aria-label={tr("Novo bloco de texto", "New text block")}
                    value={newText}
                    onChange={(event) => setNewText(event.target.value)}
                    placeholder={tr(
                      "Texto livre entre os links (ex.: Conteúdos exclusivos)",
                      "Free text between links (e.g. Exclusive content)",
                    )}
                    maxLength={160}
                  />
                  <Button variant="outline" onClick={addTextBlock}>
                    <AlignLeft className="mr-1.5 h-4 w-4" />
                    {tr("Adicionar texto", "Add text")}
                  </Button>
                </div>
                <div className="space-y-3">
                  {state.links.map((link, index) => {
                    const Icon = link.kind === "text" ? AlignLeft : iconForLink(link.icon);
                    return (
                      <div
                        key={link.id}
                        className="rounded-xl border border-border bg-background p-3"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div
                            className={
                              link.kind === "link"
                                ? "grid min-w-0 flex-1 gap-2 sm:grid-cols-[.8fr_1.2fr]"
                                : "grid min-w-0 flex-1 gap-2"
                            }
                          >
                            <Input
                              value={link.title}
                              onChange={(event) =>
                                updateLink(link.id, { title: event.target.value })
                              }
                              aria-label={`${tr("Título", "Title")}: ${link.title}`}
                            />
                            {link.kind === "link" && (
                              <Input
                                value={link.url}
                                onChange={(event) =>
                                  updateLink(link.id, { url: event.target.value })
                                }
                                aria-label={`${tr("Endereço", "URL")}: ${link.title}`}
                              />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => moveLink(link.id, -1)}
                              disabled={index === 0}
                              aria-label={tr("Mover para cima", "Move up")}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => moveLink(link.id, 1)}
                              disabled={index === state.links.length - 1}
                              aria-label={tr("Mover para baixo", "Move down")}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            {link.kind === "link" && (
                              <Button
                                size="icon"
                                variant={link.featured ? "default" : "outline"}
                                onClick={() => updateLink(link.id, { featured: !link.featured })}
                                aria-label={tr("Alternar destaque", "Toggle featured")}
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Switch
                              checked={link.active}
                              onCheckedChange={(active) => updateLink(link.id, { active })}
                              aria-label={`${tr("Mostrar", "Show")}: ${link.title}`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() =>
                                save({
                                  ...state,
                                  links: state.links.filter((item) => item.id !== link.id),
                                })
                              }
                              aria-label={tr("Remover link", "Remove link")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {link.kind === "text" ? (
                            tr("Bloco de texto", "Text block")
                          ) : (
                            <span>
                              {link.clicks.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}{" "}
                              {tr("cliques", "clicks")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="xl:sticky xl:top-5 xl:self-start">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {tr("Prévia ao vivo", "Live preview")}
                </h3>
                <span className="text-[11px] text-muted-foreground">390 × 720</span>
              </div>
              <DemoLinksPreview state={state} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={tr("Cliques rastreados", "Tracked clicks")}
              value={totalClicks.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}
            />
            <Metric label={tr("Conversões", "Conversions")} value={totalConversions.toString()} />
            <Metric
              label={tr("Taxa de conversão", "Conversion rate")}
              value={`${conversionRate.toLocaleString(locale === "en" ? "en-US" : "pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
            />
          </div>

          <Card className="space-y-4 p-5">
            <div>
              <h3 className="font-semibold text-foreground">
                {tr("Criar link rastreável", "Create trackable link")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {tr(
                  "A origem e o meio são preenchidos pelo canal. Campanhas geram UTM e cupons têm prioridade própria no Analytics.",
                  "Source and medium are filled from the channel. Campaigns generate UTM parameters and coupons have their own analytics priority.",
                )}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Field label={tr("Nome interno", "Internal name")}>
                <Input
                  value={trackingName}
                  onChange={(event) => setTrackingName(event.target.value)}
                  placeholder={tr("Ex.: Bio Instagram", "E.g. Instagram bio")}
                />
              </Field>
              <Field label={tr("Canal", "Channel")}>
                <Select
                  value={trackingChannel}
                  onValueChange={(channel) => setTrackingChannel(channel as DemoTrackingChannel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="google_ads">Google Ads</SelectItem>
                    <SelectItem value="campaign">Campanha própria</SelectItem>
                    <SelectItem value="coupon">Cupom</SelectItem>
                    <SelectItem value="custom">Link próprio</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tr("Destino", "Destination")}>
                <Input
                  value={trackingDestination}
                  onChange={(event) => setTrackingDestination(event.target.value)}
                  placeholder="/profile/aline"
                />
              </Field>
              <Field label="UTM campaign">
                <Input
                  value={trackingCampaign}
                  onChange={(event) => setTrackingCampaign(event.target.value)}
                  placeholder="lancamento_agosto"
                />
              </Field>
              <Field label="UTM content">
                <Input
                  value={trackingContent}
                  onChange={(event) => setTrackingContent(event.target.value)}
                  placeholder="criativo_01"
                />
              </Field>
              <Field label={tr("Código do cupom", "Coupon code")}>
                <Input
                  value={trackingCoupon}
                  onChange={(event) => setTrackingCoupon(event.target.value.toUpperCase())}
                  placeholder="BEMVINDA20"
                />
              </Field>
              <Field label={tr("Expira em (opcional)", "Expires on (optional)")}>
                <Input
                  type="date"
                  value={trackingExpiration}
                  onChange={(event) => setTrackingExpiration(event.target.value)}
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button onClick={createTracking}>
                <Plus className="mr-1.5 h-4 w-4" />
                {tr("Criar link", "Create link")}
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <div>
              <h3 className="font-semibold text-foreground">
                {tr("Links criados", "Created links")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Copie para testar em bios, posts, anúncios ou campanhas.",
                  "Copy to test in bios, posts, ads or campaigns.",
                )}
              </p>
            </div>
            {state.trackingLinks.map((link) => {
              const available = demoTrackingLinkAvailable(link);
              const url = buildDemoTrackingUrl(link, origin);
              const rate = link.clicks > 0 ? (link.conversions / link.clicks) * 100 : 0;
              return (
                <div key={link.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{link.name}</h4>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {channelLabel(link.channel)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${available ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}
                        >
                          {available
                            ? tr("Ativo", "Active")
                            : tr("Pausado/expirado", "Paused/expired")}
                        </span>
                      </div>
                      <div className="mt-2 overflow-hidden rounded-lg bg-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        <span className="block truncate">{url}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                          {link.clicks} {tr("cliques", "clicks")}
                        </span>
                        <span>
                          {link.conversions} {tr("conversões", "conversions")}
                        </span>
                        <span>{rate.toFixed(1).replace(".", ",")}%</span>
                        {link.expiresAt && (
                          <span>
                            {tr("Expira", "Expires")}:{" "}
                            {new Date(`${link.expiresAt}T12:00:00`).toLocaleDateString(
                              locale === "en" ? "en-US" : "pt-BR",
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await navigator.clipboard.writeText(url);
                          toast.success(tr("Link copiado.", "Link copied."));
                        }}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        {tr("Copiar", "Copy")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          save({
                            ...state,
                            trackingLinks: state.trackingLinks.map((item) =>
                              item.id === link.id ? { ...item, active: !item.active } : item,
                            ),
                          })
                        }
                      >
                        {link.active ? tr("Pausar", "Pause") : tr("Ativar", "Activate")}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          save({
                            ...state,
                            trackingLinks: state.trackingLinks.filter(
                              (item) => item.id !== link.id,
                            ),
                          })
                        }
                        aria-label={tr("Remover", "Remove")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>

          <CreatorPixelManager
            pixels={state.pixels}
            onChange={(pixels) => save({ ...state, pixels })}
          />

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => save(createDemoLinksSeed())}>
              {tr("Restaurar exemplo da Fanlira Links", "Restore Fanlira Links example")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
    </Card>
  );
}

function DemoLinksPreview({ state }: { state: DemoLinksState }) {
  const page = state.page;
  const radius = demoLinkButtonRadius(page.buttonStyle);
  const fontFamily = demoLinkFontFamily(page.font);
  return (
    <div
      className="mx-auto min-h-[680px] max-w-[390px] overflow-hidden rounded-[32px] border-[8px] border-foreground/80 shadow-2xl"
      style={{ background: page.backgroundColor, color: page.textColor, fontFamily }}
    >
      {page.bannerUrl && <img src={page.bannerUrl} alt="" className="h-28 w-full object-cover" />}
      <div className="flex flex-col items-center px-5 pb-8 pt-6">
        {page.showAvatar && page.avatarUrl && (
          <img
            src={page.avatarUrl}
            alt=""
            className={`h-20 w-20 rounded-full object-cover ${page.bannerUrl ? "-mt-14" : ""}`}
            style={{ border: `3px solid ${page.accentColor}` }}
          />
        )}
        <h3 className="mt-3 text-center text-2xl font-bold">{page.title || "Sua página"}</h3>
        <p className="mt-2 text-center text-sm opacity-80">{page.description}</p>
        <div className="mt-6 w-full space-y-3">
          {state.links
            .filter((link) => link.active)
            .map((link) => {
              if (link.kind === "text") {
                return (
                  <p key={link.id} className="px-3 py-1 text-center text-sm leading-5 opacity-80">
                    {link.title}
                  </p>
                );
              }
              const Icon = iconForLink(link.icon);
              return (
                <div
                  key={link.id}
                  className="flex min-h-14 items-center gap-3 px-4 py-3"
                  style={{
                    background: page.buttonStyle === "outline" ? "transparent" : page.buttonColor,
                    color: page.buttonTextColor,
                    border: `1.5px solid ${link.featured || page.buttonStyle === "outline" ? page.accentColor : "transparent"}`,
                    borderRadius: radius,
                    boxShadow: link.featured ? `0 8px 24px -12px ${page.accentColor}` : "none",
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-sm font-semibold">{link.title}</span>
                  {link.featured && <Pin className="h-4 w-4" fill="currentColor" />}
                </div>
              );
            })}
        </div>
        <div className="mt-10 text-[10px] opacity-50">feito com Fanlira</div>
      </div>
    </div>
  );
}

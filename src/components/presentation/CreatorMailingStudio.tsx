import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AudioLines,
  Ban,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileImage,
  Film,
  ImagePlus,
  Loader2,
  Megaphone,
  MousePointerClick,
  PauseCircle,
  Plus,
  Send,
  ShieldCheck,
  ShoppingBag,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CreatorMediaLibrary } from "@/components/CreatorMediaLibrary";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import type { CreatorMediaAsset } from "@/lib/media-library";
import { importCreatorMediaFile } from "@/lib/media-library";
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_DAILY_LIMIT,
  CAMPAIGN_MESSAGE_LIMIT,
  CAMPAIGN_OBJECTIVES,
  campaignAudienceLabel,
  campaignObjectiveLabel,
  estimateCampaignAudience,
  simulateCampaignReport,
  validateCampaignDraft,
  type CampaignAudience,
  type CampaignMediaSource,
  type CampaignObjective,
  type CampaignStatus,
} from "@/lib/mass-campaign";
import { createDemoId, type DemoCampaign, type DemoOperationsState } from "@/lib/demo-operations";
import { useI18n } from "@/lib/i18n";

const MANUAL_CONTACTS = [
  { id: "lead-lara", name: "Lara", username: "@lara" },
  { id: "lead-camila", name: "Camila", username: "@camila" },
  { id: "lead-valentina", name: "Valentina", username: "@valentina" },
  { id: "lead-marina", name: "Marina", username: "@marina" },
  { id: "lead-duda", name: "Duda", username: "@duda" },
  { id: "lead-bia", name: "Bia", username: "@bia" },
];

const STATUS_META: Record<CampaignStatus, { label: string; labelEn: string; className: string }> = {
  draft: {
    label: "Rascunho",
    labelEn: "Draft",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  scheduled: {
    label: "Agendada",
    labelEn: "Scheduled",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  },
  sending: {
    label: "Enviando",
    labelEn: "Sending",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  sent: {
    label: "Concluída",
    labelEn: "Completed",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelada",
    labelEn: "Canceled",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

function money(cents: number, locale: "pt-BR" | "en" | "es") {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function percent(value: number, total: number, locale: "pt-BR" | "en" | "es") {
  const result = total > 0 ? (value / total) * 100 : 0;
  return `${result.toLocaleString(locale === "en" ? "en-US" : "pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function MediaPreview({
  url,
  mimeType,
  title,
}: {
  url: string;
  mimeType: string | null;
  title: string;
}) {
  if (mimeType?.startsWith("video/")) {
    return <video src={url} controls className="h-full w-full object-cover" aria-label={title} />;
  }
  if (mimeType?.startsWith("audio/")) {
    return (
      <div className="flex h-full min-h-28 flex-col items-center justify-center gap-3 bg-primary/5 p-4">
        <AudioLines className="h-8 w-8 text-primary" />
        <audio src={url} controls className="w-full" aria-label={title} />
      </div>
    );
  }
  return <img src={url} alt={title} className="h-full w-full object-cover" />;
}

export function CreatorMailingStudio({
  userId,
  operations,
  update,
}: {
  userId: string;
  operations: DemoOperationsState;
  update: (fn: (state: DemoOperationsState) => DemoOperationsState) => void;
}) {
  const { locale, tr } = useI18n();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState<CampaignObjective>("promotion");
  const [audience, setAudience] = useState<CampaignAudience>("active_subscribers");
  const [body, setBody] = useState("");
  const [mediaSource, setMediaSource] = useState<CampaignMediaSource>("none");
  const [mediaTitle, setMediaTitle] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [ppvPrice, setPpvPrice] = useState("19.90");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const campaigns = operations.campaigns;
  const dailyUsed = campaigns
    .filter(
      (campaign) =>
        ["scheduled", "sending", "sent"].includes(campaign.status) && isToday(campaign.created_at),
    )
    .reduce((total, campaign) => total + campaign.recipients, 0);
  const dailyRemaining = Math.max(0, CAMPAIGN_DAILY_LIMIT - dailyUsed);
  const estimatedRecipients = estimateCampaignAudience(audience, manualIds.length);
  const selectedAudience = CAMPAIGN_AUDIENCES.find((item) => item.id === audience);
  const completed = campaigns.filter((campaign) => campaign.status === "sent");
  const totals = completed.reduce(
    (result, campaign) => ({
      recipients: result.recipients + campaign.recipients,
      delivered: result.delivered + campaign.delivered,
      opened: result.opened + campaign.opened,
      sales: result.sales + campaign.sales,
      revenue: result.revenue + campaign.revenue_cents,
    }),
    { recipients: 0, delivered: 0, opened: 0, sales: 0, revenue: 0 },
  );

  const duplicateAudience = useMemo(
    () =>
      campaigns.some(
        (campaign) =>
          campaign.audience === audience &&
          !["draft", "cancelled"].includes(campaign.status) &&
          Date.now() - new Date(campaign.created_at).getTime() < 2 * 60 * 60_000,
      ),
    [audience, campaigns],
  );

  const resetForm = () => {
    setTitle("");
    setObjective("promotion");
    setAudience("active_subscribers");
    setBody("");
    setMediaSource("none");
    setMediaTitle(null);
    setMediaUrl(null);
    setMediaMimeType(null);
    setPpvPrice("19.90");
    setScheduleMode("now");
    setScheduledAt("");
    setManualIds([]);
  };

  const openComposer = () => {
    resetForm();
    setDialogOpen(true);
  };

  const chooseObjective = (next: CampaignObjective) => {
    setObjective(next);
    const objectiveMeta = CAMPAIGN_OBJECTIVES.find((item) => item.id === next);
    setTitle((current) => current || objectiveMeta?.label || "");
    if (next === "library_photo" || next === "ppv") setMediaSource("library");
    if (["new_photo", "video", "audio"].includes(next)) setMediaSource("upload");
    if (next === "renewal") setAudience("expiring_subscribers");
    if (next === "recovery") setAudience("former_subscribers");
  };

  const selectAsset = (asset: CreatorMediaAsset) => {
    setMediaSource("library");
    setMediaTitle(asset.title);
    setMediaUrl(asset.asset_url);
    setMediaMimeType(asset.mime_type);
    toast.success(tr("Mídia selecionada do acervo.", "Media selected from the library."));
  };

  const uploadMedia = async (file?: File) => {
    if (!file) return;
    if (
      !file.type.startsWith("image/") &&
      !file.type.startsWith("video/") &&
      !file.type.startsWith("audio/")
    ) {
      toast.error(tr("Escolha uma foto, vídeo ou áudio.", "Choose a photo, video or audio file."));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error(tr("O arquivo pode ter até 50 MB.", "The file can be up to 50 MB."));
      return;
    }
    setUploading(true);
    try {
      const asset = await importCreatorMediaFile(userId, file, { category: "upload" });
      setMediaSource("upload");
      setMediaTitle(asset.title);
      setMediaUrl(asset.asset_url);
      setMediaMimeType(asset.mime_type);
      toast.success(
        tr("Mídia importada e adicionada ao acervo.", "Media uploaded and added to the library."),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível importar a mídia.", "Couldn't upload the media."),
      );
    } finally {
      setUploading(false);
    }
  };

  const saveCampaign = (mode: "draft" | "send") => {
    const ppvPriceCents = Math.max(0, Math.round(Number(ppvPrice.replace(",", ".")) * 100) || 0);
    const finalScheduledAt =
      mode === "send" && scheduleMode === "later" && scheduledAt
        ? new Date(scheduledAt).toISOString()
        : null;
    const errors = validateCampaignDraft({
      title,
      objective,
      audience,
      body,
      mediaUrl,
      ppvPriceCents,
      recipients: estimatedRecipients,
      scheduledAt: finalScheduledAt,
    });
    if (mode === "draft") {
      const draftErrors = errors.filter(
        (error) => !error.includes("destinatário") && !error.includes("horário futuro"),
      );
      if (draftErrors.length) {
        toast.error(draftErrors[0]);
        return;
      }
    } else if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    if (selectedAudience?.privacyReview) {
      toast.error(
        tr(
          "Este público ainda está em análise de privacidade.",
          "This audience is still under privacy review.",
        ),
      );
      return;
    }
    if (mode === "send" && duplicateAudience) {
      toast.error(
        tr(
          "Este público já recebeu ou receberá uma campanha nas últimas 2 horas.",
          "This audience already received or will receive a campaign within two hours.",
        ),
      );
      return;
    }
    if (mode === "send" && estimatedRecipients > dailyRemaining) {
      toast.error(
        tr(
          `Restam ${dailyRemaining} envios no limite diário.`,
          `${dailyRemaining} sends remain in today's limit.`,
        ),
      );
      return;
    }

    const report =
      mode === "send" && scheduleMode === "now"
        ? simulateCampaignReport(estimatedRecipients, objective)
        : { delivered: 0, opened: 0, sales: 0 };
    const revenueBase =
      objective === "ppv" ? ppvPriceCents : objective === "renewal" ? 4_900 : 1_990;
    const next: DemoCampaign = {
      id: createDemoId("campaign"),
      title: title.trim(),
      objective,
      audience,
      body: body.trim(),
      media_source: mediaSource,
      media_title: mediaTitle,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      ppv_price_cents: objective === "ppv" ? ppvPriceCents : 0,
      recipients: estimatedRecipients,
      delivered: report.delivered,
      opened: report.opened,
      sales: report.sales,
      revenue_cents: report.sales * revenueBase,
      status: mode === "draft" ? "draft" : scheduleMode === "later" ? "scheduled" : "sent",
      scheduled_at: finalScheduledAt,
      created_at: new Date().toISOString(),
    };
    update((state) => ({ ...state, campaigns: [next, ...state.campaigns] }));
    setDialogOpen(false);
    toast.success(
      mode === "draft"
        ? tr("Campanha salva como rascunho.", "Campaign saved as a draft.")
        : scheduleMode === "later"
          ? tr("Campanha agendada.", "Campaign scheduled.")
          : tr("Campanha enviada e relatório gerado.", "Campaign sent and report generated."),
    );
  };

  const cancelCampaign = (id: string) => {
    update((state) => ({
      ...state,
      campaigns: state.campaigns.map((campaign) =>
        campaign.id === id ? { ...campaign, status: "cancelled" } : campaign,
      ),
    }));
    toast.success(
      tr("Campanha cancelada. Nenhum envio pendente será feito.", "Campaign canceled."),
    );
  };

  const duplicateCampaign = (campaign: DemoCampaign) => {
    setTitle(`${campaign.title} - cópia`);
    setObjective(campaign.objective);
    setAudience(campaign.audience);
    setBody(campaign.body);
    setMediaSource(campaign.media_source);
    setMediaTitle(campaign.media_title);
    setMediaUrl(campaign.media_url);
    setMediaMimeType(campaign.media_mime_type);
    setPpvPrice((campaign.ppv_price_cents / 100).toFixed(2));
    setScheduleMode("now");
    setScheduledAt("");
    setManualIds([]);
    setDialogOpen(true);
  };

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          label={tr("Entregas", "Deliveries")}
          value={totals.delivered.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}
          helper={percent(totals.delivered, totals.recipients, locale)}
          icon={CheckCircle2}
        />
        <SummaryCard
          label={tr("Aberturas", "Opens")}
          value={totals.opened.toLocaleString(locale === "en" ? "en-US" : "pt-BR")}
          helper={percent(totals.opened, totals.delivered, locale)}
          icon={Eye}
        />
        <SummaryCard
          label={tr("Vendas geradas", "Generated sales")}
          value={String(totals.sales)}
          helper={percent(totals.sales, totals.opened, locale)}
          icon={ShoppingBag}
        />
        <SummaryCard
          label={tr("Receita atribuída", "Attributed revenue")}
          value={money(totals.revenue, locale)}
          helper={tr("Campanhas concluídas", "Completed campaigns")}
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card className="border-emerald-500/25 bg-emerald-500/5 p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {tr("Proteção anti-spam ativa", "Anti-spam protection active")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {tr(
                  "Limite de 1.000 destinatários por dia, intervalo mínimo de 2 horas por público, remoção de bloqueados e cancelamento dos envios ainda pendentes.",
                  "1,000 recipients per day, a two-hour audience cooldown, blocked-contact removal, and cancellation of pending sends.",
                )}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (dailyUsed / CAMPAIGN_DAILY_LIMIT) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {dailyUsed} {tr("utilizados hoje", "used today")} · {dailyRemaining}{" "}
                {tr("disponíveis", "available")}
              </p>
            </div>
          </div>
        </Card>
        <Button className="h-full min-h-24 px-6" onClick={openComposer}>
          <Plus className="mr-2 h-4 w-4" /> {tr("Nova campanha", "New campaign")}
        </Button>
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">
              {tr("Histórico de campanhas", "Campaign history")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {tr(
                "Entregas, aberturas e vendas ficam reunidas por campanha.",
                "Delivery, opens, and sales are grouped by campaign.",
              )}
            </p>
          </div>
          <Badge variant="outline">{campaigns.length}</Badge>
        </div>
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const status = STATUS_META[campaign.status];
            const expanded = expandedReport === campaign.id;
            return (
              <Card key={campaign.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{campaign.title}</h4>
                        <Badge variant="outline" className={status.className}>
                          {locale === "en" ? status.labelEn : status.label}
                        </Badge>
                        <Badge variant="secondary">
                          {campaignObjectiveLabel(campaign.objective, locale)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Users className="mr-1 inline h-3.5 w-3.5" />
                        {campaignAudienceLabel(campaign.audience, locale)} · {campaign.recipients}{" "}
                        {tr("destinatários", "recipients")}
                      </p>
                      {campaign.body && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {campaign.body}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => duplicateCampaign(campaign)}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> {tr("Duplicar", "Duplicate")}
                      </Button>
                      {(campaign.status === "scheduled" || campaign.status === "sending") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive"
                          onClick={() => cancelCampaign(campaign.id)}
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" /> {tr("Cancelar", "Cancel")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {campaign.status === "sent" && (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <ReportMetric
                        label={tr("Entregues", "Delivered")}
                        value={`${campaign.delivered}/${campaign.recipients}`}
                      />
                      <ReportMetric
                        label={tr("Aberturas", "Opens")}
                        value={`${campaign.opened} · ${percent(campaign.opened, campaign.delivered, locale)}`}
                      />
                      <ReportMetric label={tr("Vendas", "Sales")} value={String(campaign.sales)} />
                      <ReportMetric
                        label={tr("Receita", "Revenue")}
                        value={money(campaign.revenue_cents, locale)}
                      />
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    <span>
                      {campaign.scheduled_at
                        ? `${tr("Agendada para", "Scheduled for")} ${new Date(campaign.scheduled_at).toLocaleString(locale === "en" ? "en-US" : "pt-BR")}`
                        : new Date(campaign.created_at).toLocaleString(
                            locale === "en" ? "en-US" : "pt-BR",
                          )}
                    </span>
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() => setExpandedReport(expanded ? null : campaign.id)}
                    >
                      {expanded
                        ? tr("Ocultar detalhes", "Hide details")
                        : tr("Ver relatório", "View report")}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="grid gap-3 border-t border-border bg-muted/20 p-4 text-xs sm:grid-cols-3">
                    <Detail
                      label={tr("Objetivo", "Objective")}
                      value={campaignObjectiveLabel(campaign.objective, locale)}
                    />
                    <Detail
                      label={tr("Público", "Audience")}
                      value={campaignAudienceLabel(campaign.audience, locale)}
                    />
                    <Detail
                      label={tr("Formato", "Format")}
                      value={campaign.media_title ?? tr("Somente texto", "Text only")}
                    />
                    <Detail
                      label={tr("Taxa de entrega", "Delivery rate")}
                      value={percent(campaign.delivered, campaign.recipients, locale)}
                    />
                    <Detail
                      label={tr("Taxa de abertura", "Open rate")}
                      value={percent(campaign.opened, campaign.delivered, locale)}
                    />
                    <Detail
                      label={tr("Conversão", "Conversion")}
                      value={percent(campaign.sales, campaign.opened, locale)}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("Criar campanha", "Create campaign")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Escolha o objetivo, o público e o conteúdo antes de enviar.",
                "Choose the objective, audience, and content before sending.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <div>
                  <Label>{tr("Objetivo da campanha", "Campaign objective")}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {tr(
                      "Isso organiza o relatório e adapta os próximos campos.",
                      "This organizes reporting and adapts the next fields.",
                    )}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  {tr("Nome interno", "Internal name")}
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={80}
                    placeholder={tr("Ex.: PPV de agosto", "E.g. August PPV")}
                  />
                </label>
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  {tr("Tipo da mensagem", "Message type")}
                  <Select
                    value={objective}
                    onValueChange={(value) => chooseObjective(value as CampaignObjective)}
                  >
                    <SelectTrigger aria-label={tr("Tipo da mensagem", "Message type")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_OBJECTIVES.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {locale === "en" ? item.labelEn : item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <Megaphone className="mr-2 inline h-4 w-4 text-primary" />
                {locale === "en"
                  ? CAMPAIGN_OBJECTIVES.find((item) => item.id === objective)?.descriptionEn
                  : CAMPAIGN_OBJECTIVES.find((item) => item.id === objective)?.description}
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  2
                </span>
                <Label>{tr("Público da campanha", "Campaign audience")}</Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CAMPAIGN_AUDIENCES.map((item) => {
                  const selected = audience === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={item.privacyReview}
                      onClick={() => setAudience(item.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        item.privacyReview
                          ? "cursor-not-allowed border-dashed border-border opacity-60"
                          : selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {locale === "en" ? item.labelEn : item.label}
                        </span>
                        {item.privacyReview ? (
                          <Badge variant="outline" className="text-[9px]">
                            {tr("Em análise", "Under review")}
                          </Badge>
                        ) : (
                          <span className="text-xs font-bold text-primary">
                            {item.id === "manual" ? manualIds.length : item.estimate}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {locale === "en" ? item.descriptionEn : item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
              {audience === "manual" && (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    {tr("Escolha os leads", "Choose leads")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {MANUAL_CONTACTS.map((contact) => (
                      <label
                        key={contact.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg bg-background p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={manualIds.includes(contact.id)}
                          onChange={(event) =>
                            setManualIds((current) =>
                              event.target.checked
                                ? [...current, contact.id]
                                : current.filter((id) => id !== contact.id),
                            )
                          }
                        />
                        <span>
                          <strong className="block text-foreground">{contact.name}</strong>
                          <span className="text-[11px] text-muted-foreground">
                            {contact.username}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {duplicateAudience && (
                <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {tr(
                    "Este público já tem uma campanha nas últimas 2 horas. O anti-spam bloqueará um novo envio imediato.",
                    "This audience already has a campaign within two hours. Anti-spam will block another immediate send.",
                  )}
                </p>
              )}
            </section>

            <section className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  3
                </span>
                <Label>{tr("Mensagem e mídia", "Message and media")}</Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <MediaSourceButton
                  active={mediaSource === "none"}
                  label={tr("Somente texto", "Text only")}
                  description={tr("Mensagem simples no chat", "Simple chat message")}
                  icon={Megaphone}
                  onClick={() => {
                    setMediaSource("none");
                    setMediaTitle(null);
                    setMediaUrl(null);
                    setMediaMimeType(null);
                  }}
                />
                <MediaSourceButton
                  active={mediaSource === "library"}
                  label={tr("Escolher do acervo", "Choose from library")}
                  description={tr("Foto, vídeo ou PPV salvo", "Saved photo, video, or PPV")}
                  icon={FileImage}
                  onClick={() => setMediaSource("library")}
                />
                <MediaSourceButton
                  active={mediaSource === "upload"}
                  label={tr("Enviar mídia nova", "Upload new media")}
                  description={tr("Foto, vídeo ou áudio", "Photo, video, or audio")}
                  icon={Upload}
                  onClick={() => setMediaSource("upload")}
                />
              </div>

              {mediaSource === "library" && !mediaUrl && (
                <CreatorMediaLibrary userId={userId} mode="pick" onSelectAsset={selectAsset} />
              )}
              {mediaSource === "upload" && !mediaUrl && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => uploadRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center hover:bg-primary/10"
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-primary" />
                  )}
                  <strong className="mt-3 text-sm text-foreground">
                    {tr("Escolher foto, vídeo ou áudio", "Choose photo, video, or audio")}
                  </strong>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {tr(
                      "Até 50 MB · a mídia também será salva no acervo",
                      "Up to 50 MB · also saved to the library",
                    )}
                  </span>
                </button>
              )}
              <input
                ref={uploadRef}
                type="file"
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={(event) => {
                  void uploadMedia(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />

              {mediaUrl && (
                <div className="grid overflow-hidden rounded-2xl border border-border sm:grid-cols-[180px_1fr]">
                  <div className="aspect-video overflow-hidden bg-muted sm:aspect-square">
                    <MediaPreview
                      url={mediaUrl}
                      mimeType={mediaMimeType}
                      title={mediaTitle ?? "Mídia"}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <Badge variant="outline">
                        {mediaMimeType?.startsWith("video/")
                          ? tr("Vídeo", "Video")
                          : mediaMimeType?.startsWith("audio/")
                            ? tr("Áudio", "Audio")
                            : tr("Foto", "Photo")}
                      </Badge>
                      <strong className="mt-2 block text-sm text-foreground">{mediaTitle}</strong>
                      <span className="text-xs text-muted-foreground">
                        {mediaSource === "library"
                          ? tr("Selecionada do acervo", "Selected from library")
                          : tr("Novo upload", "New upload")}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={tr("Remover mídia", "Remove media")}
                      onClick={() => {
                        setMediaTitle(null);
                        setMediaUrl(null);
                        setMediaMimeType(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <label className="block space-y-1.5 text-xs text-muted-foreground">
                {tr("Texto da mensagem", "Message text")}{" "}
                <span className="font-normal">
                  ({tr("opcional quando houver mídia", "optional when media is attached")})
                </span>
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={CAMPAIGN_MESSAGE_LIMIT}
                  rows={5}
                  placeholder={tr(
                    "Escreva a mensagem que aparecerá no chat…",
                    "Write the message shown in chat…",
                  )}
                />
                <span className="block text-right text-[10px]">
                  {body.length}/{CAMPAIGN_MESSAGE_LIMIT}
                </span>
              </label>

              {objective === "ppv" && (
                <label className="block max-w-xs space-y-1.5 text-xs text-muted-foreground">
                  {tr("Valor para desbloquear o PPV", "PPV unlock price")}
                  <div className="flex items-center gap-2">
                    <span>R$</span>
                    <Input
                      type="number"
                      min="1"
                      step="0.50"
                      value={ppvPrice}
                      onChange={(event) => setPpvPrice(event.target.value)}
                    />
                  </div>
                </label>
              )}
            </section>

            <section className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  4
                </span>
                <Label>{tr("Envio", "Delivery")}</Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setScheduleMode("now")}
                  className={`rounded-xl border p-3 text-left ${scheduleMode === "now" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <Send className="h-5 w-5 text-primary" />
                  <strong className="mt-2 block text-sm text-foreground">
                    {tr("Enviar agora", "Send now")}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {tr("Entrará na fila imediatamente.", "It will enter the queue immediately.")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode("later")}
                  className={`rounded-xl border p-3 text-left ${scheduleMode === "later" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <CalendarClock className="h-5 w-5 text-primary" />
                  <strong className="mt-2 block text-sm text-foreground">
                    {tr("Agendar", "Schedule")}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {tr("Escolha o dia e horário.", "Choose a date and time.")}
                  </span>
                </button>
              </div>
              {scheduleMode === "later" && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              )}
              <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs sm:grid-cols-3">
                <Detail
                  label={tr("Público estimado", "Estimated audience")}
                  value={`${estimatedRecipients} ${tr("pessoas", "people")}`}
                />
                <Detail
                  label={tr("Limite restante hoje", "Remaining today")}
                  value={`${dailyRemaining} ${tr("envios", "sends")}`}
                />
                <Detail
                  label={tr("Proteção", "Protection")}
                  value={tr(
                    "Bloqueados e repetidos removidos",
                    "Blocked and repeated contacts removed",
                  )}
                />
              </div>
            </section>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {tr("Fechar", "Close")}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => saveCampaign("draft")}>
                {tr("Salvar rascunho", "Save draft")}
              </Button>
              <Button onClick={() => saveCampaign("send")}>
                {scheduleMode === "later" ? (
                  <CalendarClock className="mr-2 h-4 w-4" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {scheduleMode === "later"
                  ? tr("Agendar campanha", "Schedule campaign")
                  : tr("Enviar campanha", "Send campaign")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof BarChart3;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs text-muted-foreground">{label}</span>
          <strong className="mt-1 block text-xl text-foreground">{value}</strong>
          <span className="mt-1 block text-[11px] text-muted-foreground">{helper}</span>
        </div>
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Card>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-sm text-foreground">{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <strong className="mt-1 block text-xs text-foreground">{value}</strong>
    </div>
  );
}

function MediaSourceButton({
  active,
  label,
  description,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  icon: typeof FileImage;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <strong className="mt-2 block text-sm text-foreground">{label}</strong>
      <span className="text-[11px] text-muted-foreground">{description}</span>
    </button>
  );
}

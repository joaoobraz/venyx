import {
  CheckCircle2,
  CircleAlert,
  Cookie,
  ExternalLink,
  Eye,
  MousePointerClick,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PIXEL_PROVIDER_DEFINITIONS,
  enabledValidPixels,
  normalizePixelId,
  validatePixelId,
  type CreatorPixelConfig,
  type PixelProvider,
} from "@/lib/creator-pixels";
import { useI18n } from "@/lib/i18n";

export function CreatorPixelManager({
  pixels,
  onChange,
}: {
  pixels: CreatorPixelConfig[];
  onChange: (pixels: CreatorPixelConfig[]) => void;
}) {
  const { tr, locale } = useI18n();
  const active = enabledValidPixels(pixels);

  const update = (provider: PixelProvider, patch: Partial<CreatorPixelConfig>) => {
    onChange(pixels.map((pixel) => (pixel.provider === provider ? { ...pixel, ...patch } : pixel)));
  };

  return (
    <div className="space-y-4">
      <Card className="border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <h3 className="font-semibold text-foreground">
                {tr("Pixels e tags de campanha", "Campaign pixels and tags")}
              </h3>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                {tr(
                  "Configure várias plataformas ao mesmo tempo. Os scripts carregam somente na página pública, depois que o visitante aceitar cookies de marketing. A Fanlira não envia e-mail, telefone, mensagens, pagamentos ou conteúdo privado aos pixels.",
                  "Configure several platforms at once. Scripts load only on the public page after the visitor accepts marketing cookies. Fanlira does not send email, phone, messages, payments or private content to pixels.",
                )}
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
            {active.length} {tr("ativos", "active")}
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <Info icon={Cookie} text={tr("Consentimento obrigatório", "Consent required")} />
          <Info icon={Eye} text={tr("Visualização de página", "Page view")} />
          <Info icon={MousePointerClick} text={tr("Clique nos links", "Link click")} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {pixels.map((pixel) => {
          const definition = PIXEL_PROVIDER_DEFINITIONS[pixel.provider];
          const validation = validatePixelId(pixel.provider, pixel.pixelId);
          const ready = validation.valid && pixel.enabled;
          return (
            <Card key={pixel.provider} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-primary/10 px-2 text-xs font-bold text-primary">
                    {definition.shortLabel}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{definition.label}</h4>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {definition.description}
                    </p>
                  </div>
                </div>
                <Switch
                  aria-label={`${tr("Ativar", "Enable")} ${definition.label}`}
                  checked={pixel.enabled}
                  onCheckedChange={(enabled) => {
                    if (enabled && !validation.valid) {
                      toast.error(validation.message);
                      return;
                    }
                    update(pixel.provider, { enabled });
                    toast.success(
                      enabled
                        ? tr(`${definition.label} ativado.`, `${definition.label} enabled.`)
                        : tr(`${definition.label} pausado.`, `${definition.label} paused.`),
                    );
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`pixel-${pixel.provider}`}>{definition.idLabel}</Label>
                <div className="flex gap-2">
                  <Input
                    id={`pixel-${pixel.provider}`}
                    value={pixel.pixelId}
                    onChange={(event) =>
                      update(pixel.provider, {
                        pixelId: normalizePixelId(pixel.provider, event.target.value).slice(0, 80),
                        enabled: false,
                        lastValidatedAt: "",
                      })
                    }
                    placeholder={definition.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!validation.valid) {
                        toast.error(validation.message);
                        return;
                      }
                      update(pixel.provider, { lastValidatedAt: new Date().toISOString() });
                      toast.success(
                        tr(
                          `Formato do ${definition.label} validado.`,
                          `${definition.label} format validated.`,
                        ),
                      );
                    }}
                  >
                    {tr("Validar formato", "Validate format")}
                  </Button>
                </div>
                <div className="flex min-h-5 items-center gap-1.5 text-[11px]">
                  {pixel.pixelId ? (
                    validation.valid ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500">
                          {ready
                            ? tr("Configurado e ativo", "Configured and active")
                            : tr(
                                "Formato válido; ative quando estiver pronto",
                                "Valid format; enable when ready",
                              )}
                        </span>
                      </>
                    ) : (
                      <>
                        <CircleAlert className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-amber-500">{validation.message}</span>
                      </>
                    )
                  ) : (
                    <span className="text-muted-foreground">
                      {tr("Ainda não configurado", "Not configured yet")}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <EventToggle
                  icon={Eye}
                  label={tr("Visitas à página", "Page visits")}
                  checked={pixel.trackPageViews}
                  onCheckedChange={(trackPageViews) => update(pixel.provider, { trackPageViews })}
                />
                <EventToggle
                  icon={MousePointerClick}
                  label={tr("Cliques nos links", "Link clicks")}
                  checked={pixel.trackLinkClicks}
                  onCheckedChange={(trackLinkClicks) => update(pixel.provider, { trackLinkClicks })}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground">
                  {pixel.lastValidatedAt
                    ? `${tr("Validado em", "Validated on")} ${new Date(pixel.lastValidatedAt).toLocaleString(locale === "en" ? "en-US" : "pt-BR")}`
                    : tr(
                        "A validação confirma o formato, não a propriedade da conta.",
                        "Validation confirms format, not account ownership.",
                      )}
                </span>
                <Button size="sm" variant="ghost" asChild>
                  <a href={definition.helpUrl} target="_blank" rel="noreferrer">
                    {tr("Onde encontrar o ID", "Where to find the ID")}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="border-blue-500/25 bg-blue-500/5 p-5">
        <div className="flex items-start gap-3">
          <Radio className="mt-0.5 h-5 w-5 text-blue-500" />
          <div>
            <h4 className="font-semibold text-foreground">
              {tr("Como conferir os disparos reais", "How to verify real events")}
            </h4>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
              <li>
                {tr(
                  "Informe e valide o ID oficial da conta.",
                  "Enter and validate the official account ID.",
                )}
              </li>
              <li>
                {tr(
                  "Ative a integração e publique a página.",
                  "Enable the integration and publish the page.",
                )}
              </li>
              <li>
                {tr(
                  "Abra /links/aline e aceite cookies de marketing.",
                  "Open /links/aline and accept marketing cookies.",
                )}
              </li>
              <li>
                {tr(
                  "Use o modo Test Events ou a extensão oficial da plataforma para confirmar PageView e cliques.",
                  "Use the platform's Test Events mode or official extension to confirm PageView and click events.",
                )}
              </li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Info({ icon: Icon, text }: { icon: typeof Cookie; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2">
      <Icon className="h-4 w-4 text-emerald-500" />
      {text}
    </div>
  );
}

function EventToggle({
  icon: Icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: typeof Eye;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

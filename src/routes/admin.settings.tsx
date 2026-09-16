import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Settings, ShieldCheck, FlaskConical, Banknote } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import {
  requireAdminServer,
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettingsRow,
} from "@/_server/admin.functions";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: async () => {
    // O guard só faz sentido no navegador; no SSR não há sessão no pedido.
    if (typeof window === "undefined") return;
    try {
      await requireAdminServer({ data: { path: "/admin/settings" } });
    } catch {
      throw redirect({ to: "/403" });
    }
  },
  head: () => ({ meta: [{ title: "Configurações da plataforma" }] }),
  component: AdminSettingsPage,
});

// Valores de produção (os mesmos defaults do banco).
const PRODUCTION_HOLD_DAYS = 1;
const PRODUCTION_MIN_WITHDRAWAL_CENTS = 3000;
// Modo teste de saque: saldo libera na hora e sem valor mínimo.
const TEST_HOLD_DAYS = 0;
const TEST_MIN_WITHDRAWAL_CENTS = 1;

const centsToReais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const reaisToCents = (value: string) => Math.round(Number.parseFloat(value.replace(",", ".")) * 100);

export function AdminSettingsPage() {
  const { tr } = useI18n();
  const getFn = useServerFn(getPlatformSettings);
  const updateFn = useServerFn(updatePlatformSettings);

  const [settings, setSettings] = useState<PlatformSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Campos numéricos editados como texto; convertidos só ao salvar.
  const [feeStr, setFeeStr] = useState("");
  const [holdStr, setHoldStr] = useState("");
  const [minStr, setMinStr] = useState("");

  const applyRow = (row: PlatformSettingsRow) => {
    setSettings(row);
    setFeeStr(String(row.platform_fee_pct));
    setHoldStr(String(row.hold_days));
    setMinStr(centsToReais(row.min_withdrawal_cents));
  };

  useEffect(() => {
    getFn()
      .then((r) => {
        if (r.ok) applyRow(r.settings);
        else toast.error(r.error);
      })
      .catch(() => toast.error(tr("Não foi possível carregar as configurações.", "Couldn't load settings.")))
      .finally(() => setLoading(false));
  }, [getFn, tr]);

  type SettingsChanges = Partial<Omit<PlatformSettingsRow, "updated_at">>;
  const save = async (changes: SettingsChanges, successMessage: string) => {
    setSaving(true);
    try {
      const r = await updateFn({ data: changes });
      if (!r.ok) {
        toast.error(r.error);
        return false;
      }
      applyRow(r.settings);
      toast.success(successMessage);
      return true;
    } catch {
      toast.error(tr("Não foi possível salvar.", "Couldn't save."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const withdrawalTestMode =
    !!settings &&
    settings.hold_days === TEST_HOLD_DAYS &&
    settings.min_withdrawal_cents === TEST_MIN_WITHDRAWAL_CENTS;

  const toggleModeration = (next: boolean) =>
    save(
      { manual_moderation_enabled: next },
      next
        ? tr("Moderação manual ATIVADA. Novos posts entram para aprovação.", "Manual moderation ON.")
        : tr("Moderação manual DESATIVADA. Posts publicam na hora.", "Manual moderation OFF."),
    );

  const toggleWithdrawalTestMode = (next: boolean) =>
    save(
      next
        ? { hold_days: TEST_HOLD_DAYS, min_withdrawal_cents: TEST_MIN_WITHDRAWAL_CENTS }
        : { hold_days: PRODUCTION_HOLD_DAYS, min_withdrawal_cents: PRODUCTION_MIN_WITHDRAWAL_CENTS },
      next
        ? tr("Modo teste de saque LIGADO: saldo libera na hora, sem mínimo.", "Withdrawal test mode ON.")
        : tr("Modo produção: retenção D+1 e saque mínimo de R$ 30,00.", "Production mode restored."),
    );

  const saveNumbers = () => {
    const fee = Number.parseInt(feeStr, 10);
    const hold = Number.parseInt(holdStr, 10);
    const min = reaisToCents(minStr);
    if (Number.isNaN(fee) || fee < 0 || fee > 50) {
      toast.error(tr("Taxa da plataforma deve ficar entre 0% e 50%.", "Platform fee must be 0–50%."));
      return;
    }
    if (Number.isNaN(hold) || hold < 0 || hold > 30) {
      toast.error(tr("Retenção deve ficar entre 0 e 30 dias.", "Hold must be 0–30 days."));
      return;
    }
    if (Number.isNaN(min) || min < 1) {
      toast.error(tr("Saque mínimo deve ser de pelo menos R$ 0,01.", "Minimum withdrawal must be at least R$ 0.01."));
      return;
    }
    void save(
      { platform_fee_pct: fee, hold_days: hold, min_withdrawal_cents: min },
      tr("Configurações salvas.", "Settings saved."),
    );
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl space-y-6 py-8">
        <header className="space-y-2">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {tr("Painel Admin", "Admin Dashboard")}
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Settings className="h-6 w-6 text-primary" />
            {tr("Configurações da plataforma", "Platform settings")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr(
              "Chaves operacionais que valem para o site inteiro. Toda alteração fica registrada na auditoria de ações.",
              "Site-wide operational switches. Every change is recorded in the action audit.",
            )}
          </p>
        </header>

        {loading || !settings ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Carregando...", "Loading...")}
          </div>
        ) : (
          <>
            {/* Moderação manual */}
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {tr("Moderação manual de posts e stories", "Manual moderation for posts and stories")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {settings.manual_moderation_enabled
                    ? tr(
                        "Ativada: cada post/story só aparece depois que um admin aprovar na fila de Moderação.",
                        "On: each post/story appears only after an admin approves it in the Moderation queue.",
                      )
                    : tr(
                        "Desativada: posts e stories publicam na hora, sem revisão humana. Ative antes de abrir ao público.",
                        "Off: posts and stories publish instantly. Turn on before going public.",
                      )}
                </p>
              </div>
              <Switch
                checked={settings.manual_moderation_enabled}
                disabled={saving}
                onCheckedChange={toggleModeration}
                aria-label={tr("Moderação manual", "Manual moderation")}
              />
            </Card>

            {/* 2FA por e-mail (gera custo de envio de e-mail) */}
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {tr("2FA por e-mail (opção de receber o código por e-mail)", "Email 2FA (receive the code by email)")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {settings.email_mfa_enabled
                    ? tr(
                        "Ligado: em Segurança a pessoa pode escolher entre app autenticador e código por e-mail. Cada login envia um e-mail (custo de envio).",
                        "On: users can choose between authenticator app and email code. Each login sends an email.",
                      )
                    : tr(
                        "Desligado: só o app autenticador está disponível. Ligue quando o SMTP estiver configurado e você aceitar o custo de envio.",
                        "Off: only the authenticator app is available. Turn on once SMTP is configured.",
                      )}
                </p>
              </div>
              <Switch
                checked={settings.email_mfa_enabled}
                disabled={saving}
                onCheckedChange={(next) =>
                  save(
                    { email_mfa_enabled: next },
                    next
                      ? tr("2FA por e-mail LIGADO. A opção já aparece em Segurança.", "Email 2FA ON.")
                      : tr("2FA por e-mail desligado.", "Email 2FA off."),
                  )
                }
                aria-label={tr("2FA por e-mail", "Email 2FA")}
              />
            </Card>

            {/* Modo teste de saque */}
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  {tr("Modo teste de saque", "Withdrawal test mode")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {withdrawalTestMode
                    ? tr(
                        "LIGADO: saldo libera na hora (D+0) e sem valor mínimo. Só para testes — desligue antes de abrir ao público.",
                        "ON: balance is available instantly (D+0) with no minimum. Tests only — turn off before going public.",
                      )
                    : tr(
                        "Desligado: valem a retenção e o saque mínimo configurados abaixo.",
                        "Off: the hold and minimum withdrawal below apply.",
                      )}
                </p>
              </div>
              <Switch
                checked={withdrawalTestMode}
                disabled={saving}
                onCheckedChange={toggleWithdrawalTestMode}
                aria-label={tr("Modo teste de saque", "Withdrawal test mode")}
              />
            </Card>

            {/* Valores financeiros */}
            <Card className="space-y-4 p-5">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <Banknote className="h-4 w-4 text-primary" />
                {tr("Regras financeiras", "Financial rules")}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="fee">{tr("Taxa da plataforma (%)", "Platform fee (%)")}</Label>
                  <Input
                    id="fee"
                    inputMode="numeric"
                    value={feeStr}
                    onChange={(e) => setFeeStr(e.target.value.replace(/\D/g, ""))}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tr("Descontada de cada venda. Entre 0 e 50.", "Taken from each sale. 0–50.")}
                  </p>
                </div>
                <div>
                  <Label htmlFor="hold">{tr("Retenção do saldo (dias)", "Balance hold (days)")}</Label>
                  <Input
                    id="hold"
                    inputMode="numeric"
                    value={holdStr}
                    onChange={(e) => setHoldStr(e.target.value.replace(/\D/g, ""))}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tr("D+N até a venda poder ser sacada. Entre 0 e 30.", "D+N until a sale can be withdrawn. 0–30.")}
                  </p>
                </div>
                <div>
                  <Label htmlFor="min">{tr("Saque mínimo (R$)", "Minimum withdrawal (R$)")}</Label>
                  <Input
                    id="min"
                    inputMode="decimal"
                    value={minStr}
                    onChange={(e) => setMinStr(e.target.value.replace(/[^\d,.]/g, ""))}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tr("Valor mínimo por pedido de saque.", "Minimum amount per withdrawal request.")}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveNumbers} disabled={saving}>
                  {saving ? tr("Salvando...", "Saving...") : tr("Salvar regras", "Save rules")}
                </Button>
              </div>
            </Card>

            {settings.updated_at && (
              <p className="text-xs text-muted-foreground">
                {tr("Última alteração:", "Last change:")}{" "}
                {new Date(settings.updated_at).toLocaleString("pt-BR")}
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

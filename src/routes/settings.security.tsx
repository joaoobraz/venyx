import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, ShieldCheck, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { verifyTotpCode } from "@/lib/mfa-stepup";
import { describeMfaError } from "@/lib/auth-errors";
import { useServerFn } from "@tanstack/react-start";
import { confirmEmailMfaSession, disableEmailMfa, getMyMfaState } from "@/_server/mfa-email.functions";

export const Route = createFileRoute("/settings/security")({
  component: SecurityPage,
});

interface FactorEnroll {
  id: string;
  totp: { qr_code: string; secret: string };
}

export function SecurityPage() {
  const { user, mfaEnabled, refresh, loading } = useAuth();
  const { tr } = useI18n();
  const nav = useNavigate();
  const [enrolling, setEnrolling] = useState<FactorEnroll | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [requireForWithdraw, setRequireForWithdraw] = useState(true);
  // Desativar exige reconfirmar o código atual (sessão roubada não basta).
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  // 2FA por e-mail (aparece só se o dono ligou o flag no painel).
  type MfaState = Awaited<ReturnType<typeof getMyMfaState>>;
  const getMfaStateFn = useServerFn(getMyMfaState);
  const confirmEmailFn = useServerFn(confirmEmailMfaSession);
  const disableEmailFn = useServerFn(disableEmailMfa);
  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [emailEnroll, setEmailEnroll] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const loadMfaState = () =>
    getMfaStateFn()
      .then(setMfaState)
      .catch(() => setMfaState(null));
  useEffect(() => {
    if (user) void loadMfaState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const emailMethodActive = Boolean(mfaState && mfaState.mfaEnabled && mfaState.method === "email" && !mfaState.hasTotp);
  const effectiveMfaEnabled = mfaEnabled || emailMethodActive;

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("security_settings")
      .select("mfa_required_for_withdraw")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRequireForWithdraw(!!(data as { mfa_required_for_withdraw: boolean }).mfa_required_for_withdraw);
      });
  }, [user]);

  if (!user) return null;

  const startEnroll = async () => {
    setBusy(true);
    try {
      // issuer define o nome exibido no app autenticador. Sem ele, o app
      // mostrava o endereço técnico do Supabase e um ícone aleatório.
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Fanlira",
      });
      if (error) throw error;
      setEnrolling(data as FactorEnroll);
    } catch (e) {
      toast.error(describeMfaError(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!enrolling) return;
    setBusy(true);
    try {
      const { data: chal, error: ce } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
      if (ce) throw ce;
      const { error: ve } = await supabase.auth.mfa.verify({
        factorId: enrolling.id,
        challengeId: chal.id,
        code,
      });
      if (ve) throw ve;
      await supabase
        .from("security_settings")
        .upsert({ user_id: user.id, mfa_enabled: true, mfa_required_for_withdraw: requireForWithdraw });
      // Ensure the access token sent to protected server functions contains
      // the aal2 claim immediately after enrollment, without requiring a
      // browser restart or a second login.
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) console.warn("[security.mfa] session refresh failed", refreshError);
      toast.success(tr("2FA ativado!", "2FA enabled!"));
      setEnrolling(null);
      setCode("");
      refresh();
    } catch (e) {
      toast.error(describeMfaError(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const check = await verifyTotpCode(disableCode);
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      await supabase.from("security_settings").upsert({ user_id: user.id, mfa_enabled: false });
      setConfirmingDisable(false);
      setDisableCode("");
      toast.success(tr("2FA desativado", "2FA disabled"));
      refresh();
    } catch (e) {
      toast.error(describeMfaError(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const startEmailEnroll = async () => {
    if (!mfaState?.email) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: mfaState.email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setEmailEnroll(true);
      setEmailCode("");
      toast.success(tr(`Código enviado para ${mfaState.email}.`, `Code sent to ${mfaState.email}.`));
    } catch (e) {
      toast.error(describeMfaError(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const verifyEmailEnroll = async () => {
    if (!mfaState?.email) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: mfaState.email, token: emailCode.replace(/\D/g, ""), type: "email" });
      if (error) throw error;
      const r = await confirmEmailFn({ data: { enable: true } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      await supabase.auth.refreshSession();
      toast.success(tr("2FA por e-mail ativado! A cada login você receberá um código.", "Email 2FA enabled!"));
      setEmailEnroll(false);
      setEmailCode("");
      await loadMfaState();
      refresh();
    } catch (e) {
      toast.error(describeMfaError(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const disableEmail = async () => {
    if (!confirm(tr("Desativar o 2FA por e-mail? Sua conta ficará menos protegida.", "Disable email 2FA?"))) return;
    setBusy(true);
    try {
      const r = await disableEmailFn();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(tr("2FA por e-mail desativado.", "Email 2FA disabled."));
      await loadMfaState();
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const updateRequire = async (v: boolean) => {
    setRequireForWithdraw(v);
    await supabase
      .from("security_settings")
      .upsert({ user_id: user.id, mfa_required_for_withdraw: v });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold text-foreground">{tr("Segurança", "Security")}</h1>
        </div>

        <div className="space-y-4 rounded-2xl bg-card p-5">
          <div className="flex items-start gap-3">
            <div className={`rounded-full p-2 ${effectiveMfaEnabled ? "bg-green-500/20" : "bg-muted"}`}>
              <ShieldCheck className={`h-5 w-5 ${effectiveMfaEnabled ? "text-green-400" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">
                {tr("Autenticação em 2 fatores (2FA)", "Two-factor authentication (2FA)")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {emailMethodActive
                  ? tr(
                      "Sua conta está protegida. A cada login você recebe um código por e-mail.",
                      "Your account is protected. You receive a code by email at each sign-in.",
                    )
                  : mfaEnabled
                    ? tr(
                        "Sua conta está protegida. Você precisa do código do app a cada login.",
                        "Your account is protected. You'll need the app code at each sign-in.",
                      )
                    : mfaState?.platformEmailMfaEnabled
                      ? tr(
                          "Escolha como receber o código: aplicativo autenticador (recomendado) ou e-mail.",
                          "Choose how to receive the code: authenticator app (recommended) or email.",
                        )
                      : tr(
                          "Use Google Authenticator, Authy ou similar para gerar códigos temporários.",
                          "Use Google Authenticator, Authy or a similar app to generate temporary codes.",
                        )}
              </p>
            </div>
            {emailMethodActive ? (
              <Button size="sm" variant="outline" onClick={disableEmail} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Desativar", "Disable")}
              </Button>
            ) : mfaEnabled ? (
              confirmingDisable ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                    className="w-28"
                    aria-label={tr("Código do autenticador", "Authenticator code")}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={disable}
                    disabled={busy || disableCode.length !== 6}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Confirmar", "Confirm")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConfirmingDisable(false);
                      setDisableCode("");
                    }}
                    disabled={busy}
                  >
                    {tr("Cancelar", "Cancel")}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmingDisable(true)} disabled={busy}>
                  {tr("Desativar", "Disable")}
                </Button>
              )
            ) : (
              !enrolling &&
              !emailEnroll && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={startEnroll}
                    disabled={busy}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mfaState?.platformEmailMfaEnabled ? tr("Usar app autenticador", "Use authenticator app") : tr("Ativar 2FA", "Enable 2FA")}
                  </Button>
                  {mfaState?.platformEmailMfaEnabled && (
                    <Button size="sm" variant="outline" onClick={startEmailEnroll} disabled={busy}>
                      {tr("Receber código por e-mail", "Get code by email")}
                    </Button>
                  )}
                </div>
              )
            )}
          </div>

          {emailEnroll && (
            <div className="space-y-3 rounded-xl bg-background p-4">
              <p className="text-xs text-muted-foreground">
                {tr(`Digite o código de 6 dígitos que enviamos para ${mfaState?.email ?? "seu e-mail"}.`, `Enter the 6-digit code we sent to ${mfaState?.email ?? "your email"}.`)}
              </p>
              <Input
                placeholder={tr("Digite o código de 6 dígitos", "Enter the 6-digit code")}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEmailEnroll(false)} className="flex-1" disabled={busy}>
                  {tr("Cancelar", "Cancel")}
                </Button>
                <Button onClick={verifyEmailEnroll} disabled={busy || emailCode.length !== 6} className="flex-1 bg-primary text-primary-foreground">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Confirmar", "Confirm")}
                </Button>
              </div>
            </div>
          )}

          {enrolling && (
            <div className="space-y-3 rounded-xl bg-background p-4">
              <p className="text-xs text-muted-foreground">
                <Smartphone className="mr-1 inline h-3.5 w-3.5" /> {tr("Escaneie o QR no seu app autenticador:", "Scan the QR code in your authenticator app:")}
              </p>
              <div className="flex justify-center rounded-lg bg-white p-3">
                <img src={enrolling.totp.qr_code} alt="QR Code" className="h-44 w-44" />
              </div>
              <div className="text-center text-[10px] text-muted-foreground">
                {tr("Ou digite manualmente:", "Or enter it manually:")} <code className="text-foreground">{enrolling.totp.secret}</code>
              </div>
              <Input
                placeholder={tr("Digite o código de 6 dígitos", "Enter the 6-digit code")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEnrolling(null)} className="flex-1">
                  {tr("Cancelar", "Cancel")}
                </Button>
                <Button
                  onClick={verify}
                  disabled={busy || code.length !== 6}
                  className="flex-1 bg-primary text-primary-foreground"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Confirmar", "Confirm")}
                </Button>
              </div>
            </div>
          )}

          {effectiveMfaEnabled && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {tr("Exigir 2FA para saques", "Require 2FA for withdrawals")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {tr("Pedir código ao solicitar saque na carteira", "Ask for a code when requesting a wallet withdrawal")}
                </div>
              </div>
              <Switch checked={requireForWithdraw} onCheckedChange={updateRequire} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

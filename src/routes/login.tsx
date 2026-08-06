import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { createOAuthCallbackUrl } from "@/lib/auth-redirect";
import { ensureGoogleAuthIsEnabled } from "@/lib/google-auth";
import { getPasswordLoginError } from "@/lib/auth-errors";
import { trackProductEvent } from "@/lib/telemetry";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

export function LoginPage() {
  const { t, tr, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/feed" });
  }, [user, navigate]);

  const prepareMfaChallenge = async (): Promise<boolean> => {
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;

    if (aal.currentLevel !== "aal1" || aal.nextLevel !== "aal2") return false;

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const verifiedFactor = factors.totp.find((factor) => factor.status === "verified");
    if (!verifiedFactor) return false;

    setMfaFactorId(verifiedFactor.id);
    return true;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setRecoverySent(false);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (await prepareMfaChallenge()) return;
      navigate({ to: "/feed" });
    } catch (error) {
      trackProductEvent("login_failed", {
        method: "password",
        reason: error instanceof Error ? error.name : "unknown",
      });
      const message = getPasswordLoginError(error, locale);
      setLoginError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordRecovery = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setRecoveryLoading(true);
    setRecoverySent(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setRecoverySent(true);
      toast.success(
        tr(
          "Enviamos o link para ativar ou redefinir a senha da Fanlira.",
          "We sent the link to activate or reset your Fanlira password.",
        ),
      );
    } catch {
      toast.error(
        tr(
          "Não foi possível enviar o link agora. Tente novamente em alguns minutos.",
          "We could not send the link right now. Try again in a few minutes.",
        ),
      );
    } finally {
      setRecoveryLoading(false);
    }
  };

  const verifyMfa = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      navigate({ to: "/feed" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código inválido.");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      await ensureGoogleAuthIsEnabled();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: createOAuthCallbackUrl(window.location.origin),
          queryParams: { prompt: "select_account" },
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error("O Google não retornou uma página de login.");
      window.location.assign(data.url);
    } catch (error) {
      setGoogleLoading(false);
      toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir o login do Google.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground">{t("auth.login.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.login.subtitle")}</p>

        {mfaFactorId ? (
          <form onSubmit={verifyMfa} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="mfa-code">Código da autenticação em dois fatores</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1.5 text-center text-lg tracking-widest"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? t("common.loading") : "Confirmar código"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLoginError(null);
                  setRecoverySent(false);
                }}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError(null);
                }}
                className="mt-1.5"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? t("common.loading") : t("auth.login.button")}
            </Button>
          </form>
        )}

        {loginError && !mfaFactorId && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4"
          >
            <div className="flex gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">{loginError}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tr(
                    "Se ainda não criou uma conta Fanlira, faça o cadastro. Se já criou, redefina a senha.",
                    "Create a Fanlira account if you do not have one yet, or reset its password.",
                  )}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button asChild type="button" size="sm">
                <Link to="/signup">{tr("Criar conta Fanlira", "Create Fanlira account")}</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={recoveryLoading}
                onClick={sendPasswordRecovery}
              >
                {recoveryLoading
                  ? t("common.loading")
                  : tr("Ativar/redefinir senha", "Activate/reset password")}
              </Button>
            </div>
            {recoverySent && (
              <p className="mt-3 text-xs font-medium text-foreground" role="status">
                {tr(
                  "Confira a caixa de entrada e o spam. Abra o link no mesmo computador para escolher a senha da Fanlira.",
                  "Check your inbox and spam. Open the link on this computer to choose your Fanlira password.",
                )}
              </p>
            )}
          </div>
        )}

        <Link
          to="/reset-password"
          className="mt-3 text-center text-sm text-muted-foreground hover:text-primary"
        >
          {t("auth.login.forgot")}
        </Link>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          {t("auth.or")}
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onGoogle}
          disabled={googleLoading}
          className="w-full"
        >
          {googleLoading ? t("common.loading") : t("auth.google")}
        </Button>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("auth.login.noAccount")}{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            {t("nav.signup")}
          </Link>
        </p>
      </div>
    </div>
  );
}

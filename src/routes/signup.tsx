import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { createOAuthCallbackUrl } from "@/lib/auth-redirect";
import { ensureGoogleAuthIsEnabled } from "@/lib/google-auth";
import { localizedPathname } from "@/lib/localized-paths";
import { trackClientError, trackProductEvent } from "@/lib/telemetry";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileCaptcha } from "@/components/TurnstileCaptcha";
import { isTurnstileEnabled } from "@/lib/turnstile";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

export function SignupPage() {
  const { t, tr, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaRequired = isTurnstileEnabled();
  const routeTo = (pathname: string) => localizedPathname(pathname, locale) as never;
  const feedRoute = routeTo("/feed");

  useEffect(() => {
    if (user) navigate({ to: feedRoute });
  }, [user, navigate, feedRoute]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (captchaRequired && !captchaToken) {
      toast.error(tr("Conclua a verificação de segurança.", "Complete the security check."));
      return;
    }
    if (password.length < 8) {
      toast.error(tr("A senha precisa ter pelo menos 8 caracteres.", "Your password must be at least 8 characters."));
      return;
    }
    if (password !== passwordConfirmation) {
      toast.error(tr("As senhas não coincidem.", "The passwords do not match."));
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: createOAuthCallbackUrl(window.location.origin),
          captchaToken: captchaToken ?? undefined,
          // Disponível nos templates do Supabase como {{ .Data.product_name }}.
          // Isso mantém o e-mail de confirmação com a identidade da Fanlira.
          data: { product_name: "Fanlira", brand_name: "Fanlira" },
        },
      });
      if (error) throw error;

      if (data.session) {
        trackProductEvent("signup_completed", { method: "password", confirmationRequired: false });
        toast.success(tr("Conta criada!", "Account created!"));
        navigate({ to: routeTo("/feed") });
        return;
      }

      setConfirmationEmail(email);
      trackProductEvent("signup_completed", { method: "password", confirmationRequired: true });
      setPassword("");
      setPasswordConfirmation("");
      toast.success(
        tr(
          "Confira seu e-mail para confirmar a conta.",
          "Check your email to confirm the account.",
        ),
      );
    } catch (error) {
      trackClientError("client_error", error, { flow: "signup", method: "password" });
      const errorMessage = error instanceof Error ? error.message : "";
      const normalizedError = errorMessage.toLowerCase();
      toast.error(
        normalizedError.includes("email rate limit exceeded") ||
          normalizedError.includes("rate limit")
          ? tr(
              "Muitas solicitações em pouco tempo. Aguarde alguns minutos e tente novamente.",
              "Too many requests in a short time. Wait a few minutes and try again.",
            )
          : errorMessage || tr("Não foi possível criar a conta.", "Unable to create the account."),
      );
    } finally {
      setLoading(false);
      setCaptchaToken(null);
      setCaptchaReset((current) => current + 1);
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
      trackClientError("client_error", error, { flow: "signup", method: "google" });
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
        <h1 className="text-3xl font-bold text-foreground">{t("auth.signup.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.signup.subtitle")}</p>

        {confirmationEmail && (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center">
            <h2 className="text-xl font-bold text-foreground">
              {tr("Confirme sua conta", "Confirm your account")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr(
                `Enviamos as instruções para ${confirmationEmail}. Depois da confirmação, volte para entrar.`,
                `We sent instructions to ${confirmationEmail}. Return to sign in after confirming.`,
              )}
            </p>
            <Button asChild className="mt-5 w-full">
              <Link to={routeTo("/login")}>{tr("Voltar para o login", "Back to sign in")}</Link>
            </Button>
            <Link
              to={routeTo("/reset-password")}
              className="mt-3 inline-block text-sm text-muted-foreground hover:text-primary"
            >
              {tr("Já tinha conta? Redefinir senha", "Already had an account? Reset password")}
            </Link>
          </div>
        )}

        {!confirmationEmail && (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? tr("Ocultar senha", "Hide password") : tr("Mostrar senha", "Show password")}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr("Use pelo menos 8 caracteres.", "Use at least 8 characters.")}
              </p>
            </div>
            <div>
              <Label htmlFor="password-confirmation">
                {tr("Confirme sua senha", "Confirm your password")}
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="password-confirmation"
                  type={showPasswordConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirmation((visible) => !visible)}
                  aria-label={showPasswordConfirmation ? tr("Ocultar confirmação", "Hide confirmation") : tr("Mostrar confirmação", "Show confirmation")}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPasswordConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <TurnstileCaptcha
              action="signup"
              onTokenChange={setCaptchaToken}
              resetSignal={captchaReset}
            />
            <Button
              type="submit"
              disabled={loading || (captchaRequired && !captchaToken)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? t("common.loading") : t("auth.signup.button")}
            </Button>
          </form>
        )}

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
          {t("auth.signup.haveAccount")}{" "}
          <Link to={routeTo("/login")} className="font-medium text-primary hover:underline">
            {t("nav.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}

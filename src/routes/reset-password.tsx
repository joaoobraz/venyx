import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import { localizedPathname } from "@/lib/localized-paths";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileCaptcha } from "@/components/TurnstileCaptcha";
import { isTurnstileEnabled } from "@/lib/turnstile";
import { PASSWORD_MIN_LENGTH, passwordPolicyHint, passwordPolicyMessage } from "@/lib/password-policy";
import { describeMfaError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
});

export function ResetPage() {
  const { t, tr, locale } = useI18n();
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const captchaRequired = isTurnstileEnabled();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.includes("type=recovery")) setRecovery(true);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    if (captchaRequired && !captchaToken) {
      toast.error("Conclua a verificação de segurança.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${localizedPathname("/reset-password", locale)}`,
      captchaToken: captchaToken ?? undefined,
    });
    setLoading(false);
    setCaptchaToken(null);
    setCaptchaReset((current) => current + 1);
    if (error) console.error("[reset-password]", error);
    // Mensagem genérica em todos os casos para evitar enumeração de e-mails
    toast.success("Se este e-mail existir em nossa base, enviamos um link de redefinição.");
  };

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    const passwordProblem = passwordPolicyMessage(password, tr);
    if (passwordProblem) {
      toast.error(passwordProblem);
      return;
    }
    setLoading(true);
    try {
      // Conta com 2FA: o link de recuperação abre uma sessão aal1 e o Supabase
      // exige aal2 para trocar a senha. Pedimos o código do autenticador antes.
      if (mfaFactorId) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: mfaFactorId,
        });
        if (challengeError) throw challengeError;
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: mfaFactorId,
          challengeId: challenge.id,
          code: mfaCode.replace(/\D/g, ""),
        });
        if (verifyError) throw verifyError;
      } else {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const factor = factors?.totp.find((item) => item.status === "verified");
          if (factor) {
            setMfaFactorId(factor.id);
            toast.message("Digite o código do seu aplicativo autenticador para concluir.");
            return;
          }
        }
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada!");
      window.location.href = localizedPathname("/feed", locale);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        /aal2|assurance|mfa|code|totp/i.test(message)
          ? describeMfaError(error, tr)
          : tr("Não foi possível atualizar a senha. Peça um novo link e tente novamente.", "Couldn't update the password. Request a new link and try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground">{t("auth.reset.title")}</h1>

        {recovery ? (
          <form onSubmit={updatePassword} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="np">{t("auth.reset.new")}</Label>
              <Input
                id="np"
                type="password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">{passwordPolicyHint(tr)}</p>
            </div>
            {mfaFactorId && (
              <div>
                <Label htmlFor="mfa-code">Código do autenticador (2FA)</Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  minLength={6}
                  maxLength={8}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {mfaFactorId ? "Confirmar código e atualizar senha" : t("auth.reset.update")}
            </Button>
          </form>
        ) : (
          <form onSubmit={sendLink} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="em">{t("auth.email")}</Label>
              <Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
            </div>
            <TurnstileCaptcha
              action="password_recovery"
              onTokenChange={setCaptchaToken}
              resetSignal={captchaReset}
            />
            <Button type="submit" disabled={loading || (captchaRequired && !captchaToken)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {t("auth.reset.send")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

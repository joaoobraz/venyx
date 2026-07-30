import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (await prepareMfaChallenge()) return;
      navigate({ to: "/feed" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/feed" });
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
                onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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

        <Button variant="outline" onClick={onGoogle} className="w-full">
          {t("auth.google")}
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

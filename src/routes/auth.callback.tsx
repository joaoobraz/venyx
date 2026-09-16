import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getOAuthErrorFromUrl, getSafeAuthRedirectPath } from "@/lib/auth-redirect";
import { getMyMfaState } from "@/_server/mfa-email.functions";
import { useI18n } from "@/lib/i18n";
import { localizedPathname } from "@/lib/localized-paths";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { tr, locale } = useI18n();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loginPath = localizedPathname("/login", locale);

  useEffect(() => {
    let active = true;

    const finishLogin = async () => {
      try {
        // Texto vindo da URL nunca vai para a tela (evita injeção de texto em
        // página legítima); mapeamos para mensagens fixas.
        const oauthError = getOAuthErrorFromUrl(window.location.href);
        if (oauthError) {
          console.warn("[auth.callback] provider error", oauthError.slice(0, 120));
          throw new Error(
            /access_denied|cancel/i.test(oauthError)
              ? tr("Login com Google cancelado.", "Google sign-in was cancelled.")
              : tr("O Google não concluiu o login. Tente novamente.", "Google didn't complete the sign-in. Try again."),
          );
        }

        const url = new URL(window.location.href);
        const next = getSafeAuthRedirectPath(url.searchParams.get("next"));
        const code = url.searchParams.get("code");
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const isPasswordRecovery = hashParams.get("type") === "recovery";
        const recoveryHash = isPasswordRecovery ? url.hash : "";

        const { data: initialData, error } = await supabase.auth.getSession();
        if (error) throw error;
        let data = initialData;

        if (!data.session && code) {
          const exchange = await supabase.auth.exchangeCodeForSession(code);
          if (exchange.error) throw exchange.error;
          data = exchange.data;
        }

        if (!data.session) {
          throw new Error("Não foi possível confirmar sua sessão.");
        }

        if (isPasswordRecovery) {
          window.location.replace(`/reset-password${recoveryHash}`);
          return;
        }

        // SECURITY: conta com 2FA mas sessão ainda aal1 (Google / link de
        // e-mail). Sem isto, a senha ou a conta Google sozinha entrava direto.
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
          window.location.replace(loginPath);
          return;
        }
        const mfaState = await getMyMfaState().catch(() => null);
        if (mfaState?.emailPending) {
          window.location.replace(loginPath);
          return;
        }

        window.location.replace(next);
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : tr("Não foi possível concluir o login com o Google.", "Couldn't complete Google sign-in."),
        );
      }
    };

    void finishLogin();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez ao montar
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {errorMessage ? (
          <>
            <CircleAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">{tr("Login não concluído", "Sign-in not completed")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <Button asChild className="mt-6 w-full">
              <Link to={loginPath as never}>{tr("Voltar para o login", "Back to sign in")}</Link>
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle
              className="mx-auto h-10 w-10 animate-spin text-primary"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-2xl font-bold text-foreground">{tr("Concluindo seu login", "Finishing your sign-in")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr("Estamos validando sua conta Google. Isso leva apenas alguns segundos.", "We're validating your Google account. This takes just a few seconds.")}
            </p>
          </>
        )}
      </section>
    </main>
  );
}

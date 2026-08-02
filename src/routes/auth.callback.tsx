import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getOAuthErrorFromUrl, getSafeAuthRedirectPath } from "@/lib/auth-redirect";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const finishLogin = async () => {
      try {
        const oauthError = getOAuthErrorFromUrl(window.location.href);
        if (oauthError) throw new Error(oauthError);

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

        window.location.replace(next);
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o login com o Google.",
        );
      }
    };

    void finishLogin();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {errorMessage ? (
          <>
            <CircleAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Login não concluído</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <Button asChild className="mt-6 w-full">
              <Link to="/login">Voltar para o login</Link>
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle
              className="mx-auto h-10 w-10 animate-spin text-primary"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-2xl font-bold text-foreground">Concluindo seu login</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos validando sua conta Google. Isso leva apenas alguns segundos.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/403")({
  head: () => ({
    meta: [
      { title: "403 — Acesso negado" },
      { name: "description", content: "Você não tem permissão para acessar esta página." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForbiddenPage,
});

function ForbiddenPage() {
  const { isAdmin, mfaEnabled } = useAuth();
  const navigate = useNavigate();
  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const needsTwoFactor = isAdmin && !mfaEnabled;
  const needsSessionTwoFactor = isAdmin && mfaEnabled && sessionLevel === "aal1";

  useEffect(() => {
    if (!isAdmin || !mfaEnabled) return;
    let active = true;
    setCheckingSession(true);
    supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(({ data }) => {
        if (active) setSessionLevel(data?.currentLevel ?? null);
      })
      .catch(() => {
        if (active) setSessionLevel(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, mfaEnabled]);

  const verifySessionMfa = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = factors.totp.find((item) => item.status === "verified");
      if (!factor) throw new Error("Nenhum autenticador 2FA verificado foi encontrado.");
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;
      await supabase.auth.refreshSession();
      toast.success("2FA confirmado. Área administrativa liberada.");
      navigate({ to: "/administracao" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o 2FA.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-lg py-20 text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-destructive/10">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">403 — Acesso negado</h1>
          <p className="text-muted-foreground">
            {needsTwoFactor
              ? "Sua conta é administradora, mas o acesso exige autenticação em 2 fatores (2FA). Ative o 2FA para entrar nesta área."
              : needsSessionTwoFactor
                ? "O 2FA já está ativo, mas esta sessão ainda precisa ser confirmada. Digite o código do seu aplicativo autenticador."
                : checkingSession
                  ? "Estamos verificando a autenticação desta sessão…"
              : "Você não tem permissão para acessar esta página. Esta área é restrita a administradores."}
          </p>
        </div>
        {needsSessionTwoFactor && (
          <form onSubmit={verifySessionMfa} className="mx-auto w-full max-w-xs space-y-3 text-left">
            <Label htmlFor="forbidden-mfa-code">Código do autenticador</Label>
            <Input
              id="forbidden-mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-lg tracking-widest"
            />
            <Button type="submit" className="w-full" disabled={verifying || code.length !== 6}>
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar 2FA
            </Button>
          </form>
        )}
        <div className="flex gap-3 justify-center">
          {needsTwoFactor && (
            <Button asChild>
              <Link to="/settings/security">Ativar 2FA</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/feed">Voltar para o feed</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

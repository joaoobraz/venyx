import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

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
  const needsTwoFactor = isAdmin && !mfaEnabled;

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
              : "Você não tem permissão para acessar esta página. Esta área é restrita a administradores."}
          </p>
        </div>
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Wallet as WalletIcon, ArrowDownToLine, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/creator/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  if (!isCreator) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <WalletIcon className="h-4 w-4" /> Saldo disponível
          </div>
          <div className="mt-2 text-4xl font-bold">R$ 0,00</div>
          <Button className="mt-4 bg-black/20 backdrop-blur-sm hover:bg-black/30">
            <ArrowDownToLine className="mr-2 h-4 w-4" /> Solicitar saque
          </Button>
        </div>
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" /> Histórico
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma transação ainda.</p>
        </div>
      </div>
    </AppShell>
  );
}

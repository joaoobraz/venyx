import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet as WalletIcon, ArrowDownToLine, TrendingUp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/creator/wallet")({
  component: WalletPage,
});

interface Tx {
  id: string;
  type: string;
  amount_cents: number;
  status: string;
  created_at: string;
}

function WalletPage() {
  const { user, isCreator, mfaEnabled, loading } = useAuth();
  const nav = useNavigate();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [balance, setBalance] = useState(0);
  const [requireMfa, setRequireMfa] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("transactions")
      .select("id, type, amount_cents, status, created_at")
      .eq("payee_id", user.id)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const list = (data ?? []) as Tx[];
        setTxs(list);
        setBalance(list.reduce((s, t) => s + t.amount_cents, 0));
      });
    supabase
      .from("security_settings")
      .select("mfa_required_for_withdraw")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) =>
        setRequireMfa(!!(data as { mfa_required_for_withdraw?: boolean } | null)?.mfa_required_for_withdraw),
      );
  }, [user]);

  if (!isCreator) return null;

  const requestWithdraw = async () => {
    if (mfaEnabled && requireMfa && !showMfa) {
      setShowMfa(true);
      return;
    }
    if (mfaEnabled && requireMfa) {
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const f = factors?.totp?.[0];
        if (!f) throw new Error("2FA não encontrado");
        const { data: chal } = await supabase.auth.mfa.challenge({ factorId: f.id });
        const { error } = await supabase.auth.mfa.verify({ factorId: f.id, challengeId: chal!.id, code });
        if (error) throw error;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Código inválido");
        return;
      }
    }
    toast.success("Saque solicitado! Você receberá em até 2 dias úteis.");
    setShowMfa(false);
    setCode("");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <WalletIcon className="h-4 w-4" /> Saldo disponível
          </div>
          <div className="mt-2 text-4xl font-bold">R$ {(balance / 100).toFixed(2)}</div>
          {!showMfa ? (
            <Button onClick={requestWithdraw} className="mt-4 bg-black/20 backdrop-blur-sm hover:bg-black/30">
              <ArrowDownToLine className="mr-2 h-4 w-4" /> Solicitar saque
              {mfaEnabled && requireMfa && <ShieldCheck className="ml-2 h-3.5 w-3.5" />}
            </Button>
          ) : (
            <div className="mt-4 space-y-2 rounded-lg bg-black/20 p-3 backdrop-blur-sm">
              <p className="text-xs opacity-90">Digite o código do seu app autenticador:</p>
              <Input
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                className="border-white/20 bg-white/10 text-center tracking-widest text-white placeholder:text-white/50"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
                  onClick={() => {
                    setShowMfa(false);
                    setCode("");
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={requestWithdraw} disabled={code.length !== 6} className="flex-1 bg-white text-primary hover:bg-white/90">
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" /> Histórico
          </div>
          {txs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma transação ainda.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-background p-3 text-sm">
                  <div>
                    <div className="font-medium text-foreground capitalize">{t.type.replace("_", " ")}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="font-bold text-accent">+R$ {(t.amount_cents / 100).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

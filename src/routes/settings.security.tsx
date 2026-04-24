import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, ShieldCheck, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings/security")({
  component: SecurityPage,
});

interface FactorEnroll {
  id: string;
  totp: { qr_code: string; secret: string };
}

function SecurityPage() {
  const { user, mfaEnabled, refresh, loading } = useAuth();
  const nav = useNavigate();
  const [enrolling, setEnrolling] = useState<FactorEnroll | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [requireForWithdraw, setRequireForWithdraw] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("security_settings")
      .select("mfa_required_for_withdraw")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRequireForWithdraw(!!(data as { mfa_required_for_withdraw: boolean }).mfa_required_for_withdraw);
      });
  }, [user]);

  if (!user) return null;

  const startEnroll = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setEnrolling(data as FactorEnroll);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!enrolling) return;
    setBusy(true);
    try {
      const { data: chal, error: ce } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
      if (ce) throw ce;
      const { error: ve } = await supabase.auth.mfa.verify({
        factorId: enrolling.id,
        challengeId: chal.id,
        code,
      });
      if (ve) throw ve;
      await supabase
        .from("security_settings")
        .upsert({ user_id: user.id, mfa_enabled: true, mfa_required_for_withdraw: requireForWithdraw });
      toast.success("2FA ativado!");
      setEnrolling(null);
      setCode("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      await supabase.from("security_settings").upsert({ user_id: user.id, mfa_enabled: false });
      toast.success("2FA desativado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const updateRequire = async (v: boolean) => {
    setRequireForWithdraw(v);
    await supabase
      .from("security_settings")
      .upsert({ user_id: user.id, mfa_required_for_withdraw: v });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold text-foreground">Segurança</h1>
        </div>

        <div className="space-y-4 rounded-2xl bg-card p-5">
          <div className="flex items-start gap-3">
            <div className={`rounded-full p-2 ${mfaEnabled ? "bg-green-500/20" : "bg-muted"}`}>
              <ShieldCheck className={`h-5 w-5 ${mfaEnabled ? "text-green-400" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">Autenticação em 2 fatores (2FA)</h2>
              <p className="text-xs text-muted-foreground">
                {mfaEnabled
                  ? "Sua conta está protegida. Você precisa do código do app a cada login."
                  : "Use Google Authenticator, Authy ou similar para gerar códigos temporários."}
              </p>
            </div>
            {mfaEnabled ? (
              <Button size="sm" variant="outline" onClick={disable} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desativar"}
              </Button>
            ) : (
              !enrolling && (
                <Button
                  size="sm"
                  onClick={startEnroll}
                  disabled={busy}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar 2FA"}
                </Button>
              )
            )}
          </div>

          {enrolling && (
            <div className="space-y-3 rounded-xl bg-background p-4">
              <p className="text-xs text-muted-foreground">
                <Smartphone className="mr-1 inline h-3.5 w-3.5" /> Escaneie o QR no seu app autenticador:
              </p>
              <div className="flex justify-center rounded-lg bg-white p-3">
                <img src={enrolling.totp.qr_code} alt="QR Code" className="h-44 w-44" />
              </div>
              <div className="text-center text-[10px] text-muted-foreground">
                Ou digite manualmente: <code className="text-foreground">{enrolling.totp.secret}</code>
              </div>
              <Input
                placeholder="Digite o código de 6 dígitos"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEnrolling(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={verify}
                  disabled={busy || code.length !== 6}
                  className="flex-1 bg-primary text-primary-foreground"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                </Button>
              </div>
            </div>
          )}

          {mfaEnabled && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <div className="text-sm font-medium text-foreground">Exigir 2FA para saques</div>
                <div className="text-xs text-muted-foreground">Pedir código ao solicitar saque na carteira</div>
              </div>
              <Switch checked={requireForWithdraw} onCheckedChange={updateRequire} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

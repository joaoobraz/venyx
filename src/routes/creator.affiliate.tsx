import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Loader2, Crown, TrendingUp, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/creator/affiliate")({
  component: AffiliatePage,
});

interface AffCode {
  id: string;
  code: string;
  commission_pct: number;
  total_clicks: number;
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function AffiliatePage() {
  const { user, isCreator, isAmbassador, profile, loading } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState<AffCode | null>(null);
  const [referrals, setReferrals] = useState(0);
  const [conversions, setConversions] = useState(0);
  const [commissionCents, setCommissionCents] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.from("affiliate_codes").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setCode((data as AffCode) ?? null);
    });
    supabase
      .from("affiliate_referrals")
      .select("converted_at, commission_cents")
      .eq("ambassador_id", user.id)
      .then(({ data }) => {
        const list = (data ?? []) as { converted_at: string | null; commission_cents: number }[];
        setReferrals(list.length);
        setConversions(list.filter((r) => r.converted_at).length);
        setCommissionCents(list.reduce((s, r) => s + r.commission_cents, 0));
      });
  }, [user]);

  if (!user) return null;

  if (!isCreator || !isAmbassador) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border p-8 text-center">
          <Crown className="mx-auto mb-3 h-10 w-10 text-accent" />
          <h1 className="text-lg font-bold text-foreground">Programa de Embaixadoras</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O programa de afiliados é exclusivo para criadoras com a tag <strong className="text-accent">Embaixadora</strong>.
            Esta tag é atribuída pelo time Venyx para criadoras de destaque na plataforma.
          </p>
          {!isCreator && (
            <Link to="/become-creator" className="mt-4 inline-block">
              <Button>Tornar-se criadora</Button>
            </Link>
          )}
        </div>
      </AppShell>
    );
  }

  const create = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const newCode = `${profile?.username?.toUpperCase().slice(0, 4) ?? "VEN"}${genCode()}`;
      const { data, error } = await supabase
        .from("affiliate_codes")
        .insert({ user_id: user.id, code: newCode, commission_pct: 10 })
        .select()
        .single();
      if (error) throw error;
      setCode(data as AffCode);
      toast.success("Link de afiliado criado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const link = code ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${code.code}` : "";

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-90">
            <Crown className="h-4 w-4" /> Embaixadora Venyx
          </div>
          <h1 className="mt-2 text-2xl font-bold">Programa de Afiliados</h1>
          <p className="mt-1 text-sm opacity-90">
            Indique novos clientes e ganhe {code?.commission_pct ?? 10}% sobre a 1ª assinatura.
          </p>
        </div>

        {!code ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não tem um link de afiliado.</p>
            <Button onClick={create} disabled={busy} className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar meu link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl bg-card p-5">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Seu link único</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-background p-3 text-sm text-primary">{link}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={Users} label="Cliques" value={code.total_clicks.toString()} />
              <Stat icon={TrendingUp} label="Conversões" value={`${conversions}/${referrals}`} />
              <Stat icon={DollarSign} label="Comissão" value={`R$ ${(commissionCents / 100).toFixed(2)}`} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <Icon className="mb-1 h-4 w-4 text-accent" />
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-base font-bold text-foreground">{value}</div>
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Loader2, Crown, TrendingUp, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

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

export function AffiliatePage() {
  const { tr } = useI18n();
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
    supabase
      .from("affiliate_codes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
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
          <h1 className="text-lg font-bold text-foreground">
            {tr("Programa de Embaixadoras", "Ambassador Program")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tr(
              "O programa de afiliados é exclusivo para criadoras com a tag",
              "The affiliate program is exclusive to creators with the",
            )}{" "}
            <strong className="text-accent">{tr("Embaixadora", "Ambassador")}</strong>{" "}
            {tr(
              "Essa tag é atribuída pelo time Fanlira às criadoras de destaque na plataforma.",
              "tag. The Fanlira team awards it to standout creators on the platform.",
            )}
          </p>
          {!isCreator && (
            <Link to="/become-creator" className="mt-4 inline-block">
              <Button>{tr("Tornar-se criadora", "Become a creator")}</Button>
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
      toast.success(tr("Link de afiliado criado!", "Affiliate link created!"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const link = code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${code.code}`
    : "";

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-90">
            <Crown className="h-4 w-4" /> {tr("Embaixadora Fanlira", "Fanlira Ambassador")}
          </div>
          <h1 className="mt-2 text-2xl font-bold">
            {tr("Programa de Afiliados", "Affiliate Program")}
          </h1>
          <p className="mt-1 text-sm opacity-90">
            {tr("Indique novos clientes e ganhe", "Refer new customers and earn")}{" "}
            {code?.commission_pct ?? 10}%{" "}
            {tr("sobre a primeira assinatura.", "from their first subscription.")}
          </p>
        </div>

        {!code ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {tr(
                "Você ainda não tem um link de afiliado.",
                "You don't have an affiliate link yet.",
              )}
            </p>
            <Button
              onClick={create}
              disabled={busy}
              className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                tr("Gerar meu link", "Generate my link")
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl bg-card p-5">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {tr("Seu link único", "Your unique link")}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-background p-3 text-sm text-primary">
                  {link}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    toast.success(tr("Link copiado!", "Link copied!"));
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat
                icon={Users}
                label={tr("Cliques", "Clicks")}
                value={code.total_clicks.toString()}
              />
              <Stat
                icon={TrendingUp}
                label={tr("Conversões", "Conversions")}
                value={`${conversions}/${referrals}`}
              />
              <Stat
                icon={DollarSign}
                label={tr("Comissão", "Commission")}
                value={`R$ ${(commissionCents / 100).toFixed(2)}`}
              />
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

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Camera,
  Image as ImageIcon,
  FileText,
  DollarSign,
  PenSquare,
  Share2,
  Check,
  X,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface OnboardingState {
  has_avatar: boolean;
  has_cover: boolean;
  has_bio: boolean;
  has_price: boolean;
  has_first_post: boolean;
  has_first_ppv: boolean;
  has_shared_link: boolean;
  dismissed: boolean;
}

interface ChecklistItem {
  key: keyof Omit<OnboardingState, "dismissed">;
  label: string;
  cta: string;
  icon: typeof Camera;
  to: "/settings/profile" | "/creator/posts";
}

const ITEMS: ChecklistItem[] = [
  { key: "has_avatar", label: "Adicione sua foto de perfil", cta: "Adicionar foto", icon: Camera, to: "/settings/profile" },
  { key: "has_cover", label: "Adicione uma foto de capa", cta: "Adicionar capa", icon: ImageIcon, to: "/settings/profile" },
  { key: "has_bio", label: "Escreva uma bio (10+ caracteres)", cta: "Escrever bio", icon: FileText, to: "/settings/profile" },
  { key: "has_price", label: "Defina o preço de assinatura", cta: "Definir preço", icon: DollarSign, to: "/settings/profile" },
  { key: "has_first_post", label: "Publique seu 1º post", cta: "Criar primeiro post", icon: PenSquare, to: "/creator/posts" },
  { key: "has_first_ppv", label: "Publique seu 1º PPV", cta: "Publicar primeiro PPV", icon: Lock, to: "/creator/posts" },
  { key: "has_shared_link", label: "Compartilhe seu link de perfil", cta: "Copiar meu link", icon: Share2, to: "/settings/profile" },
];

export function OnboardingChecklist() {
  const { user, profile, isCreator } = useAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isCreator) return;
    let cancelled = false;
    (async () => {
      const [{ data: row }, { count: postCount }, { count: ppvCount }] = await Promise.all([
        supabase.from("creator_onboarding").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", user.id)
          .eq("visibility", "ppv"),
      ]);

      const derived: OnboardingState = {
        has_avatar: !!profile?.avatar_url,
        has_cover: !!profile?.cover_url,
        has_bio: !!profile?.bio && profile.bio.length > 10,
        has_price: !!profile?.subscription_price_cents && profile.subscription_price_cents > 0,
        has_first_post: (postCount ?? 0) > 0,
        has_first_ppv: (ppvCount ?? 0) > 0,
        has_shared_link: !!row?.has_shared_link,
        dismissed: !!row?.dismissed,
      };

      if (!row) {
        await supabase.from("creator_onboarding").insert({
          user_id: user.id,
          has_avatar: derived.has_avatar,
          has_cover: derived.has_cover,
          has_bio: derived.has_bio,
          has_price: derived.has_price,
          has_first_post: derived.has_first_post,
          has_shared_link: derived.has_shared_link,
        });
      } else {
        const patch: Partial<{
          has_avatar: boolean;
          has_cover: boolean;
          has_bio: boolean;
          has_price: boolean;
          has_first_post: boolean;
        }> = {};
        (["has_avatar", "has_cover", "has_bio", "has_price", "has_first_post"] as const).forEach((k) => {
          if (row[k] !== derived[k]) patch[k] = derived[k];
        });
        if (Object.keys(patch).length > 0) {
          await supabase.from("creator_onboarding").update(patch).eq("user_id", user.id);
        }
      }

      if (!cancelled) {
        setState(derived);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isCreator, profile]);

  const dismiss = async () => {
    if (!user) return;
    setState((s) => (s ? { ...s, dismissed: true } : s));
    await supabase.from("creator_onboarding").update({ dismissed: true }).eq("user_id", user.id);
  };

  const markShared = async () => {
    if (!user || !profile) return;
    const url = `${window.location.origin}/profile/${profile.username}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* noop */
    }
    setState((s) => (s ? { ...s, has_shared_link: true } : s));
    await supabase.from("creator_onboarding").update({ has_shared_link: true }).eq("user_id", user.id);
  };

  const nextStep = useMemo(() => {
    if (!state) return null;
    return ITEMS.find((it) => !state[it.key]) ?? null;
  }, [state]);

  if (!isCreator || loading || !state || state.dismissed) return null;

  const completed = ITEMS.filter((it) => state[it.key]).length;
  const total = ITEMS.length;
  const pct = Math.round((completed / total) * 100);

  if (completed === total) return null;

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/5 p-5 shadow-glow">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">🚀 Comece a faturar</h3>
          <p className="text-xs text-muted-foreground">
            {completed}/{total} concluído • {pct}%
          </p>
        </div>
        <button
          onClick={dismiss}
          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {nextStep && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <nextStep.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">Próximo passo</div>
            <div className="truncate text-sm font-semibold text-foreground">{nextStep.label}</div>
          </div>
          {nextStep.key === "has_shared_link" ? (
            <Button size="sm" onClick={markShared} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              {nextStep.cta}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              <Link to={nextStep.to}>
                {nextStep.cta}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {ITEMS.map((it) => {
          const done = state[it.key];
          const Icon = it.icon;
          const isShare = it.key === "has_shared_link";
          const content = (
            <>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="flex-1 text-left">{it.label}</span>
            </>
          );
          const cls = `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
            done
              ? "bg-background/40 text-muted-foreground line-through"
              : "bg-background hover:bg-background/70 text-foreground"
          }`;
          return (
            <li key={it.key}>
              {done || !isShare ? (
                <Link to={it.to} className={cls}>
                  {content}
                </Link>
              ) : (
                <button onClick={markShared} className={cls}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

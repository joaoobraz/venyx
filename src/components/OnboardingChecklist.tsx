import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Image as ImageIcon, FileText, DollarSign, PenSquare, Share2, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface OnboardingState {
  has_avatar: boolean;
  has_cover: boolean;
  has_bio: boolean;
  has_price: boolean;
  has_first_post: boolean;
  has_shared_link: boolean;
  dismissed: boolean;
}

const DEFAULT_STATE: OnboardingState = {
  has_avatar: false,
  has_cover: false,
  has_bio: false,
  has_price: false,
  has_first_post: false,
  has_shared_link: false,
  dismissed: false,
};

export function OnboardingChecklist() {
  const { user, profile, isCreator } = useAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isCreator) return;
    let cancelled = false;
    (async () => {
      // Compute live derived flags from profile + posts
      const { data: row } = await supabase
        .from("creator_onboarding")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const { count: postCount } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", user.id);

      const derived: OnboardingState = {
        has_avatar: !!profile?.avatar_url,
        has_cover: !!profile?.cover_url,
        has_bio: !!profile?.bio && profile.bio.length > 10,
        has_price: !!profile?.subscription_price_cents && profile.subscription_price_cents > 0,
        has_first_post: (postCount ?? 0) > 0,
        has_shared_link: !!row?.has_shared_link,
        dismissed: !!row?.dismissed,
      };

      if (!row) {
        await supabase.from("creator_onboarding").insert({ user_id: user.id, ...derived });
      } else {
        // Persiste flags derivadas que mudaram
        const patch: Partial<OnboardingState> = {};
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
    } catch { /* noop */ }
    setState((s) => (s ? { ...s, has_shared_link: true } : s));
    await supabase.from("creator_onboarding").update({ has_shared_link: true }).eq("user_id", user.id);
  };

  if (!isCreator || loading || !state || state.dismissed) return null;

  const items = [
    { key: "has_avatar", label: "Adicione sua foto de perfil", icon: Camera, to: "/settings/profile" as const },
    { key: "has_cover", label: "Adicione uma foto de capa", icon: ImageIcon, to: "/settings/profile" as const },
    { key: "has_bio", label: "Escreva uma bio (10+ caracteres)", icon: FileText, to: "/settings/profile" as const },
    { key: "has_price", label: "Defina o preço de assinatura", icon: DollarSign, to: "/settings/profile" as const },
    { key: "has_first_post", label: "Publique seu 1º post", icon: PenSquare, to: "/creator/posts" as const },
  ] as const;

  const completed = items.filter((it) => state[it.key]).length + (state.has_shared_link ? 1 : 0);
  const total = items.length + 1;
  const pct = Math.round((completed / total) * 100);

  if (completed === total) return null;

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/5 p-5 shadow-glow">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">🚀 Comece a faturar</h3>
          <p className="text-xs text-muted-foreground">{completed}/{total} concluído • {pct}%</p>
        </div>
        <button onClick={dismiss} className="rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-background">
        <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {items.map((it) => {
          const done = state[it.key];
          const Icon = it.icon;
          return (
            <li key={it.key}>
              <Link
                to={it.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  done ? "bg-background/40 text-muted-foreground line-through" : "bg-background hover:bg-background/70 text-foreground"
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="flex-1">{it.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            onClick={markShared}
            disabled={state.has_shared_link}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
              state.has_shared_link
                ? "bg-background/40 text-muted-foreground line-through"
                : "bg-background hover:bg-background/70 text-foreground"
            }`}
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${state.has_shared_link ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {state.has_shared_link ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </span>
            <span className="flex-1 text-left">Compartilhe seu link de perfil</span>
          </button>
        </li>
      </ul>

      {!state.has_first_post && (
        <Button asChild className="mt-4 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
          <Link to="/creator/posts">Criar meu 1º post</Link>
        </Button>
      )}
    </section>
  );
}

// Helper para esconder warning sobre Loader2 não usado se necessário no futuro
export const _unused = Loader2;

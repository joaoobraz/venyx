import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, MapPinOff, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  BRAZIL_STATES,
  CREATOR_PROFILE_VISIBILITY_CHANGED_EVENT,
  DEFAULT_PROFILE_VISIBILITY,
  profileVisibilityFromDatabase,
  profileVisibilityToDatabase,
  readDemoProfileVisibility,
  resolveOwnProfileUsername,
  writeDemoProfileVisibility,
  type BrazilStateCode,
  type CreatorProfileVisibility,
} from "@/lib/profile-visibility";

type VisibilityKey = Exclude<keyof CreatorProfileVisibility, "blockedStates">;

const VISIBILITY_OPTIONS: Array<{
  key: VisibilityKey;
  pt: string;
  en: string;
  descriptionPt: string;
  descriptionEn: string;
}> = [
  {
    key: "showAge",
    pt: "Idade",
    en: "Age",
    descriptionPt: "Exibe a idade no resumo do perfil.",
    descriptionEn: "Shows age in the profile summary.",
  },
  {
    key: "showLocation",
    pt: "Localização",
    en: "Location",
    descriptionPt: "Exibe cidade e estado informados.",
    descriptionEn: "Shows the provided city and state.",
  },
  {
    key: "showSocialLinks",
    pt: "Redes sociais",
    en: "Social links",
    descriptionPt: "Exibe as redes e links públicos.",
    descriptionEn: "Shows public social networks and links.",
  },
  {
    key: "showSubscriberCount",
    pt: "Número de assinantes",
    en: "Subscriber count",
    descriptionPt: "Exibe o total de assinantes.",
    descriptionEn: "Shows the subscriber total.",
  },
  {
    key: "showRanking",
    pt: "Posição no ranking",
    en: "Ranking",
    descriptionPt: "Exibe a posição da modelo no ranking.",
    descriptionEn: "Shows the creator's ranking position.",
  },
  {
    key: "showVerifiedBadge",
    pt: "Selos",
    en: "Badges",
    descriptionPt: "Exibe selo verificado e proteção da conta.",
    descriptionEn: "Shows verification and account protection badges.",
  },
  {
    key: "showWishlist",
    pt: "Lista de desejos",
    en: "Wishlist",
    descriptionPt: "Exibe o acesso à Lista de Mimos.",
    descriptionEn: "Shows access to the Gift List.",
  },
  {
    key: "showPlans",
    pt: "Planos e valores",
    en: "Plans and pricing",
    descriptionPt: "Exibe assinatura, planos e preço público.",
    descriptionEn: "Shows subscriptions, plans and public pricing.",
  },
  {
    key: "showComments",
    pt: "Comentários",
    en: "Comments",
    descriptionPt: "Permite abrir e publicar comentários nos posts.",
    descriptionEn: "Allows comments to be opened and posted on posts.",
  },
  {
    key: "showResponseTime",
    pt: "Tempo de resposta",
    en: "Response time",
    descriptionPt: "Exibe a estimativa de resposta da modelo.",
    descriptionEn: "Shows the creator's response estimate.",
  },
  {
    key: "showBio",
    pt: "Biografia",
    en: "Biography",
    descriptionPt: "Exibe a descrição principal do perfil.",
    descriptionEn: "Shows the main profile description.",
  },
  {
    key: "showCategory",
    pt: "Categoria",
    en: "Category",
    descriptionPt: "Exibe a categoria principal do conteúdo.",
    descriptionEn: "Shows the main content category.",
  },
  {
    key: "showLikeCount",
    pt: "Total de curtidas",
    en: "Like count",
    descriptionPt: "Exibe o número acumulado de curtidas.",
    descriptionEn: "Shows the accumulated like count.",
  },
  {
    key: "showPostCount",
    pt: "Total de posts",
    en: "Post count",
    descriptionPt: "Exibe o número de publicações.",
    descriptionEn: "Shows the number of posts.",
  },
  {
    key: "showActivityStatus",
    pt: "Status de atividade",
    en: "Activity status",
    descriptionPt: "Exibe se está online ou quando esteve ativa.",
    descriptionEn: "Shows online or last-active status.",
  },
];

export function CreatorProfileVisibilitySettings() {
  const { user, profile, isCreator, demoPreviewRole } = useAuth();
  const { tr } = useI18n();
  const demoCreatorMode = demoPreviewRole === "creator";
  const creatorId = demoCreatorMode ? "demo-aline" : (user?.id ?? null);
  const creatorUsername = resolveOwnProfileUsername({
    authenticatedUserId: user?.id,
    profileUserId: profile?.user_id,
    profileUsername: profile?.username,
    isCreator,
    demoPreviewRole,
  });
  const [settings, setSettings] = useState<CreatorProfileVisibility>(() =>
    demoCreatorMode
      ? readDemoProfileVisibility("demo-aline")
      : { ...DEFAULT_PROFILE_VISIBILITY, blockedStates: [] },
  );
  const [selectedState, setSelectedState] = useState<BrazilStateCode | "">("");
  const [loading, setLoading] = useState(!demoCreatorMode);
  const [saving, setSaving] = useState(false);

  const creatorMode = demoCreatorMode || isCreator;

  useEffect(() => {
    if (!creatorMode || !creatorId) return;
    if (demoCreatorMode) {
      setSettings(readDemoProfileVisibility(creatorId));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("creator_profile_visibility")
        .select("*")
        .eq("creator_id", creatorId)
        .maybeSingle();
      if (!cancelled) {
        setSettings(profileVisibilityFromDatabase(data as Record<string, unknown> | null));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorId, creatorMode, demoCreatorMode]);

  if (!creatorMode || !creatorId || !creatorUsername) return null;

  const persist = async (next: CreatorProfileVisibility) => {
    const previous = settings;
    setSettings(next);
    setSaving(true);
    if (demoCreatorMode) {
      writeDemoProfileVisibility(creatorId, next);
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("creator_profile_visibility")
      .upsert(profileVisibilityToDatabase(creatorId, next));
    setSaving(false);
    if (error) {
      setSettings(previous);
      toast.error(
        tr("Não foi possível atualizar o perfil público.", "Couldn't update the public profile."),
      );
      return;
    }
    window.dispatchEvent(
      new CustomEvent(CREATOR_PROFILE_VISIBILITY_CHANGED_EVENT, {
        detail: { creatorId },
      }),
    );
  };

  const setVisibility = (key: VisibilityKey, checked: boolean) => {
    void persist({ ...settings, [key]: checked });
  };

  const addBlockedState = () => {
    if (!selectedState || settings.blockedStates.includes(selectedState)) return;
    void persist({
      ...settings,
      blockedStates: [...settings.blockedStates, selectedState].sort(),
    });
    setSelectedState("");
  };

  const removeBlockedState = (stateCode: BrazilStateCode) => {
    void persist({
      ...settings,
      blockedStates: settings.blockedStates.filter((item) => item !== stateCode),
    });
  };

  return (
    <div className="mt-8 space-y-5">
      <Card className="border-primary/25 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Eye className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {tr("Visibilidade do perfil público", "Public profile visibility")}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {tr(
                  "Cada alteração é aplicada imediatamente ao perfil da modelo.",
                  "Every change is applied to the creator profile immediately.",
                )}
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" /> @{creatorUsername}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/profile/$username" params={{ username: creatorUsername }}>
              {tr("Ver perfil público", "View public profile")}
            </Link>
          </Button>
        </div>
        {loading ? (
          <p className="mt-5 text-sm text-muted-foreground">
            {tr("Carregando controles...", "Loading controls...")}
          </p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {VISIBILITY_OPTIONS.map((option) => {
              const checked = settings[option.key];
              return (
                <label
                  key={option.key}
                  className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-background p-3.5"
                >
                  <span className="flex min-w-0 gap-2.5">
                    {checked ? (
                      <Eye className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      <strong className="block text-sm text-foreground">
                        {tr(option.pt, option.en)}
                      </strong>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {tr(option.descriptionPt, option.descriptionEn)}
                      </span>
                    </span>
                  </span>
                  <Switch
                    checked={checked}
                    onCheckedChange={(value) => setVisibility(option.key, value)}
                    disabled={saving}
                    aria-label={tr(option.pt, option.en)}
                  />
                </label>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {saving
            ? tr("Atualizando perfil público...", "Updating public profile...")
            : tr("Alterações sincronizadas.", "Changes synced.")}
        </p>
      </Card>

      <Card className="border-amber-500/25 p-5">
        <div className="flex gap-3">
          <span className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
            <MapPinOff className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {tr("Bloqueio por estado", "State blocking")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {tr(
                "Usuários logados cujo estado cadastrado esteja bloqueado não poderão abrir este perfil nem suas publicações. O próprio perfil e administradores continuam com acesso.",
                "Signed-in users whose registered state is blocked cannot open this profile or its posts. The profile owner and administrators keep access.",
              )}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Select
            value={selectedState}
            onValueChange={(value) => setSelectedState(value as BrazilStateCode)}
          >
            <SelectTrigger className="sm:max-w-sm">
              <SelectValue placeholder={tr("Selecione um estado", "Select a state")} />
            </SelectTrigger>
            <SelectContent>
              {BRAZIL_STATES.filter(([code]) => !settings.blockedStates.includes(code)).map(
                ([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {code} — {name}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={addBlockedState}
            disabled={!selectedState || saving}
          >
            {tr("Bloquear estado", "Block state")}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {settings.blockedStates.length ? (
            settings.blockedStates.map((stateCode) => {
              const stateName = BRAZIL_STATES.find(([code]) => code === stateCode)?.[1];
              return (
                <Badge key={stateCode} variant="secondary" className="gap-1.5 py-1.5">
                  {stateCode} — {stateName}
                  <button
                    type="button"
                    onClick={() => removeBlockedState(stateCode)}
                    aria-label={tr(`Liberar ${stateCode}`, `Allow ${stateCode}`)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground">
              {tr("Nenhum estado bloqueado.", "No blocked states.")}
            </p>
          )}
        </div>
        <p className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          {tr(
            "Esta primeira versão usa o estado cadastrado na conta. Geolocalização por IP poderá ser adicionada depois como camada complementar, sem substituir a verificação da conta.",
            "This first version uses the state registered on the account. IP geolocation can be added later as an additional layer without replacing account verification.",
          )}
        </p>
      </Card>
    </div>
  );
}

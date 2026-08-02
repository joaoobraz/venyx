import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreatorWatermark, type WatermarkPosition } from "@/components/CreatorWatermark";
import { Switch } from "@/components/ui/switch";
import { Gift } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trackProductEvent } from "@/lib/telemetry";

export const Route = createFileRoute("/settings/profile")({
  component: SettingsProfile,
});

function SettingsProfile() {
  const { user, profile, isCreator, refresh, loading } = useAuth();
  const { t, tr } = useI18n();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [wmPosition, setWmPosition] = useState<WatermarkPosition>("bottom-right");
  const [wmOpacity, setWmOpacity] = useState(0.6);
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialDays, setTrialDays] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      const p = (profile as unknown as {
        watermark_position?: string;
        watermark_opacity?: number;
        trial_days_enabled?: boolean;
        trial_days?: number;
      });
      if (p.watermark_position) setWmPosition(p.watermark_position as WatermarkPosition);
      if (typeof p.watermark_opacity === "number") setWmOpacity(p.watermark_opacity);
      if (typeof p.trial_days_enabled === "boolean") setTrialEnabled(p.trial_days_enabled);
      if (typeof p.trial_days === "number") setTrialDays(p.trial_days);
    }
  }, [profile]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio,
        watermark_position: wmPosition,
        watermark_opacity: wmOpacity,
        trial_days_enabled: trialEnabled,
        trial_days: Math.max(1, Math.min(14, trialDays)),
      } as never)
      .eq("user_id", profile.user_id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      if (displayName.trim().length >= 2 && bio.trim().length >= 20) {
        trackProductEvent("profile_completed", { creator: isCreator });
      }
      toast.success(tr("Perfil atualizado!", "Profile updated!"));
      await refresh();
    }
  };

  if (!user || !profile) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-foreground">{tr("Editar perfil", "Edit profile")}</h1>
        <form onSubmit={onSave} className="mt-6 space-y-4">
          <div>
            <Label>Username</Label>
            <Input value={profile.username} disabled className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="dn">{tr("Nome de exibição", "Display name")}</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1.5" />
          </div>

          <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
            <div>
              <Label className="text-base">{tr("Marca d'água nas suas mídias", "Watermark on your media")}</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr(
                  "Aplicada automaticamente em todas as suas fotos e vídeos. Formato:",
                  "Automatically applied to all your photos and videos. Format:",
                )}{" "}
                <span className="font-mono">Venyx.com.br/profile/{profile.username}</span>
              </p>
            </div>

            <div>
              <Label className="text-sm">{tr("Posição", "Position")}</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([
                  ["top-left", "↖"],
                  ["", ""],
                  ["top-right", "↗"],
                  ["", ""],
                  ["center", "•"],
                  ["", ""],
                  ["bottom-left", "↙"],
                  ["", ""],
                  ["bottom-right", "↘"],
                ] as const).map(([pos, icon], i) =>
                  pos ? (
                    <button
                      type="button"
                      key={pos}
                      onClick={() => setWmPosition(pos as WatermarkPosition)}
                      className={`flex h-12 items-center justify-center rounded-md border text-lg transition ${
                        wmPosition === pos
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 hover:border-primary/40"
                      }`}
                    >
                      {icon}
                    </button>
                  ) : (
                    <div key={`empty-${i}`} className="h-12" />
                  ),
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="wmop" className="text-sm">
                {tr("Opacidade", "Opacity")}: {Math.round(wmOpacity * 100)}%
              </Label>
              <input
                id="wmop"
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
              />
            </div>

            <div>
              <Label className="text-sm">{tr("Pré-visualização", "Preview")}</Label>
              <div className="mt-2 overflow-hidden rounded-md">
                <CreatorWatermark username={profile.username} position={wmPosition} opacity={wmOpacity}>
                  <div className="aspect-video w-full bg-gradient-to-br from-primary/30 via-accent/20 to-muted" />
                </CreatorWatermark>
              </div>
            </div>
          </div>

          {isCreator && (
            <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="flex items-center gap-2 text-base">
                    <Gift className="h-4 w-4 text-accent" /> {tr("Teste grátis", "Free trial")}
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tr(
                      "Ofereça alguns dias grátis para novos assinantes (1 teste por pessoa).",
                      "Offer a few free days to new subscribers (one trial per person).",
                    )}
                  </p>
                </div>
                <Switch checked={trialEnabled} onCheckedChange={setTrialEnabled} />
              </div>
              {trialEnabled && (
                <div>
                  <Label htmlFor="td" className="text-sm">
                    {tr("Dias de teste", "Trial days")}: {trialDays}
                  </Label>
                  <input
                    id="td"
                    type="range"
                    min={1}
                    max={14}
                    step={1}
                    value={trialDays}
                    onChange={(e) => setTrialDays(Number(e.target.value))}
                    className="mt-2 w-full accent-accent"
                  />
                </div>
              )}
            </div>
          )}

          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? tr("Salvando...", "Saving...") : t("common.save")}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

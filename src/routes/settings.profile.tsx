import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
import { Camera, Gift } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trackProductEvent } from "@/lib/telemetry";
import { CreatorProfileVisibilitySettings } from "@/components/CreatorProfileVisibilitySettings";
import { DEMO_MODE, getDemoCreator } from "@/lib/demo-creators";

export const Route = createFileRoute("/settings/profile")({
  component: SettingsProfile,
});

export function SettingsProfile() {
  const { user, profile, isCreator, demoPreviewRole, refresh, loading } = useAuth();
  const { t, tr } = useI18n();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [wmPosition, setWmPosition] = useState<WatermarkPosition>("bottom-right");
  const [wmOpacity, setWmOpacity] = useState(0.6);
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialDays, setTrialDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const demoCreatorMode = demoPreviewRole === "creator";
  const creatorMode = isCreator || demoCreatorMode;
  const showCreatorControls = creatorMode || DEMO_MODE;
  const demoCreator = demoCreatorMode ? getDemoCreator("aline") : null;
  const displayedUsername = demoCreator?.username ?? username;
  const usernameCooldownEndsAt = profile?.username_changed_at
    ? new Date(new Date(profile.username_changed_at).getTime() + 14 * 24 * 60 * 60 * 1000)
    : null;
  const usernameOnCooldown = Boolean(
    usernameCooldownEndsAt && usernameCooldownEndsAt.getTime() > Date.now(),
  );

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (profile) {
      setUsername(demoCreator?.username ?? profile.username ?? "");
      setDisplayName(demoCreator?.display_name ?? profile.display_name ?? "");
      setBio(demoCreator?.bio ?? profile.bio ?? "");
      setAvatarUrl(demoCreator?.avatar_url ?? profile.avatar_url ?? null);
      setCoverUrl(profile.cover_url ?? null);
      const p = profile as unknown as {
        watermark_position?: string;
        watermark_opacity?: number;
        trial_days_enabled?: boolean;
        trial_days?: number;
      };
      if (p.watermark_position) setWmPosition(p.watermark_position as WatermarkPosition);
      if (typeof p.watermark_opacity === "number") setWmOpacity(p.watermark_opacity);
      if (typeof p.trial_days_enabled === "boolean") setTrialEnabled(p.trial_days_enabled);
      if (typeof p.trial_days === "number") setTrialDays(p.trial_days);
    }
  }, [demoCreator, profile]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (demoCreatorMode) {
      toast.info(
        tr(
          "A identidade de Aline é demonstrativa. Os controles de visibilidade abaixo funcionam nesta prévia.",
          "Aline's identity is a demo. The visibility controls below work in this preview.",
        ),
      );
      return;
    }
    const normalizedUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!/^(?=.{3,30}$)[a-z0-9]+(?:[._][a-z0-9]+)*$/.test(normalizedUsername)) {
      toast.error(
        tr(
          "O nome de usuário deve ter de 3 a 30 caracteres e usar apenas letras, números, ponto ou sublinhado.",
          "The username must be 3 to 30 characters and use only letters, numbers, dots, or underscores.",
        ),
      );
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: normalizedUsername,
        display_name: displayName,
        bio,
        watermark_position: wmPosition,
        watermark_opacity: wmOpacity,
        trial_days_enabled: trialEnabled,
        trial_days: Math.max(1, Math.min(14, trialDays)),
      } as never)
      .eq("user_id", profile.user_id);
    setSaving(false);
    if (error) {
      const message = `${error.code ?? ""} ${error.message ?? ""}`;
      if (message.includes("USERNAME_CHANGE_COOLDOWN")) {
        toast.error(
          tr(
            "Você já alterou seu nome de usuário. A próxima troca estará disponível 14 dias após a última alteração.",
            "You already changed your username. The next change will be available 14 days after the last one.",
          ),
        );
      } else if (error.code === "23505" || message.toLowerCase().includes("duplicate")) {
        toast.error(tr("Esse nome de usuário já está em uso.", "This username is already in use."));
      } else if (message.includes("USERNAME_INVALID") || error.code === "22023") {
        toast.error(tr("Esse nome de usuário não é válido.", "This username is not valid."));
      } else {
        toast.error(error.message);
      }
    }
    else {
      setUsername(normalizedUsername);
      if (displayName.trim().length >= 2 && bio.trim().length >= 20) {
        trackProductEvent("profile_completed", { creator: isCreator });
      }
      toast.success(tr("Perfil atualizado!", "Profile updated!"));
      await refresh();
    }
  };

  const uploadImage = async (
    e: ChangeEvent<HTMLInputElement>,
    bucket: "avatars" | "covers",
    column: "avatar_url" | "cover_url",
    setUploading: (v: boolean) => void,
    setUrl: (url: string) => void,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || !profile) return;
    if (demoCreatorMode) {
      toast.info(
        tr("A identidade de Aline é demonstrativa; upload desativado nesta prévia.", "Aline's identity is a demo; upload disabled in this preview."),
      );
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(tr("Apenas imagens", "Images only"));
      return;
    }
    const maxSize = bucket === "avatars" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(tr(`Máximo de ${maxSize / (1024 * 1024)} MB`, `Maximum size is ${maxSize / (1024 * 1024)} MB`));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ [column]: pub.publicUrl } as never)
        .eq("user_id", profile.user_id);
      if (updateError) throw updateError;
      setUrl(pub.publicUrl);
      toast.success(tr("Foto atualizada!", "Photo updated!"));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Erro no envio", "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  if (!user || !profile) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-foreground">
            {tr("Editar perfil", "Edit profile")}
          </h1>
          {demoCreatorMode && (
            <p className="mt-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm text-muted-foreground">
              {tr(
                "Modo modelo ativo: você está configurando o perfil público de Aline (@aline), sem misturar dados de joaobraz.",
                "Creator mode active: you are configuring Aline's public profile (@aline), without mixing joaobraz data.",
              )}
            </p>
          )}

          <div className="mt-6 space-y-3">
            <div className="relative h-32 overflow-hidden rounded-xl bg-muted">
              {coverUrl && (
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => uploadImage(e, "covers", "cover_url", setUploadingCover, setCoverUrl)}
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur hover:bg-background"
              >
                <Camera className="h-3.5 w-3.5" />
                {uploadingCover
                  ? tr("Enviando...", "Uploading...")
                  : tr("Alterar capa", "Change cover")}
              </button>
            </div>

            <div className="-mt-10 flex items-end gap-3 pl-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                    {(displayName || displayedUsername || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => uploadImage(e, "avatars", "avatar_url", setUploadingAvatar, setAvatarUrl)}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100"
                  aria-label={tr("Alterar foto de perfil", "Change profile photo")}
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              <p className="pb-1 text-xs text-muted-foreground">
                {uploadingAvatar
                  ? tr("Enviando foto de perfil...", "Uploading profile photo...")
                  : tr("Passe o mouse na foto para trocar", "Hover the photo to change it")}
              </p>
            </div>
          </div>

          <form onSubmit={onSave} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="username">{tr("Nome de usuário", "Username")}</Label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  id="username"
                  value={displayedUsername}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                  disabled={demoCreatorMode || usernameOnCooldown}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="pl-7"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {usernameOnCooldown && usernameCooldownEndsAt
                  ? tr(
                      `Você poderá trocar novamente em ${usernameCooldownEndsAt.toLocaleDateString("pt-BR")}.`,
                      `You can change it again on ${usernameCooldownEndsAt.toLocaleDateString("en-US")}.`,
                    )
                  : tr(
                      "Escolha seu nome de usuário com cuidado. Depois de salvar, a próxima troca só poderá ser feita após 14 dias.",
                      "Choose your username carefully. After saving, the next change will only be available after 14 days.",
                    )}
              </p>
            </div>
            <div>
              <Label htmlFor="dn">{tr("Nome de exibição", "Display name")}</Label>
              <Input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
              <div>
                <Label className="text-base">
                  {tr("Marca d'água nas suas mídias", "Watermark on your media")}
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tr(
                    "Aplicada automaticamente em todas as suas fotos e vídeos. Formato:",
                    "Automatically applied to all your photos and videos. Format:",
                  )}{" "}
                  <span className="font-mono">Fanlira.com.br/profile/{displayedUsername}</span>
                </p>
              </div>

              <div>
                <Label className="text-sm">{tr("Posição", "Position")}</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["top-left", "↖"],
                      ["", ""],
                      ["top-right", "↗"],
                      ["", ""],
                      ["center", "•"],
                      ["", ""],
                      ["bottom-left", "↙"],
                      ["", ""],
                      ["bottom-right", "↘"],
                    ] as const
                  ).map(([pos, icon], i) =>
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
                  <CreatorWatermark
                    username={displayedUsername}
                    position={wmPosition}
                    opacity={wmOpacity}
                  >
                    <div className="aspect-video w-full bg-gradient-to-br from-primary/30 via-accent/20 to-muted" />
                  </CreatorWatermark>
                </div>
              </div>
            </div>

            {creatorMode && (
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

            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? tr("Salvando...", "Saving...") : t("common.save")}
            </Button>
          </form>
        </div>
        {showCreatorControls && <CreatorProfileVisibilitySettings />}
      </div>
    </AppShell>
  );
}

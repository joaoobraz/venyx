import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { ImagePlus, X, DollarSign, Lock, Globe, Loader2, Target, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CaptionSuggest } from "@/components/CaptionSuggest";
import { moderateBeforeUpload } from "@/lib/moderation";
import { useI18n } from "@/lib/i18n";
import { trackProductEvent } from "@/lib/telemetry";

export const Route = createFileRoute("/creator/posts")({
  component: CreatorPostsPage,
});

type Visibility = "public" | "subscribers" | "ppv" | "goal";
type MediaDraft = {
  id: string;
  file: File;
  coverFile?: File;
};

function CreatorPostsPage() {
  const { tr } = useI18n();
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();
  const [body, setBody] = useState("");
  const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [priceReais, setPriceReais] = useState("");
  const [goalTargetReais, setGoalTargetReais] = useState("");
  const [goalUnlockReais, setGoalUnlockReais] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!isCreator) nav({ to: "/become-creator" });
  }, [user, isCreator, loading, nav]);

  if (!isCreator || !user) return null;

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []).slice(0, 6);
    setMediaDrafts((current) =>
      [
        ...current,
        ...list.map((file) => ({ id: crypto.randomUUID(), file })),
      ].slice(0, 6),
    );
    e.target.value = "";
  };

  const removeFile = (id: string) =>
    setMediaDrafts((current) => current.filter((draft) => draft.id !== id));

  const setVideoCover = (id: string, coverFile?: File) =>
    setMediaDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, coverFile } : draft)),
    );

  const submit = async () => {
    if (!body.trim() && mediaDrafts.length === 0) {
      toast.error(tr("Adicione texto ou mídia", "Add text or media"));
      return;
    }
    if (mediaDrafts.some((draft) => draft.file.type.startsWith("video/") && !draft.coverFile)) {
      toast.error(tr("Escolha uma capa para cada vídeo antes de publicar.", "Choose a cover for every video before publishing."));
      return;
    }
    const priceCents = visibility === "ppv" ? Math.round(parseFloat(priceReais || "0") * 100) : 0;
    if (visibility === "ppv" && priceCents < 100) {
      toast.error(tr("Preço mínimo PPV: R$ 1,00", "Minimum PPV price: R$ 1.00"));
      return;
    }

    const goalTargetCents = Math.round(parseFloat(goalTargetReais || "0") * 100);
    const goalUnlockCents = Math.round(parseFloat(goalUnlockReais || "0") * 100);
    if (visibility === "goal") {
      if (goalTargetCents < 100) {
        toast.error(tr("Meta mínima: R$ 1,00", "Minimum goal: R$ 1.00"));
        return;
      }
      if (goalUnlockCents < 100) {
        toast.error(tr("Contribuição mínima: R$ 1,00", "Minimum contribution: R$ 1.00"));
        return;
      }
    }

    setSubmitting(true);
    try {
      // Moderação prévia: bloqueia CSAM em qualquer mídia
      for (const draft of mediaDrafts) {
        const mod = await moderateBeforeUpload(draft.file, "post", user.id);
        if (!mod.allowed) {
          trackProductEvent("moderation_failed", { flow: "post", target: "media" });
          toast.error(`${tr("Upload bloqueado", "Upload blocked")}: ${mod.reason || tr("violação de política", "policy violation")}`);
          setSubmitting(false);
          return;
        }
        if (draft.coverFile) {
          const coverMod = await moderateBeforeUpload(draft.coverFile, "post", user.id);
          if (!coverMod.allowed) {
            trackProductEvent("moderation_failed", { flow: "post", target: "cover" });
            toast.error(`${tr("Capa bloqueada", "Cover blocked")}: ${coverMod.reason || tr("violação de política", "policy violation")}`);
            setSubmitting(false);
            return;
          }
        }
      }

      const { data: post, error: pe } = await supabase
        .from("posts")
        .insert({
          creator_id: user.id,
          body: body.trim() || null,
          visibility,
          price_cents: priceCents,
        })
        .select()
        .single();
      if (pe || !post) throw pe ?? new Error(tr("Falha ao criar post", "Couldn't create post"));

      if (visibility === "goal") {
        const { error: ge } = await supabase.from("post_goals").insert({
          post_id: post.id,
          target_cents: goalTargetCents,
          unlock_price_cents: goalUnlockCents,
        });
        if (ge) throw ge;
      }

      // upload mídia
      for (let i = 0; i < mediaDrafts.length; i++) {
        const { file: f, coverFile } = mediaDrafts[i];
        const ext = f.name.split(".").pop() || "bin";
        const path = `${user.id}/${post.id}/${i}.${ext}`;
        const { error: ue } = await supabase.storage.from("posts").upload(path, f, {
          upsert: false,
          contentType: f.type,
        });
        if (ue) throw ue;
        let coverPath: string | null = null;
        if (coverFile) {
          const coverExt = coverFile.name.split(".").pop() || "jpg";
          coverPath = `${user.id}/${post.id}/${i}-cover.${coverExt}`;
          const { error: coverUploadError } = await supabase.storage
            .from("posts")
            .upload(coverPath, coverFile, {
              upsert: false,
              contentType: coverFile.type,
            });
          if (coverUploadError) throw coverUploadError;
        }

        const mediaPayload = {
          post_id: post.id,
          storage_path: path,
          cover_storage_path: coverPath,
          mime_type: f.type,
          position: i,
        };
        let { error: me } = await supabase.from("post_media").insert(mediaPayload);
        if (me && coverPath) {
          // Temporary compatibility while the cover column is not yet applied in staging.
          const fallback = await supabase.from("post_media").insert({
            post_id: post.id,
            storage_path: path,
            mime_type: f.type,
            position: i,
          });
          me = fallback.error;
        }
        if (me) throw me;
      }

      toast.success(tr("Post publicado!", "Post published!"));
      setBody("");
      setMediaDrafts([]);
      setVisibility("public");
      setPriceReais("");
      setGoalTargetReais("");
      setGoalUnlockReais("");
      nav({ to: "/feed" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Erro ao publicar", "Couldn't publish"));
    } finally {
      setSubmitting(false);
    }
  };

  const uploadStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setSubmitting(true);
    try {
      const mod = await moderateBeforeUpload(f, "story", user.id);
      if (!mod.allowed) {
        trackProductEvent("moderation_failed", { flow: "story", target: "media" });
        toast.error(`${tr("Upload bloqueado", "Upload blocked")}: ${mod.reason || tr("violação de política", "policy violation")}`);
        setSubmitting(false);
        return;
      }
      const ext = f.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from("stories").upload(path, f, { contentType: f.type });
      if (ue) throw ue;
      const { error: ie } = await supabase.from("stories").insert({
        creator_id: user.id,
        media_path: path,
        mime_type: f.type,
        visibility: "public",
      });
      if (ie) throw ie;
      toast.success(tr("Story publicado! Expira em 24h.", "Story published! It expires in 24 hours."));
      nav({ to: "/feed" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Erro", "Error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{tr("Novo post", "New post")}</h1>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-95">
            <Zap className="h-3.5 w-3.5" /> {tr("Postar Story 24h", "Post 24h Story")}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={uploadStory} disabled={submitting} />
          </label>
        </div>

        <div className="space-y-3 rounded-2xl bg-card p-4">
          <Textarea
            placeholder={tr("Compartilhe algo com seus assinantes...", "Share something with your subscribers...")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-28 resize-none border-0 bg-background/50 text-base"
            maxLength={2000}
          />

          <CaptionSuggest hint={body} onPick={(c) => setBody(c)} />

          {mediaDrafts.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {mediaDrafts.map((draft) => (
                <MediaDraftCard
                  key={draft.id}
                  draft={draft}
                  onRemove={() => removeFile(draft.id)}
                  onCoverChange={(coverFile) => setVideoCover(draft.id, coverFile)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs text-foreground hover:bg-background/70">
              <ImagePlus className="h-4 w-4 text-primary" />
              {tr("Adicionar mídia", "Add media")}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={onFiles}
                className="hidden"
              />
            </label>

            <div className="ml-auto flex gap-1 rounded-full bg-background p-1">
              <VisBtn active={visibility === "public"} onClick={() => setVisibility("public")} icon={<Globe className="h-3.5 w-3.5" />} label={tr("Público", "Public")} />
              <VisBtn active={visibility === "subscribers"} onClick={() => setVisibility("subscribers")} icon={<Lock className="h-3.5 w-3.5" />} label={tr("Assinantes", "Subscribers")} />
              <VisBtn active={visibility === "ppv"} onClick={() => setVisibility("ppv")} icon={<DollarSign className="h-3.5 w-3.5" />} label="PPV" />
              <VisBtn active={visibility === "goal"} onClick={() => setVisibility("goal")} icon={<Target className="h-3.5 w-3.5" />} label={tr("Meta", "Goal")} />
            </div>
          </div>

          {visibility === "ppv" && (
            <div className="flex items-center gap-2 rounded-xl bg-background p-3">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{tr("Preço fixo (R$)", "Fixed price (R$)")}</span>
              <Input
                type="number"
                step="0.50"
                min="1"
                placeholder="19,90"
                value={priceReais}
                onChange={(e) => setPriceReais(e.target.value)}
                className="ml-auto h-8 w-28 border-0 bg-card text-right"
              />
            </div>
          )}

          {visibility === "goal" && (
            <div className="space-y-2 rounded-xl bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="h-4 w-4 text-accent" />
                {tr("Meta coletiva — várias pessoas contribuem para liberar", "Collective goal — several people contribute to unlock")}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{tr("Meta total (R$)", "Total goal (R$)")}</span>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="500,00"
                  value={goalTargetReais}
                  onChange={(e) => setGoalTargetReais(e.target.value)}
                  className="ml-auto h-8 w-28 border-0 bg-card text-right"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{tr("Cada contribuição (R$)", "Each contribution (R$)")}</span>
                <Input
                  type="number"
                  step="0.50"
                  min="1"
                  placeholder="9,90"
                  value={goalUnlockReais}
                  onChange={(e) => setGoalUnlockReais(e.target.value)}
                  className="ml-auto h-8 w-28 border-0 bg-card text-right"
                />
              </div>
            </div>
          )}

          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Publicar", "Publish")}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function MediaDraftCard({
  draft,
  onRemove,
  onCoverChange,
}: {
  draft: MediaDraft;
  onRemove: () => void;
  onCoverChange: (file?: File) => void;
}) {
  const { tr } = useI18n();
  const isVideo = draft.file.type.startsWith("video/");
  const previewFile = draft.coverFile ?? draft.file;
  const previewUrl = useMemo(() => URL.createObjectURL(previewFile), [previewFile]);

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
      {isVideo && !draft.coverFile ? (
        <video src={previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : (
        <img src={previewUrl} alt="" className="h-full w-full object-cover" />
      )}
      <button
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
        type="button"
        aria-label={tr("Remover mídia", "Remove media")}
      >
        <X className="h-3 w-3" />
      </button>
      {isVideo && (
        <label className="absolute inset-x-1 bottom-1 cursor-pointer rounded-md bg-black/75 px-2 py-1.5 text-center text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-black/90">
          {draft.coverFile ? tr("Trocar capa", "Change cover") : tr("Escolher capa", "Choose cover")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              onCoverChange(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

function VisBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

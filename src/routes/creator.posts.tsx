import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
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

export const Route = createFileRoute("/creator/posts")({
  component: CreatorPostsPage,
});

type Visibility = "public" | "subscribers" | "ppv" | "goal";

function CreatorPostsPage() {
  const { user, isCreator, loading } = useAuth();
  const nav = useNavigate();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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
    setFiles((prev) => [...prev, ...list].slice(0, 6));
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!body.trim() && files.length === 0) {
      toast.error("Adicione texto ou mídia");
      return;
    }
    const priceCents = visibility === "ppv" ? Math.round(parseFloat(priceReais || "0") * 100) : 0;
    if (visibility === "ppv" && priceCents < 100) {
      toast.error("Preço mínimo PPV: R$ 1,00");
      return;
    }

    const goalTargetCents = Math.round(parseFloat(goalTargetReais || "0") * 100);
    const goalUnlockCents = Math.round(parseFloat(goalUnlockReais || "0") * 100);
    if (visibility === "goal") {
      if (goalTargetCents < 100) {
        toast.error("Meta mínima: R$ 1,00");
        return;
      }
      if (goalUnlockCents < 100) {
        toast.error("Contribuição mínima: R$ 1,00");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Moderação prévia: bloqueia CSAM em qualquer mídia
      for (const f of files) {
        const mod = await moderateBeforeUpload(f, "post", user.id);
        if (!mod.allowed) {
          toast.error(`Upload bloqueado: ${mod.reason || "violação de política"}`);
          setSubmitting(false);
          return;
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
      if (pe || !post) throw pe ?? new Error("Falha ao criar post");

      if (visibility === "goal") {
        const { error: ge } = await supabase.from("post_goals").insert({
          post_id: post.id,
          target_cents: goalTargetCents,
          unlock_price_cents: goalUnlockCents,
        });
        if (ge) throw ge;
      }

      // upload mídia
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.name.split(".").pop() || "bin";
        const path = `${user.id}/${post.id}/${i}.${ext}`;
        const { error: ue } = await supabase.storage.from("posts").upload(path, f, {
          upsert: false,
          contentType: f.type,
        });
        if (ue) throw ue;
        const { error: me } = await supabase.from("post_media").insert({
          post_id: post.id,
          storage_path: path,
          mime_type: f.type,
          position: i,
        });
        if (me) throw me;
      }

      toast.success("Post publicado!");
      setBody("");
      setFiles([]);
      setVisibility("public");
      setPriceReais("");
      setGoalTargetReais("");
      setGoalUnlockReais("");
      nav({ to: "/feed" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
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
        toast.error(`Upload bloqueado: ${mod.reason || "violação de política"}`);
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
      toast.success("Story publicado! Expira em 24h.");
      nav({ to: "/feed" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Novo post</h1>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-95">
            <Zap className="h-3.5 w-3.5" /> Postar Story 24h
            <input type="file" accept="image/*,video/*" className="hidden" onChange={uploadStory} disabled={submitting} />
          </label>
        </div>

        <div className="space-y-3 rounded-2xl bg-card p-4">
          <Textarea
            placeholder="Compartilhe algo com seus assinantes..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-28 resize-none border-0 bg-background/50 text-base"
            maxLength={2000}
          />

          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {f.type.startsWith("image/") ? (
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={URL.createObjectURL(f)} className="h-full w-full object-cover" />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs text-foreground hover:bg-background/70">
              <ImagePlus className="h-4 w-4 text-primary" />
              Adicionar mídia
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={onFiles}
                className="hidden"
              />
            </label>

            <div className="ml-auto flex gap-1 rounded-full bg-background p-1">
              <VisBtn active={visibility === "public"} onClick={() => setVisibility("public")} icon={<Globe className="h-3.5 w-3.5" />} label="Público" />
              <VisBtn active={visibility === "subscribers"} onClick={() => setVisibility("subscribers")} icon={<Lock className="h-3.5 w-3.5" />} label="Assinantes" />
              <VisBtn active={visibility === "ppv"} onClick={() => setVisibility("ppv")} icon={<DollarSign className="h-3.5 w-3.5" />} label="PPV" />
              <VisBtn active={visibility === "goal"} onClick={() => setVisibility("goal")} icon={<Target className="h-3.5 w-3.5" />} label="Meta" />
            </div>
          </div>

          {visibility === "ppv" && (
            <div className="flex items-center gap-2 rounded-xl bg-background p-3">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Preço fixo (R$)</span>
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
                Meta coletiva — várias pessoas contribuem para liberar
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Meta total (R$)</span>
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
                <span className="text-xs text-muted-foreground">Cada contribuição (R$)</span>
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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
          </Button>
        </div>
      </div>
    </AppShell>
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

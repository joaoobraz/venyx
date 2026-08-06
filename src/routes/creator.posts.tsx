import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  ImagePlus,
  X,
  DollarSign,
  Lock,
  Globe,
  Loader2,
  Pin,
  PinOff,
  Target,
  Video,
  Zap,
} from "lucide-react";
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
import { DEMO_MODE } from "@/lib/demo-creators";
import { createDemoId, updateDemoOperations } from "@/lib/demo-operations";
import { fetchPosts } from "@/lib/posts";
import type { PostWithRelations } from "@/components/PostCard";
import { setPinnedPostForCreator } from "@/lib/post-pinning";

export const Route = createFileRoute("/creator/posts")({
  component: CreatorPostsPage,
});

type Visibility = "public" | "subscribers" | "ppv" | "goal";
type PostFormat = "text" | "image" | "video";
type MediaDraft = {
  id: string;
  file: File;
  coverFile?: File;
};

export function CreatorPostsPage() {
  const { tr } = useI18n();
  const { user, profile, isCreator, loading, demoPreviewRole } = useAuth();
  const nav = useNavigate();
  const [body, setBody] = useState("");
  const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([]);
  const [postFormat, setPostFormat] = useState<PostFormat>("text");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [pinOnProfile, setPinOnProfile] = useState(false);
  const [priceReais, setPriceReais] = useState("");
  const [goalTargetReais, setGoalTargetReais] = useState("");
  const [goalUnlockReais, setGoalUnlockReais] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [creatorPosts, setCreatorPosts] = useState<PostWithRelations[]>([]);
  const demoCreatorMode = demoPreviewRole === "creator";
  const canPublish = isCreator || demoCreatorMode;
  const creatorId = demoCreatorMode ? "demo-aline" : user?.id;

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (!canPublish) nav({ to: "/become-creator" });
  }, [user, canPublish, loading, nav]);

  const loadCreatorPosts = useCallback(async () => {
    if (!user || !creatorId) return;
    const posts = await fetchPosts({
      creatorId,
      viewerId: user.id,
      limit: 50,
    });
    setCreatorPosts(posts);
  }, [creatorId, user]);

  useEffect(() => {
    if (!canPublish) return;
    void loadCreatorPosts();
  }, [canPublish, loadCreatorPosts]);

  if (!canPublish || !user || !creatorId) return null;

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const expectedPrefix = postFormat === "video" ? "video/" : "image/";
    const list = Array.from(e.target.files ?? [])
      .filter((file) => file.type.startsWith(expectedPrefix))
      .slice(0, 6);
    if (list.length === 0) {
      toast.error(
        postFormat === "video"
          ? tr("Escolha um arquivo de vídeo.", "Choose a video file.")
          : tr("Escolha uma imagem.", "Choose an image."),
      );
      e.target.value = "";
      return;
    }
    setMediaDrafts((current) =>
      [
        ...current,
        ...list.map((file) => ({ id: crypto.randomUUID(), file })),
      ].slice(0, 6),
    );
    e.target.value = "";
  };

  const selectPostFormat = (format: PostFormat) => {
    setPostFormat(format);
    setMediaDrafts([]);
  };

  const removeFile = (id: string) =>
    setMediaDrafts((current) => current.filter((draft) => draft.id !== id));

  const setVideoCover = (id: string, coverFile?: File) =>
    setMediaDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, coverFile } : draft)),
    );

  const submit = async () => {
    if (postFormat === "text" && !body.trim()) {
      toast.error(tr("Escreva o texto da publicação.", "Write the post text."));
      return;
    }
    if (postFormat !== "text" && mediaDrafts.length === 0) {
      toast.error(
        postFormat === "video"
          ? tr("Adicione um vídeo.", "Add a video.")
          : tr("Adicione uma foto.", "Add a photo."),
      );
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
      // A demonstração não envia arquivos; a moderação remota continua obrigatória em produção.
      if (!(DEMO_MODE && demoCreatorMode)) {
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
      }

      if (DEMO_MODE && demoCreatorMode) {
        const postId = createDemoId("post");
        const mediaUrl = mediaDrafts[0]?.file
          ? URL.createObjectURL(mediaDrafts[0].file)
          : null;
        const fallbackTitle =
          postFormat === "video"
            ? tr("Novo vídeo", "New video")
            : postFormat === "image"
              ? tr("Nova foto", "New photo")
              : tr("Nova publicação", "New post");
        updateDemoOperations(user.id, (state) => ({
          ...state,
          pinnedPostId: pinOnProfile ? postId : state.pinnedPostId,
          creatorPosts: [
            {
              id: postId,
              title: body.trim() || fallbackTitle,
              body: body.trim() || null,
              visibility,
              price_cents: priceCents,
              goal_target_cents: visibility === "goal" ? goalTargetCents : undefined,
              goal_min_contribution_cents:
                visibility === "goal" ? goalUnlockCents : undefined,
              goal_raised_cents: visibility === "goal" ? 0 : undefined,
              media_kind: postFormat,
              media_url: mediaUrl,
              status: "published",
              views: 0,
              created_at: new Date().toISOString(),
            },
            ...state.creatorPosts,
          ],
        }));
        toast.success(
          pinOnProfile
            ? tr("Post publicado e fixado no perfil!", "Post published and pinned!")
            : tr("Post publicado!", "Post published!"),
        );
        setBody("");
        setMediaDrafts([]);
        setPostFormat("text");
        setVisibility("public");
        setPinOnProfile(false);
        setPriceReais("");
        setGoalTargetReais("");
        setGoalUnlockReais("");
        await loadCreatorPosts();
        nav({ to: "/profile/$username", params: { username: "aline" } });
        return;
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

      if (pinOnProfile) {
        await setPinnedPostForCreator({
          viewerId: user.id,
          creatorId,
          postId: post.id,
        });
      }

      toast.success(
        pinOnProfile
          ? tr("Post publicado e fixado no perfil!", "Post published and pinned!")
          : tr("Post publicado!", "Post published!"),
      );
      setBody("");
      setMediaDrafts([]);
      setPostFormat("text");
      setVisibility("public");
      setPinOnProfile(false);
      setPriceReais("");
      setGoalTargetReais("");
      setGoalUnlockReais("");
      nav({
        to: "/profile/$username",
        params: { username: profile?.username ?? "aline" },
      });
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

  const changePinnedPost = async (post: PostWithRelations) => {
    setPinningId(post.id);
    try {
      const nextPostId = post.is_pinned ? null : post.id;
      await setPinnedPostForCreator({
        viewerId: user.id,
        creatorId,
        postId: nextPostId,
      });
      toast.success(
        nextPostId
          ? tr("Publicação fixada no topo do perfil.", "Post pinned to the top of the profile.")
          : tr("Publicação desafixada.", "Post unpinned."),
      );
      await loadCreatorPosts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível alterar a publicação fixada.", "Couldn't update the pinned post."),
      );
    } finally {
      setPinningId(null);
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

        <div className="space-y-4 rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tr("O que você quer publicar?", "What do you want to publish?")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tr(
                "Escolha o formato. A legenda é opcional para fotos e vídeos.",
                "Choose a format. Captions are optional for photos and videos.",
              )}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <FormatButton
              active={postFormat === "text"}
              icon={<FileText className="h-4 w-4" />}
              label={tr("Texto", "Text")}
              onClick={() => selectPostFormat("text")}
            />
            <FormatButton
              active={postFormat === "image"}
              icon={<ImageIcon className="h-4 w-4" />}
              label={tr("Foto", "Photo")}
              onClick={() => selectPostFormat("image")}
            />
            <FormatButton
              active={postFormat === "video"}
              icon={<Video className="h-4 w-4" />}
              label={tr("Vídeo", "Video")}
              onClick={() => selectPostFormat("video")}
            />
          </div>

          <Textarea
            placeholder={
              postFormat === "text"
                ? tr("Escreva sua publicação...", "Write your post...")
                : tr("Adicione uma legenda (opcional)...", "Add a caption (optional)...")
            }
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

          <div className="space-y-3">
            {postFormat !== "text" && (
              <label className="flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/35 bg-primary/5 px-4 py-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10">
                <ImagePlus className="h-5 w-5" />
                {postFormat === "video"
                  ? tr("Selecionar vídeo", "Select video")
                  : tr("Selecionar foto", "Select photo")}
                <input
                  type="file"
                  accept={postFormat === "video" ? "video/*" : "image/*"}
                  multiple
                  onChange={onFiles}
                  className="hidden"
                />
              </label>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">
                {tr("Quem poderá acessar?", "Who can access it?")}
              </p>
              <div className="flex flex-wrap gap-1 rounded-xl bg-background p-1">
              <VisBtn active={visibility === "public"} onClick={() => setVisibility("public")} icon={<Globe className="h-3.5 w-3.5" />} label={tr("Público", "Public")} />
              <VisBtn active={visibility === "subscribers"} onClick={() => setVisibility("subscribers")} icon={<Lock className="h-3.5 w-3.5" />} label={tr("Assinantes", "Subscribers")} />
              <VisBtn active={visibility === "ppv"} onClick={() => setVisibility("ppv")} icon={<DollarSign className="h-3.5 w-3.5" />} label="PPV" />
              <VisBtn active={visibility === "goal"} onClick={() => setVisibility("goal")} icon={<Target className="h-3.5 w-3.5" />} label={tr("Meta", "Goal")} />
              </div>
            </div>
          </div>

          {visibility === "ppv" && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {tr("Publicação PPV", "PPV post")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {tr(
                      "O conteúdo será desbloqueado somente após o pagamento.",
                      "The content unlocks only after payment.",
                    )}
                  </p>
                </div>
                <Input
                  aria-label={tr("Preço do PPV em reais", "PPV price in BRL")}
                  type="number"
                  step="0.50"
                  min="1"
                  placeholder="19,90"
                  value={priceReais}
                  onChange={(e) => setPriceReais(e.target.value)}
                  className="h-9 w-28 bg-card text-right"
                />
              </div>
            </div>
          )}

          {visibility === "goal" && (
            <div className="space-y-2 rounded-xl bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="h-4 w-4 text-accent" />
                {tr("Meta coletiva — várias pessoas contribuem para liberar", "Collective goal — several people contribute to unlock")}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="goal-target" className="text-xs text-muted-foreground">
                  {tr("Meta total (R$)", "Total goal (R$)")} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="goal-target"
                  aria-label={tr("Meta total obrigatória em reais", "Required total goal in BRL")}
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="500,00"
                  value={goalTargetReais}
                  onChange={(e) => setGoalTargetReais(e.target.value)}
                  className="ml-auto h-8 w-28 border-0 bg-card text-right"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="goal-minimum" className="text-xs text-muted-foreground">
                  {tr("Contribuição mínima (R$)", "Minimum contribution (R$)")} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="goal-minimum"
                  aria-label={tr("Contribuição mínima obrigatória em reais", "Required minimum contribution in BRL")}
                  type="number"
                  step="0.50"
                  min="1"
                  required
                  placeholder="9,90"
                  value={goalUnlockReais}
                  onChange={(e) => setGoalUnlockReais(e.target.value)}
                  className="ml-auto h-8 w-28 border-0 bg-card text-right"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {tr(
                  "Os dois campos são obrigatórios. O lead poderá escolher valores rápidos ou digitar outro valor acima do mínimo.",
                  "Both fields are required. The lead can choose a quick amount or enter another amount above the minimum.",
                )}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPinOnProfile((current) => !current)}
            aria-pressed={pinOnProfile}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
              pinOnProfile
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-background/40 hover:border-primary/25"
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${pinOnProfile ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <Pin className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {tr("Fixar no topo do perfil", "Pin to the top of the profile")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {tr(
                  "Se já houver um post fixado, ele será substituído por este.",
                  "If another post is pinned, this one will replace it.",
                )}
              </span>
            </span>
            <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${pinOnProfile ? "bg-primary" : "bg-muted"}`}>
              <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${pinOnProfile ? "translate-x-4" : "translate-x-0"}`} />
            </span>
          </button>

          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Publicar", "Publish")}
          </Button>
        </div>

        <section className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                {tr("Publicações do perfil", "Profile posts")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr(
                  "Escolha qual publicação ficará em primeiro lugar no seu perfil.",
                  "Choose which post appears first on your profile.",
                )}
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {creatorPosts.length}
            </span>
          </div>

          {creatorPosts.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {tr("Nenhuma publicação ainda.", "No posts yet.")}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {creatorPosts.map((post) => {
                const mediaType = post.media[0]?.mime_type ?? "";
                const ContentIcon = mediaType.startsWith("video/")
                  ? Video
                  : post.media.length > 0
                    ? ImageIcon
                    : FileText;
                const accessLabel =
                  post.visibility === "ppv"
                    ? `PPV · R$ ${(post.price_cents / 100).toFixed(2).replace(".", ",")}`
                    : post.visibility === "subscribers"
                      ? tr("Assinantes", "Subscribers")
                      : post.visibility === "goal"
                        ? tr("Meta coletiva", "Collective goal")
                        : tr("Público", "Public");
                return (
                  <article
                    key={post.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      post.is_pinned
                        ? "border-primary/35 bg-primary/5"
                        : "border-border/50 bg-background/35"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ContentIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-full truncate text-sm font-semibold text-foreground">
                          {post.body || tr("Publicação sem legenda", "Post without a caption")}
                        </p>
                        {post.is_pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <Pin className="h-3 w-3" /> {tr("Fixado", "Pinned")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {accessLabel} · {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(post.created_at))}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={post.is_pinned ? "secondary" : "outline"}
                      disabled={pinningId === post.id}
                      onClick={() => void changePinnedPost(post)}
                    >
                      {pinningId === post.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : post.is_pinned ? (
                        <>
                          <PinOff className="mr-1.5 h-3.5 w-3.5" />
                          {tr("Desafixar", "Unpin")}
                        </>
                      ) : (
                        <>
                          <Pin className="mr-1.5 h-3.5 w-3.5" />
                          {tr("Fixar", "Pin")}
                        </>
                      )}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
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
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    setPreviewFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
      {!previewUrl ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : previewFailed ? (
        <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
          {tr("Este formato não pôde ser exibido. Use JPG, PNG, WebP ou MP4.", "This format couldn't be previewed. Use JPG, PNG, WebP or MP4.")}
        </div>
      ) : isVideo && !draft.coverFile ? (
        <video
          src={previewUrl}
          muted
          playsInline
          controls
          preload="metadata"
          onError={() => setPreviewFailed(true)}
          className="h-full w-full bg-black object-contain"
        />
      ) : (
        <img
          src={previewUrl}
          alt={tr("Prévia da foto selecionada", "Selected photo preview")}
          onError={() => setPreviewFailed(true)}
          className="h-full w-full object-contain"
        />
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
          {draft.coverFile ? tr("Trocar capa", "Change cover") : tr("Capa opcional", "Optional cover")}
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

function FormatButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
        active
          ? "border-primary/45 bg-primary/10 text-primary"
          : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/25 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
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

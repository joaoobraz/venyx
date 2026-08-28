import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Archive,
  Check,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Images,
  Loader2,
  LockKeyhole,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { moderateBeforeUpload } from "@/lib/moderation";
import {
  addAssetToCreatorMediaCollection,
  createCreatorMediaCollection,
  CREATOR_MEDIA_LIBRARY_CHANGED_EVENT,
  importCreatorMediaFile,
  listCreatorMediaAssets,
  listCreatorMediaCollections,
  setCreatorMediaAssetArchived,
  type CreatorMediaAsset,
  type CreatorMediaCategory,
  type CreatorMediaCollection,
} from "@/lib/media-library";

type Filter = "all" | CreatorMediaCategory | `collection:${string}`;

const CATEGORY_META: Array<{
  id: "all" | CreatorMediaCategory;
  label: string;
  labelEn: string;
  icon: typeof Images;
}> = [
  { id: "all", label: "Todos", labelEn: "All", icon: Images },
  { id: "chat_ppv", label: "PPVs enviados", labelEn: "Sent PPVs", icon: LockKeyhole },
  { id: "published", label: "Publicados", labelEn: "Published", icon: ImageIcon },
  { id: "archived", label: "Arquivados", labelEn: "Archived", icon: Archive },
  { id: "upload", label: "Meus uploads", labelEn: "My uploads", icon: Upload },
];

export function CreatorMediaLibrary({
  userId,
  mode = "manage",
  onSelectAsset,
}: {
  userId: string;
  mode?: "manage" | "pick";
  onSelectAsset?: (asset: CreatorMediaAsset) => void;
}) {
  const { tr, locale } = useI18n();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<CreatorMediaAsset[]>([]);
  const [collections, setCollections] = useState<CreatorMediaCollection[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [organizeAsset, setOrganizeAsset] = useState<CreatorMediaAsset | null>(null);
  const [targetCollectionId, setTargetCollectionId] = useState("");

  const load = useCallback(async () => {
    try {
      const [nextAssets, nextCollections] = await Promise.all([
        listCreatorMediaAssets(userId),
        listCreatorMediaCollections(userId),
      ]);
      setAssets(nextAssets);
      setCollections(nextCollections);
      if (nextCollections[0]) {
        setTargetCollectionId((current) => current || nextCollections[0].id);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("Não foi possível carregar o acervo.", "Couldn't load the media library."),
      );
    }
  }, [tr, userId]);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(CREATOR_MEDIA_LIBRARY_CHANGED_EVENT, reload);
    return () => window.removeEventListener(CREATOR_MEDIA_LIBRARY_CHANGED_EVENT, reload);
  }, [load]);

  const visibleAssets = useMemo(() => {
    if (filter === "all") return assets;
    if (filter.startsWith("collection:")) {
      const collectionId = filter.slice("collection:".length);
      const collection = collections.find((item) => item.id === collectionId);
      return assets.filter((asset) => collection?.asset_ids.includes(asset.id));
    }
    return assets.filter((asset) => asset.category === filter);
  }, [assets, collections, filter]);

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 12);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      let firstImported: CreatorMediaAsset | null = null;
      for (const file of files) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          throw new Error(tr("Use apenas fotos ou vídeos.", "Use only photos or videos."));
        }
        if (file.size > 50 * 1024 * 1024) {
          throw new Error(tr("Cada arquivo pode ter até 50 MB.", "Each file can be up to 50 MB."));
        }
        const moderation = await moderateBeforeUpload(file, "post", userId);
        if (!moderation.allowed) {
          throw new Error(
            moderation.reason || tr("Uma mídia não foi aprovada.", "A media file wasn't approved."),
          );
        }
        const imported = await importCreatorMediaFile(userId, file);
        if (!firstImported) firstImported = imported;
      }
      toast.success(
        files.length === 1
          ? tr("Mídia adicionada ao acervo.", "Media added to the library.")
          : tr(
              `${files.length} mídias adicionadas ao acervo.`,
              `${files.length} media files added.`,
            ),
      );
      await load();
      if (mode === "pick" && firstImported && onSelectAsset) onSelectAsset(firstImported);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro no upload.", "Upload error."));
    } finally {
      setBusy(false);
    }
  };

  const createCollection = async () => {
    if (!collectionName.trim()) return;
    setBusy(true);
    try {
      await createCreatorMediaCollection(userId, collectionName, collectionDescription);
      setCollectionName("");
      setCollectionDescription("");
      setCollectionOpen(false);
      await load();
      toast.success(tr("Coleção criada.", "Collection created."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const organize = async () => {
    if (!organizeAsset || !targetCollectionId) return;
    setBusy(true);
    try {
      await addAssetToCreatorMediaCollection(userId, targetCollectionId, organizeAsset.id);
      setOrganizeAsset(null);
      await load();
      toast.success(tr("Mídia adicionada à coleção.", "Media added to the collection."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async (asset: CreatorMediaAsset) => {
    setBusy(true);
    try {
      await setCreatorMediaAssetArchived(userId, asset, !asset.is_archived);
      await load();
      toast.success(
        asset.is_archived
          ? tr("Mídia restaurada.", "Media restored.")
          : tr(
              "Mídia arquivada e ocultada do perfil.",
              "Media archived and hidden from the profile.",
            ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Erro", "Error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={mode === "manage" ? "space-y-5" : "space-y-4"}>
      {mode === "manage" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <LibrarySummary
            label={tr("Fotos e vídeos", "Photos and videos")}
            value={assets.length}
            icon={Images}
          />
          <LibrarySummary
            label={tr("PPVs reutilizáveis", "Reusable PPVs")}
            value={assets.filter((asset) => asset.category === "chat_ppv").length}
            icon={LockKeyhole}
          />
          <LibrarySummary
            label={tr("Coleções", "Collections")}
            value={collections.length}
            icon={FolderPlus}
          />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-foreground">
              {mode === "pick"
                ? tr("Escolha uma mídia do acervo", "Choose media from the library")
                : tr("Acervo da modelo", "Creator media library")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {tr(
                "Reutilize PPVs, conteúdos publicados, itens arquivados e seus próprios uploads.",
                "Reuse PPVs, published content, archived items and your own uploads.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "manage" && (
              <Button variant="outline" size="sm" onClick={() => setCollectionOpen(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                {tr("Nova coleção", "New collection")}
              </Button>
            )}
            <Button size="sm" onClick={() => uploadRef.current?.click()} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {tr("Importar do dispositivo", "Import from device")}
            </Button>
            <input
              ref={uploadRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={onFiles}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {CATEGORY_META.map((item) => {
            const Icon = item.icon;
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {locale === "en" ? item.labelEn : item.label}
              </button>
            );
          })}
          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              onClick={() => setFilter(`collection:${collection.id}`)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === `collection:${collection.id}`
                  ? "bg-accent text-accent-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderPlus className="h-3.5 w-3.5" /> {collection.name}
            </button>
          ))}
        </div>

        {visibleAssets.length ? (
          <div
            className={`mt-4 grid gap-3 ${mode === "pick" ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3"}`}
          >
            {visibleAssets.map((asset) => (
              <MediaAssetCard
                key={asset.id}
                asset={asset}
                mode={mode}
                disabled={busy}
                onSelect={() => onSelectAsset?.(asset)}
                onOrganize={() => setOrganizeAsset(asset)}
                onArchive={() => void toggleArchive(asset)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {tr("Nenhuma mídia nesta categoria.", "No media in this category.")}
          </div>
        )}
      </div>

      <Dialog open={collectionOpen} onOpenChange={setCollectionOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Criar coleção", "Create collection")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder={tr("Ex.: Funil de PPV", "E.g. PPV funnel")}
              maxLength={60}
            />
            <Textarea
              value={collectionDescription}
              onChange={(event) => setCollectionDescription(event.target.value)}
              placeholder={tr(
                "Como você pretende usar esta coleção?",
                "How will you use this collection?",
              )}
              maxLength={240}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectionOpen(false)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button
              disabled={busy || !collectionName.trim()}
              onClick={() => void createCollection()}
            >
              {tr("Criar coleção", "Create collection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(organizeAsset)}
        onOpenChange={(open) => !open && setOrganizeAsset(null)}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Adicionar à coleção", "Add to collection")}</DialogTitle>
          </DialogHeader>
          {collections.length ? (
            <select
              value={targetCollectionId}
              onChange={(event) => setTargetCollectionId(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tr("Crie uma coleção antes de organizar esta mídia.", "Create a collection first.")}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrganizeAsset(null)}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button disabled={busy || !targetCollectionId} onClick={() => void organize()}>
              <Check className="mr-2 h-4 w-4" /> {tr("Adicionar", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LibrarySummary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Images;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function MediaAssetCard({
  asset,
  mode,
  disabled,
  onSelect,
  onOrganize,
  onArchive,
}: {
  asset: CreatorMediaAsset;
  mode: "manage" | "pick";
  disabled: boolean;
  onSelect: () => void;
  onOrganize: () => void;
  onArchive: () => void;
}) {
  const { tr } = useI18n();
  const isVideo = asset.mime_type.startsWith("video/");
  const categoryLabel =
    asset.category === "chat_ppv"
      ? "PPV"
      : asset.category === "published"
        ? tr("Publicado", "Published")
        : asset.category === "archived"
          ? tr("Arquivado", "Archived")
          : tr("Upload", "Upload");
  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-background">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {isVideo ? (
          <video
            src={asset.preview_url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={asset.preview_url}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}{" "}
          {categoryLabel}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <h4 className="truncate text-sm font-semibold text-foreground">{asset.title}</h4>
        {mode === "pick" ? (
          <Button size="sm" className="w-full" onClick={onSelect} disabled={disabled}>
            <Check className="mr-2 h-4 w-4" /> {tr("Usar esta mídia", "Use this media")}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onOrganize}
              disabled={disabled}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> {tr("Coleção", "Collection")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onArchive}
              disabled={disabled}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              {asset.is_archived ? tr("Restaurar", "Restore") : tr("Arquivar", "Archive")}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

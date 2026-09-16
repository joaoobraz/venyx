import { DEMO_MODE } from "@/lib/demo-creators";
import { updateDemoOperations } from "@/lib/demo-operations";
import { supabase } from "@/integrations/supabase/client";

export type CreatorMediaCategory = "chat_ppv" | "published" | "archived" | "upload";

export interface CreatorMediaAsset {
  id: string;
  creator_id: string;
  title: string;
  category: CreatorMediaCategory;
  source_type: CreatorMediaCategory;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  cover_storage_path: string | null;
  source_post_id: string | null;
  source_message_id: string | null;
  is_archived: boolean;
  created_at: string;
  asset_url: string;
  preview_url: string;
  is_demo: boolean;
}

export interface CreatorMediaCollection {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  asset_ids: string[];
  created_at: string;
}

const LIBRARY_VERSION = "v1";
const MEDIA_DB_NAME = "venyx-creator-media-library";
const MEDIA_STORE_NAME = "assets";
export const CREATOR_MEDIA_LIBRARY_CHANGED_EVENT = "venyx:creator-media-library-changed";

type StoredDemoAsset = Omit<CreatorMediaAsset, "asset_url" | "preview_url" | "is_demo">;

const seedAssets = (userId: string): StoredDemoAsset[] => [
  {
    id: "library-seed-ppv-studio",
    creator_id: userId,
    title: "Ensaio exclusivo do estúdio",
    category: "chat_ppv",
    source_type: "chat_ppv",
    mime_type: "image/webp",
    storage_bucket: "demo",
    storage_path: "/demo-creators/aline-investor.webp",
    cover_storage_path: null,
    source_post_id: null,
    source_message_id: "demo-ppv-studio",
    is_archived: false,
    created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  },
  {
    id: "library-seed-ppv-bastidores",
    creator_id: userId,
    title: "Bastidores — sequência completa",
    category: "chat_ppv",
    source_type: "chat_ppv",
    mime_type: "image/webp",
    storage_bucket: "demo",
    storage_path: "/demo-creators/aline-ai.webp",
    cover_storage_path: null,
    source_post_id: null,
    source_message_id: "demo-ppv-bastidores",
    is_archived: false,
    created_at: new Date(Date.now() - 20 * 60 * 60_000).toISOString(),
  },
  {
    id: "library-seed-post-editorial",
    creator_id: userId,
    title: "Editorial publicado",
    category: "published",
    source_type: "published",
    mime_type: "image/webp",
    storage_bucket: "demo",
    storage_path: "/demo-creators/aline-investor.webp",
    cover_storage_path: null,
    source_post_id: "creator-post-studio",
    source_message_id: null,
    is_archived: false,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString(),
  },
  {
    id: "library-seed-post-archived",
    creator_id: userId,
    title: "Ensaio arquivado do perfil",
    category: "archived",
    source_type: "archived",
    mime_type: "image/webp",
    storage_bucket: "demo",
    storage_path: "/demo-creators/aline-ai.webp",
    cover_storage_path: null,
    source_post_id: "creator-post-archived",
    source_message_id: null,
    is_archived: true,
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60_000).toISOString(),
  },
];

function assetStorageKey(userId: string) {
  return `venyx:creator-media-assets:${LIBRARY_VERSION}:${userId}`;
}

function collectionStorageKey(userId: string) {
  return `venyx:creator-media-collections:${LIBRARY_VERSION}:${userId}`;
}

function openMediaDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        database.createObjectStore(MEDIA_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o acervo."));
  });
}

async function storeBlob(assetId: string, file: Blob) {
  const database = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE_NAME, "readwrite");
    transaction.objectStore(MEDIA_STORE_NAME).put(file, assetId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Não foi possível salvar a mídia no acervo."));
  });
  database.close();
}

async function readBlob(assetId: string) {
  const database = await openMediaDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE_NAME, "readonly");
    const request = transaction.objectStore(MEDIA_STORE_NAME).get(assetId);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () =>
      reject(request.error ?? new Error("Não foi possível abrir a mídia do acervo."));
  });
  database.close();
  return blob;
}

function readStoredDemoAssets(userId: string) {
  if (typeof window === "undefined") return [] as StoredDemoAsset[];
  try {
    const value = window.localStorage.getItem(assetStorageKey(userId));
    return value ? (JSON.parse(value) as StoredDemoAsset[]) : [];
  } catch {
    return [];
  }
}

function writeStoredDemoAssets(userId: string, assets: StoredDemoAsset[]) {
  window.localStorage.setItem(assetStorageKey(userId), JSON.stringify(assets));
  window.dispatchEvent(new Event(CREATOR_MEDIA_LIBRARY_CHANGED_EVENT));
}

function defaultCollections(userId: string): CreatorMediaCollection[] {
  return [
    {
      id: "library-collection-ppv-funnel",
      creator_id: userId,
      name: "Funil de PPV",
      description: "Sequência de entrada, interesse e oferta principal.",
      asset_ids: ["library-seed-ppv-bastidores", "library-seed-ppv-studio"],
      created_at: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
    },
  ];
}

function readStoredDemoCollections(userId: string) {
  if (typeof window === "undefined") return defaultCollections(userId);
  try {
    const value = window.localStorage.getItem(collectionStorageKey(userId));
    if (value) return JSON.parse(value) as CreatorMediaCollection[];
  } catch {
    // Recreate the safe local seed below.
  }
  const seeded = defaultCollections(userId);
  window.localStorage.setItem(collectionStorageKey(userId), JSON.stringify(seeded));
  return seeded;
}

function writeStoredDemoCollections(userId: string, collections: CreatorMediaCollection[]) {
  window.localStorage.setItem(collectionStorageKey(userId), JSON.stringify(collections));
  window.dispatchEvent(new Event(CREATOR_MEDIA_LIBRARY_CHANGED_EVENT));
}

export async function listCreatorMediaAssets(userId: string): Promise<CreatorMediaAsset[]> {
  if (DEMO_MODE) {
    const stored = readStoredDemoAssets(userId);
    const combined = Array.from(
      new Map([...seedAssets(userId), ...stored].map((asset) => [asset.id, asset])).values(),
    );
    return Promise.all(
      combined.map(async (asset) => {
        const blob = asset.storage_bucket === "demo" ? null : await readBlob(asset.id);
        const url = blob ? URL.createObjectURL(blob) : asset.storage_path;
        return { ...asset, asset_url: url, preview_url: url, is_demo: true };
      }),
    );
  }

  const { data, error } = await supabase
    .from("creator_media_assets")
    .select("*")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return Promise.all(
    (data ?? []).map(async (asset) => {
      const [{ data: original }, { data: cover }] = await Promise.all([
        supabase.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 300),
        asset.cover_storage_path
          ? supabase.storage
              .from(asset.storage_bucket)
              .createSignedUrl(asset.cover_storage_path, 300)
          : Promise.resolve({ data: null }),
      ]);
      return {
        ...asset,
        category: asset.category as CreatorMediaCategory,
        source_type: asset.source_type as CreatorMediaCategory,
        asset_url: original?.signedUrl ?? "",
        preview_url: cover?.signedUrl ?? original?.signedUrl ?? "",
        is_demo: false,
      };
    }),
  );
}

export async function importCreatorMediaFile(
  userId: string,
  file: File,
  options: {
    title?: string;
    category?: CreatorMediaCategory;
    sourceMessageId?: string | null;
    sourcePostId?: string | null;
    id?: string;
  } = {},
) {
  const id = options.id ?? crypto.randomUUID();
  const category = options.category ?? "upload";
  const title = options.title?.trim() || file.name.replace(/\.[^.]+$/, "") || "Mídia sem título";
  if (DEMO_MODE) {
    await storeBlob(id, file);
    const next: StoredDemoAsset = {
      id,
      creator_id: userId,
      title,
      category,
      source_type: category,
      mime_type: file.type,
      storage_bucket: "demo-library",
      storage_path: id,
      cover_storage_path: null,
      source_post_id: options.sourcePostId ?? null,
      source_message_id: options.sourceMessageId ?? null,
      is_archived: category === "archived",
      created_at: new Date().toISOString(),
    };
    const current = readStoredDemoAssets(userId).filter((asset) => asset.id !== id);
    writeStoredDemoAssets(userId, [next, ...current]);
    return {
      ...next,
      asset_url: URL.createObjectURL(file),
      preview_url: URL.createObjectURL(file),
      is_demo: true,
    };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/${id}/${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("creator-library")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data, error } = await supabase
    .from("creator_media_assets")
    .insert({
      id,
      creator_id: userId,
      title,
      category,
      source_type: category,
      mime_type: file.type,
      storage_bucket: "creator-library",
      storage_path: path,
      source_message_id: options.sourceMessageId ?? null,
      source_post_id: options.sourcePostId ?? null,
      is_archived: category === "archived",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    category: data.category as CreatorMediaCategory,
    source_type: data.source_type as CreatorMediaCategory,
    asset_url: URL.createObjectURL(file),
    preview_url: URL.createObjectURL(file),
    is_demo: false,
  };
}

export async function materializeCreatorMediaAsset(asset: CreatorMediaAsset) {
  const response = await fetch(asset.asset_url);
  if (!response.ok) throw new Error("Não foi possível abrir a mídia escolhida.");
  const blob = await response.blob();
  const extension = asset.mime_type.startsWith("video/") ? "mp4" : "webp";
  return new File([blob], `${asset.title}.${extension}`, {
    type: blob.type || asset.mime_type,
  });
}

export async function listCreatorMediaCollections(
  userId: string,
): Promise<CreatorMediaCollection[]> {
  if (DEMO_MODE) return readStoredDemoCollections(userId);
  const [{ data: collections, error }, { data: items, error: itemError }] = await Promise.all([
    supabase
      .from("creator_media_collections")
      .select("*")
      .eq("creator_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("creator_media_collection_items").select("collection_id,asset_id,position"),
  ]);
  if (error || itemError) throw new Error(error?.message ?? itemError?.message);
  return (collections ?? []).map((collection) => ({
    ...collection,
    asset_ids: (items ?? [])
      .filter((item) => item.collection_id === collection.id)
      .sort((first, second) => first.position - second.position)
      .map((item) => item.asset_id),
  }));
}

export async function createCreatorMediaCollection(
  userId: string,
  name: string,
  description?: string,
) {
  if (DEMO_MODE) {
    const collection: CreatorMediaCollection = {
      id: `collection-${crypto.randomUUID()}`,
      creator_id: userId,
      name: name.trim(),
      description: description?.trim() || null,
      asset_ids: [],
      created_at: new Date().toISOString(),
    };
    writeStoredDemoCollections(userId, [...readStoredDemoCollections(userId), collection]);
    return collection;
  }
  const { data, error } = await supabase
    .from("creator_media_collections")
    .insert({ creator_id: userId, name: name.trim(), description: description?.trim() || null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, asset_ids: [] };
}

export async function addAssetToCreatorMediaCollection(
  userId: string,
  collectionId: string,
  assetId: string,
) {
  if (DEMO_MODE) {
    const next = readStoredDemoCollections(userId).map((collection) =>
      collection.id === collectionId
        ? { ...collection, asset_ids: Array.from(new Set([...collection.asset_ids, assetId])) }
        : collection,
    );
    writeStoredDemoCollections(userId, next);
    return;
  }
  const { count } = await supabase
    .from("creator_media_collection_items")
    .select("*", { count: "exact", head: true })
    .eq("collection_id", collectionId);
  const { error } = await supabase
    .from("creator_media_collection_items")
    .upsert(
      { collection_id: collectionId, asset_id: assetId, position: count ?? 0 },
      { onConflict: "collection_id,asset_id" },
    );
  if (error) throw new Error(error.message);
}

export async function setCreatorMediaAssetArchived(
  userId: string,
  asset: CreatorMediaAsset,
  archived: boolean,
) {
  if (DEMO_MODE) {
    const seeded = seedAssets(userId).find((item) => item.id === asset.id);
    const current = readStoredDemoAssets(userId).filter((item) => item.id !== asset.id);
    const source: StoredDemoAsset = seeded
      ? { ...seeded }
      : {
          id: asset.id,
          creator_id: asset.creator_id,
          title: asset.title,
          category: asset.category,
          source_type: asset.source_type,
          mime_type: asset.mime_type,
          storage_bucket: asset.storage_bucket,
          storage_path: asset.storage_path,
          cover_storage_path: asset.cover_storage_path,
          source_post_id: asset.source_post_id,
          source_message_id: asset.source_message_id,
          is_archived: asset.is_archived,
          created_at: asset.created_at,
        };
    writeStoredDemoAssets(userId, [
      {
        ...source,
        category: archived ? "archived" : source.source_type,
        is_archived: archived,
      },
      ...current,
    ]);
    if (asset.source_post_id) {
      updateDemoOperations(userId, (state) => ({
        ...state,
        creatorPosts: state.creatorPosts.map((post) =>
          post.id === asset.source_post_id
            ? { ...post, status: archived ? "archived" : "published" }
            : post,
        ),
      }));
    }
    return;
  }
  const { error } = await supabase
    .from("creator_media_assets")
    .update({ is_archived: archived, category: archived ? "archived" : asset.source_type })
    .eq("id", asset.id)
    .eq("creator_id", userId);
  if (error) throw new Error(error.message);
  if (asset.source_post_id) {
    const { error: postError } = await supabase
      .from("posts")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", asset.source_post_id)
      .eq("creator_id", userId);
    if (postError) throw new Error(postError.message);
  }
}

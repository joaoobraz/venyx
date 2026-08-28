-- Creator media library, post archiving and definitive chat PPV authorization.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS posts_creator_active_created_idx
  ON public.posts(creator_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.creator_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'upload'
    CHECK (category IN ('chat_ppv', 'published', 'archived', 'upload')),
  source_type text NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('chat_ppv', 'published', 'archived', 'upload')),
  mime_type text NOT NULL CHECK (mime_type LIKE 'image/%' OR mime_type LIKE 'video/%'),
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  cover_storage_path text,
  source_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_media_assets_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS creator_media_assets_creator_category_idx
  ON public.creator_media_assets(creator_id, category, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS creator_media_assets_source_post_media_idx
  ON public.creator_media_assets(source_post_id, storage_path)
  WHERE source_post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creator_media_assets_source_message_idx
  ON public.creator_media_assets(source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.creator_media_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_media_collections_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT creator_media_collections_description_length
    CHECK (description IS NULL OR char_length(description) <= 240)
);

CREATE INDEX IF NOT EXISTS creator_media_collections_creator_idx
  ON public.creator_media_collections(creator_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.creator_media_collection_items (
  collection_id uuid NOT NULL REFERENCES public.creator_media_collections(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.creator_media_assets(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, asset_id)
);

ALTER TABLE public.creator_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_media_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_media_collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators manage their own media assets" ON public.creator_media_assets;
CREATE POLICY "Creators manage their own media assets"
  ON public.creator_media_assets
  FOR ALL
  TO authenticated
  USING (creator_id = auth.uid() AND public.has_role(auth.uid(), 'creator'::public.app_role))
  WITH CHECK (creator_id = auth.uid() AND public.has_role(auth.uid(), 'creator'::public.app_role));

DROP POLICY IF EXISTS "Creators manage their own media collections" ON public.creator_media_collections;
CREATE POLICY "Creators manage their own media collections"
  ON public.creator_media_collections
  FOR ALL
  TO authenticated
  USING (creator_id = auth.uid() AND public.has_role(auth.uid(), 'creator'::public.app_role))
  WITH CHECK (creator_id = auth.uid() AND public.has_role(auth.uid(), 'creator'::public.app_role));

DROP POLICY IF EXISTS "Creators manage their own media collection items"
  ON public.creator_media_collection_items;
CREATE POLICY "Creators manage their own media collection items"
  ON public.creator_media_collection_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.creator_media_collections collection
      WHERE collection.id = collection_id
        AND collection.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.creator_media_collections collection
      WHERE collection.id = collection_id
        AND collection.creator_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.creator_media_assets asset
      WHERE asset.id = asset_id
        AND asset.creator_id = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-library',
  'creator-library',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Creators upload to their private library" ON storage.objects;
CREATE POLICY "Creators upload to their private library"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'creator-library'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  );

DROP POLICY IF EXISTS "Creators read their private library" ON storage.objects;
CREATE POLICY "Creators read their private library"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'creator-library'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Creators delete from their private library" ON storage.objects;
CREATE POLICY "Creators delete from their private library"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'creator-library'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.enforce_creator_chat_ppv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.ppv_price_cents > 0 THEN
    IF NEW.media_path IS NULL THEN
      RAISE EXCEPTION 'PPV no chat precisa conter foto ou vídeo';
    END IF;
    IF NOT public.has_role(NEW.sender_id, 'creator'::public.app_role) THEN
      RAISE EXCEPTION 'Somente modelos podem enviar PPV no chat';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_creator_chat_ppv ON public.chat_messages;
CREATE TRIGGER enforce_creator_chat_ppv
  BEFORE INSERT OR UPDATE OF ppv_price_cents, media_path, sender_id
  ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_creator_chat_ppv();

CREATE OR REPLACE FUNCTION public.sync_post_media_to_creator_library()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
  post_archived_at timestamptz;
BEGIN
  SELECT creator_id, archived_at
    INTO owner_id, post_archived_at
  FROM public.posts
  WHERE id = NEW.post_id;

  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.creator_media_assets (
    creator_id,
    title,
    category,
    source_type,
    mime_type,
    storage_bucket,
    storage_path,
    cover_storage_path,
    source_post_id,
    is_archived,
    created_at
  )
  VALUES (
    owner_id,
    'Mídia de publicação',
    CASE WHEN post_archived_at IS NULL THEN 'published' ELSE 'archived' END,
    'published',
    NEW.mime_type,
    'posts',
    NEW.storage_path,
    NEW.cover_storage_path,
    NEW.post_id,
    post_archived_at IS NOT NULL,
    NEW.created_at
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_post_media_to_creator_library ON public.post_media;
CREATE TRIGGER sync_post_media_to_creator_library
  AFTER INSERT ON public.post_media
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_post_media_to_creator_library();

CREATE OR REPLACE FUNCTION public.sync_chat_ppv_to_creator_library()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.ppv_price_cents <= 0 OR NEW.media_path IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.creator_media_assets (
    creator_id,
    title,
    category,
    source_type,
    mime_type,
    storage_bucket,
    storage_path,
    source_message_id,
    created_at
  )
  VALUES (
    NEW.sender_id,
    'PPV enviado no chat',
    'chat_ppv',
    'chat_ppv',
    NEW.mime_type,
    'chat-media',
    NEW.media_path,
    NEW.id,
    NEW.created_at
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_chat_ppv_to_creator_library ON public.chat_messages;
CREATE TRIGGER sync_chat_ppv_to_creator_library
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_chat_ppv_to_creator_library();

CREATE OR REPLACE FUNCTION public.sync_archived_post_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN
    UPDATE public.creator_media_assets
    SET
      category = CASE WHEN NEW.archived_at IS NULL THEN source_type ELSE 'archived' END,
      is_archived = NEW.archived_at IS NOT NULL,
      updated_at = now()
    WHERE source_post_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_archived_post_media ON public.posts;
CREATE TRIGGER sync_archived_post_media
  AFTER UPDATE OF archived_at ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_archived_post_media();

INSERT INTO public.creator_media_assets (
  creator_id,
  title,
  category,
  source_type,
  mime_type,
  storage_bucket,
  storage_path,
  cover_storage_path,
  source_post_id,
  is_archived,
  created_at
)
SELECT
  post.creator_id,
  'Mídia de publicação',
  CASE WHEN post.archived_at IS NULL THEN 'published' ELSE 'archived' END,
  'published',
  media.mime_type,
  'posts',
  media.storage_path,
  media.cover_storage_path,
  post.id,
  post.archived_at IS NOT NULL,
  media.created_at
FROM public.post_media media
JOIN public.posts post ON post.id = media.post_id
ON CONFLICT DO NOTHING;

INSERT INTO public.creator_media_assets (
  creator_id,
  title,
  category,
  source_type,
  mime_type,
  storage_bucket,
  storage_path,
  source_message_id,
  created_at
)
SELECT
  message.sender_id,
  'PPV enviado no chat',
  'chat_ppv',
  'chat_ppv',
  message.mime_type,
  'chat-media',
  message.media_path,
  message.id,
  message.created_at
FROM public.chat_messages message
WHERE message.ppv_price_cents > 0
  AND message.media_path IS NOT NULL
  AND public.has_role(message.sender_id, 'creator'::public.app_role)
ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_media_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_media_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_media_collection_items TO authenticated;

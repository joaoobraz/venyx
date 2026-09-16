-- Creator profile: allow exactly one visible pinned post per creator.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS posts_one_visible_pin_per_creator_idx
  ON public.posts (creator_id)
  WHERE is_pinned = true AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS posts_creator_pinned_created_idx
  ON public.posts (creator_id, is_pinned DESC, created_at DESC)
  WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_pinned_post(_post_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  _actor_id uuid := auth.uid();
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF _post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.posts
    WHERE id = _post_id
      AND creator_id = _actor_id
      AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Post not found or not owned by the authenticated creator'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.posts
  SET is_pinned = false
  WHERE creator_id = _actor_id
    AND is_pinned = true;

  IF _post_id IS NOT NULL THEN
    UPDATE public.posts
    SET is_pinned = true
    WHERE id = _post_id
      AND creator_id = _actor_id
      AND archived_at IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_pinned_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_pinned_post(uuid) TO authenticated;

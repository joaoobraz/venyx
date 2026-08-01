-- Persistent post interactions and optional creator-selected video covers.

ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS cover_storage_path text;

CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_likes_post_user_key UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_id_idx
  ON public.post_likes(post_id);

CREATE INDEX IF NOT EXISTS post_likes_user_id_idx
  ON public.post_likes(user_id, created_at DESC);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own post likes" ON public.post_likes;
CREATE POLICY "Users can read their own post likes"
  ON public.post_likes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can like visible posts" ON public.post_likes;
CREATE POLICY "Users can like visible posts"
  ON public.post_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_post(post_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can remove their own post likes" ON public.post_likes;
CREATE POLICY "Users can remove their own post likes"
  ON public.post_likes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_body_length
    CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS post_comments_post_created_idx
  ON public.post_comments(post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS post_comments_user_id_idx
  ON public.post_comments(user_id, created_at DESC);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read comments on visible posts" ON public.post_comments;
CREATE POLICY "Users can read comments on visible posts"
  ON public.post_comments
  FOR SELECT
  TO authenticated
  USING (public.can_view_post(post_id, auth.uid()));

DROP POLICY IF EXISTS "Users can comment on visible posts" ON public.post_comments;
CREATE POLICY "Users can comment on visible posts"
  ON public.post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_post(post_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND public.users_are_blocked(auth.uid(), p.creator_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete their comments or moderate their posts" ON public.post_comments;
CREATE POLICY "Users can delete their comments or moderate their posts"
  ON public.post_comments
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND p.creator_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.touch_post_comment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_post_comment_updated_at ON public.post_comments;
CREATE TRIGGER touch_post_comment_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_post_comment_updated_at();

CREATE OR REPLACE FUNCTION public.adjust_post_interaction_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_post_id uuid := COALESCE(NEW.post_id, OLD.post_id);
  delta integer := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    UPDATE public.posts
    SET likes_count = GREATEST(0, likes_count + delta)
    WHERE id = target_post_id;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    UPDATE public.posts
    SET comments_count = GREATEST(0, comments_count + delta)
    WHERE id = target_post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS adjust_post_likes_count ON public.post_likes;
CREATE TRIGGER adjust_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_post_interaction_counter();

DROP TRIGGER IF EXISTS adjust_post_comments_count ON public.post_comments;
CREATE TRIGGER adjust_post_comments_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_post_interaction_counter();

-- The old counters were demo-only and had no interaction rows behind them.
-- Reconcile them once so every number shown after this migration is auditable.
UPDATE public.posts p
SET
  likes_count = (
    SELECT count(*)::integer
    FROM public.post_likes l
    WHERE l.post_id = p.id
  ),
  comments_count = (
    SELECT count(*)::integer
    FROM public.post_comments c
    WHERE c.post_id = p.id
  );

GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;

-- Creator-owned comment approval, visibility and moderation workflow.

CREATE TABLE IF NOT EXISTS public.creator_comment_settings (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  manual_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_comment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators manage their comment settings"
  ON public.creator_comment_settings;
CREATE POLICY "Creators manage their comment settings"
  ON public.creator_comment_settings
  FOR ALL
  TO authenticated
  USING (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  )
  WITH CHECK (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  );

DROP TRIGGER IF EXISTS touch_creator_comment_settings_updated_at
  ON public.creator_comment_settings;
CREATE TRIGGER touch_creator_comment_settings_updated_at
  BEFORE UPDATE ON public.creator_comment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_reason text;

ALTER TABLE public.post_comments
  DROP CONSTRAINT IF EXISTS post_comments_moderation_status_check;
ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_moderation_status_check
  CHECK (moderation_status IN ('published', 'pending', 'hidden', 'rejected'));

CREATE INDEX IF NOT EXISTS post_comments_post_moderation_created_idx
  ON public.post_comments(post_id, moderation_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.assign_post_comment_moderation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  post_creator_id uuid;
  approval_required boolean := false;
BEGIN
  SELECT p.creator_id
  INTO post_creator_id
  FROM public.posts p
  WHERE p.id = NEW.post_id;

  IF post_creator_id IS NULL THEN
    RAISE EXCEPTION 'COMMENT_POST_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.manual_approval
  INTO approval_required
  FROM public.creator_comment_settings s
  WHERE s.creator_id = post_creator_id;

  NEW.moderation_status := CASE
    WHEN NEW.user_id = post_creator_id THEN 'published'
    WHEN COALESCE(approval_required, false) THEN 'pending'
    ELSE 'published'
  END;
  NEW.moderated_at := NULL;
  NEW.moderated_by := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_post_comment_moderation_status
  ON public.post_comments;
CREATE TRIGGER assign_post_comment_moderation_status
  BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.assign_post_comment_moderation_status();

CREATE OR REPLACE FUNCTION public.stamp_post_comment_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.moderation_status IS DISTINCT FROM NEW.moderation_status THEN
    NEW.moderated_at := now();
    NEW.moderated_by := COALESCE(auth.uid(), NEW.moderated_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_post_comment_moderation
  ON public.post_comments;
CREATE TRIGGER stamp_post_comment_moderation
  BEFORE UPDATE OF moderation_status ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_post_comment_moderation();

DROP POLICY IF EXISTS "Users can read comments on visible posts"
  ON public.post_comments;
CREATE POLICY "Users can read comments on visible posts"
  ON public.post_comments
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_post(post_id, auth.uid())
    AND NOT public.users_are_blocked(auth.uid(), user_id)
    AND (
      moderation_status = 'published'
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = post_id
          AND p.creator_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Creators moderate comments on their posts"
  ON public.post_comments;
CREATE POLICY "Creators moderate comments on their posts"
  ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND p.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND p.creator_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.adjust_post_interaction_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_post_id uuid := COALESCE(NEW.post_id, OLD.post_id);
  delta integer := 0;
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    delta := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
    UPDATE public.posts
    SET likes_count = GREATEST(0, likes_count + delta)
    WHERE id = target_post_id;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    IF TG_OP = 'INSERT' AND NEW.moderation_status = 'published' THEN
      delta := 1;
    ELSIF TG_OP = 'DELETE' AND OLD.moderation_status = 'published' THEN
      delta := -1;
    ELSIF TG_OP = 'UPDATE'
      AND OLD.moderation_status <> 'published'
      AND NEW.moderation_status = 'published' THEN
      delta := 1;
    ELSIF TG_OP = 'UPDATE'
      AND OLD.moderation_status = 'published'
      AND NEW.moderation_status <> 'published' THEN
      delta := -1;
    END IF;

    IF delta <> 0 THEN
      UPDATE public.posts
      SET comments_count = GREATEST(0, comments_count + delta)
      WHERE id = target_post_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS adjust_post_comments_count ON public.post_comments;
CREATE TRIGGER adjust_post_comments_count
  AFTER INSERT OR DELETE OR UPDATE OF moderation_status ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.adjust_post_interaction_counter();

DROP TRIGGER IF EXISTS notify_post_comment ON public.post_comments;
DROP TRIGGER IF EXISTS notify_approved_post_comment ON public.post_comments;
CREATE TRIGGER notify_post_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  WHEN (NEW.moderation_status = 'published')
  EXECUTE FUNCTION public.notify_post_comment();
CREATE TRIGGER notify_approved_post_comment
  AFTER UPDATE OF moderation_status ON public.post_comments
  FOR EACH ROW
  WHEN (
    OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
    AND NEW.moderation_status = 'published'
  )
  EXECUTE FUNCTION public.notify_post_comment();

UPDATE public.posts p
SET comments_count = (
  SELECT count(*)::integer
  FROM public.post_comments c
  WHERE c.post_id = p.id
    AND c.moderation_status = 'published'
);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.creator_comment_settings TO authenticated;
GRANT UPDATE (moderation_status, moderated_at, moderated_by, hidden_reason)
  ON public.post_comments TO authenticated;

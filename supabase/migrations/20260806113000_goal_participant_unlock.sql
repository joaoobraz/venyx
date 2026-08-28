-- A card da meta precisa continuar visível para receber contribuições, mas a
-- mídia só pode ser entregue depois de duas condições simultâneas:
-- 1) a meta atingiu o valor definido pela criadora; e
-- 2) o lead autenticado participou dessa meta.
-- Atingir a meta não encerra novas contribuições: apoios posteriores também
-- registram o lead como participante e o total arrecadado pode superar 100%.

CREATE OR REPLACE FUNCTION public.can_view_post_metadata(
  _post_id uuid,
  _viewer_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer AS (
    SELECT CASE
      WHEN auth.role() = 'service_role' THEN _viewer_id
      ELSE auth.uid()
    END AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.posts post
    CROSS JOIN viewer
    WHERE post.id = _post_id
      AND viewer.id IS NOT NULL
      AND public.is_age_verified(viewer.id)
      AND public.creator_allows_viewer(post.creator_id, viewer.id)
      AND (
        NOT public.is_account_paused(post.creator_id)
        OR post.creator_id = viewer.id
        OR EXISTS (
          SELECT 1 FROM public.subscriptions subscription
          WHERE subscription.creator_id = post.creator_id
            AND subscription.subscriber_id = viewer.id
            AND subscription.status = 'active'::public.subscription_status
            AND (
              subscription.current_period_end IS NULL
              OR subscription.current_period_end > pg_catalog.now()
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.ppv_unlocks unlock
          WHERE unlock.post_id = post.id AND unlock.user_id = viewer.id
        )
        OR EXISTS (
          SELECT 1 FROM public.post_goal_contributions contribution
          WHERE contribution.post_id = post.id AND contribution.user_id = viewer.id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_post_metadata(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_post_metadata(uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_view_post(
  _post_id uuid,
  _viewer_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer AS (
    SELECT CASE
      WHEN auth.role() = 'service_role' THEN _viewer_id
      ELSE auth.uid()
    END AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.posts post
    CROSS JOIN viewer
    WHERE post.id = _post_id
      AND viewer.id IS NOT NULL
      AND public.can_view_post_metadata(post.id, viewer.id)
      AND (
        post.creator_id = viewer.id
        OR post.visibility = 'public'::public.post_visibility
        OR (
          post.visibility = 'subscribers'::public.post_visibility
          AND EXISTS (
            SELECT 1 FROM public.subscriptions subscription
            WHERE subscription.creator_id = post.creator_id
              AND subscription.subscriber_id = viewer.id
              AND subscription.status = 'active'::public.subscription_status
              AND (
                subscription.current_period_end IS NULL
                OR subscription.current_period_end > pg_catalog.now()
              )
          )
        )
        OR (
          post.visibility = 'ppv'::public.post_visibility
          AND EXISTS (
            SELECT 1 FROM public.ppv_unlocks unlock
            WHERE unlock.post_id = post.id AND unlock.user_id = viewer.id
          )
        )
        OR (
          post.visibility = 'goal'::public.post_visibility
          AND EXISTS (
            SELECT 1 FROM public.post_goals goal
            WHERE goal.post_id = post.id AND goal.is_unlocked
          )
          AND EXISTS (
            SELECT 1 FROM public.post_goal_contributions contribution
            WHERE contribution.post_id = post.id AND contribution.user_id = viewer.id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_post(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid)
  TO authenticated, service_role;

-- A linha do post e o progresso da meta permanecem consultáveis para que o
-- lead possa entender e participar. post_media e storage continuam usando a
-- função estrita can_view_post.
DROP POLICY IF EXISTS "Posts visíveis para adultos conforme acesso"
  ON public.posts;
CREATE POLICY "Posts visíveis para adultos conforme acesso"
  ON public.posts
  FOR SELECT
  TO authenticated
  USING (public.can_view_post_metadata(id, auth.uid()));

DROP POLICY IF EXISTS "Goals visíveis conforme acesso ao post"
  ON public.post_goals;
CREATE POLICY "Goals visíveis conforme acesso ao post"
  ON public.post_goals
  FOR SELECT
  TO authenticated
  USING (public.can_view_post_metadata(post_id, auth.uid()));

-- Mantém a RPC legada coerente com as mesmas regras. Ela pode listar o card,
-- porém só inclui corpo e caminho da mídia quando o acesso estrito existe.
CREATE OR REPLACE FUNCTION public.list_feed_posts(
  _creator_id uuid DEFAULT NULL,
  _viewer_id uuid DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  body text,
  visibility public.post_visibility,
  price_cents integer,
  likes_count integer,
  comments_count integer,
  created_at timestamptz,
  has_access boolean,
  media_id uuid,
  media_path text,
  media_mime text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH base AS (
    SELECT post.*
    FROM public.posts post
    WHERE (_creator_id IS NULL OR post.creator_id = _creator_id)
      AND post.archived_at IS NULL
      AND public.can_view_post_metadata(post.id, auth.uid())
    ORDER BY post.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 30), 1), 50)
  ),
  access_control AS (
    SELECT
      post.*,
      public.can_view_post(post.id, auth.uid()) AS has_access
    FROM base post
  ),
  first_media AS (
    SELECT DISTINCT ON (media.post_id)
      media.post_id,
      media.id,
      media.storage_path,
      media.mime_type
    FROM public.post_media media
    ORDER BY media.post_id, media.position ASC
  )
  SELECT
    post.id,
    post.creator_id,
    CASE WHEN post.has_access THEN post.body ELSE NULL END,
    post.visibility,
    post.price_cents,
    post.likes_count,
    post.comments_count,
    post.created_at,
    post.has_access,
    media.id,
    CASE WHEN post.has_access THEN media.storage_path ELSE NULL END,
    media.mime_type
  FROM access_control post
  LEFT JOIN first_media media ON media.post_id = post.id
  ORDER BY post.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_feed_posts(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_feed_posts(uuid, uuid, integer)
  TO authenticated;

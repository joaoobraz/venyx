-- Creator-controlled public profile visibility and Brazilian state blocking.
CREATE TABLE IF NOT EXISTS public.creator_profile_visibility (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_age boolean NOT NULL DEFAULT true,
  show_location boolean NOT NULL DEFAULT true,
  show_social_links boolean NOT NULL DEFAULT true,
  show_subscriber_count boolean NOT NULL DEFAULT true,
  show_ranking boolean NOT NULL DEFAULT true,
  show_verified_badge boolean NOT NULL DEFAULT true,
  show_wishlist boolean NOT NULL DEFAULT true,
  show_plans boolean NOT NULL DEFAULT true,
  show_comments boolean NOT NULL DEFAULT true,
  show_response_time boolean NOT NULL DEFAULT true,
  show_bio boolean NOT NULL DEFAULT true,
  show_category boolean NOT NULL DEFAULT true,
  show_like_count boolean NOT NULL DEFAULT true,
  show_post_count boolean NOT NULL DEFAULT true,
  show_activity_status boolean NOT NULL DEFAULT true,
  blocked_states text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT creator_profile_visibility_valid_states CHECK (
    blocked_states <@ ARRAY[
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
      'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
    ]::text[]
  )
);

ALTER TABLE public.creator_profile_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads creator visibility" ON public.creator_profile_visibility;
CREATE POLICY "Public reads creator visibility"
  ON public.creator_profile_visibility FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Creators manage own visibility" ON public.creator_profile_visibility;
CREATE POLICY "Creators manage own visibility"
  ON public.creator_profile_visibility FOR ALL
  TO authenticated
  USING (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  )
  WITH CHECK (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  );

DROP TRIGGER IF EXISTS update_creator_profile_visibility_updated_at
  ON public.creator_profile_visibility;
CREATE TRIGGER update_creator_profile_visibility_updated_at
  BEFORE UPDATE ON public.creator_profile_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.creator_profile_visibility TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.creator_profile_visibility TO authenticated;

CREATE OR REPLACE FUNCTION public.profile_state_code(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.upper(
    pg_catalog.substring(profile.location, '([A-Za-z]{2})[[:space:]]*$')
  )
  FROM public.profiles profile
  WHERE profile.user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.creator_allows_viewer(
  _creator_id uuid,
  _viewer_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    _creator_id IS NULL
    OR _viewer_id = _creator_id
    OR EXISTS (
      SELECT 1
      FROM public.user_roles role_row
      WHERE role_row.user_id = _viewer_id
        AND role_row.role = 'admin'::public.app_role
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.creator_profile_visibility visibility
      WHERE visibility.creator_id = _creator_id
        AND COALESCE(
          public.profile_state_code(_viewer_id) = ANY(visibility.blocked_states),
          false
        )
    );
$$;

REVOKE ALL ON FUNCTION public.profile_state_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_state_code(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.creator_allows_viewer(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_allows_viewer(uuid, uuid)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_view_profile(
  _profile_user_id uuid,
  _viewer_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.creator_allows_viewer(_profile_user_id, _viewer_id)
    AND (
      NOT public.is_account_paused(_profile_user_id)
      OR _viewer_id = _profile_user_id
      OR EXISTS (
        SELECT 1 FROM public.user_roles role_row
        WHERE role_row.user_id = _viewer_id
          AND role_row.role = 'admin'::public.app_role
      )
      OR EXISTS (
        SELECT 1 FROM public.subscriptions subscription
        WHERE subscription.subscriber_id = _viewer_id
          AND subscription.creator_id = _profile_user_id
          AND subscription.status = 'active'::public.subscription_status
          AND (
            subscription.current_period_end IS NULL
            OR subscription.current_period_end > pg_catalog.now()
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.chat_threads thread
        WHERE _viewer_id IN (thread.user_a, thread.user_b)
          AND _profile_user_id IN (thread.user_a, thread.user_b)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_profile(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid)
  TO anon, authenticated, service_role;

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
          AND (
            EXISTS (
              SELECT 1 FROM public.post_goals goal
              WHERE goal.post_id = post.id AND goal.is_unlocked
            )
            OR EXISTS (
              SELECT 1 FROM public.post_goal_contributions contribution
              WHERE contribution.post_id = post.id AND contribution.user_id = viewer.id
            )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_post(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid)
  TO authenticated, service_role;

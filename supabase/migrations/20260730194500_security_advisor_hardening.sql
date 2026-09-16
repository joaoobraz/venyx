-- =====================================================================
-- Venyx: least-privilege follow-up for Security Definer functions.
-- =====================================================================

-- RLS helpers must never trust an arbitrary user id supplied by a client.
-- service_role may check a specific account; regular requests are always
-- scoped to the authenticated account.
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = CASE
      WHEN auth.role() = 'service_role' THEN _user_id
      ELSE auth.uid()
    END
      AND role = _role
  );
$$;

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
    FROM public.posts p
    CROSS JOIN viewer v
    WHERE p.id = _post_id
      AND v.id IS NOT NULL
      AND public.is_age_verified(v.id)
      AND (
        p.creator_id = v.id
        OR p.visibility = 'public'::public.post_visibility
        OR (
          p.visibility = 'subscribers'::public.post_visibility
          AND EXISTS (
            SELECT 1
            FROM public.subscriptions s
            WHERE s.creator_id = p.creator_id
              AND s.subscriber_id = v.id
              AND s.status = 'active'::public.subscription_status
          )
        )
        OR (
          p.visibility = 'ppv'::public.post_visibility
          AND EXISTS (
            SELECT 1
            FROM public.ppv_unlocks u
            WHERE u.post_id = p.id
              AND u.user_id = v.id
          )
        )
        OR (
          p.visibility = 'goal'::public.post_visibility
          AND (
            EXISTS (
              SELECT 1
              FROM public.post_goals g
              WHERE g.post_id = p.id
                AND g.is_unlocked
            )
            OR EXISTS (
              SELECT 1
              FROM public.post_goal_contributions c
              WHERE c.post_id = p.id
                AND c.user_id = v.id
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_story_path(
  _path text,
  _viewer uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer AS (
    SELECT CASE
      WHEN auth.role() = 'service_role' THEN _viewer
      ELSE auth.uid()
    END AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.stories s
    CROSS JOIN viewer v
    WHERE s.media_path = _path
      AND v.id IS NOT NULL
      AND public.is_age_verified(v.id)
      AND s.expires_at > pg_catalog.now()
      AND (
        s.creator_id = v.id
        OR public.has_role(v.id, 'admin'::public.app_role)
        OR s.visibility = 'public'::public.story_visibility
        OR (
          s.visibility = 'subscribers'::public.story_visibility
          AND EXISTS (
            SELECT 1
            FROM public.subscriptions sub
            WHERE sub.creator_id = s.creator_id
              AND sub.subscriber_id = v.id
              AND sub.status = 'active'::public.subscription_status
          )
        )
      )
  );
$$;

-- Platform settings already have a read-only RLS policy. This helper does not
-- need owner privileges and therefore should execute as the caller.
ALTER FUNCTION public.get_platform_fee_pct() SECURITY INVOKER;
ALTER FUNCTION public.get_platform_fee_pct() SET search_path = '';

-- Remove the last lint warning from the loyalty routine while preserving its
-- behavior. Clients never receive EXECUTE on this function.
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  _user_id uuid,
  _creator_id uuid,
  _delta integer,
  _reason text,
  _ref_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _user_id IS NULL
     OR _creator_id IS NULL
     OR _user_id = _creator_id
     OR _delta = 0 THEN
    RETURN;
  END IF;

  IF _ref_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.loyalty_ledger
    WHERE user_id = _user_id
      AND creator_id = _creator_id
      AND reason = _reason
      AND ref_id = _ref_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.loyalty_ledger (
    user_id,
    creator_id,
    points_delta,
    reason,
    ref_id
  )
  VALUES (_user_id, _creator_id, _delta, _reason, _ref_id);

  INSERT INTO public.loyalty_points (
    user_id,
    creator_id,
    points,
    tier
  )
  VALUES (
    _user_id,
    _creator_id,
    CASE WHEN _delta > 0 THEN _delta ELSE 0 END,
    public.calc_loyalty_tier(
      CASE WHEN _delta > 0 THEN _delta ELSE 0 END
    )
  )
  ON CONFLICT (user_id, creator_id) DO UPDATE
    SET points = CASE
          WHEN public.loyalty_points.points + _delta > 0
            THEN public.loyalty_points.points + _delta
          ELSE 0
        END,
        tier = public.calc_loyalty_tier(
          CASE
            WHEN public.loyalty_points.points + _delta > 0
              THEN public.loyalty_points.points + _delta
            ELSE 0
          END
        ),
        updated_at = pg_catalog.now();
END;
$$;

-- Content metadata follows the same verified-adult rule as private storage.
DROP POLICY IF EXISTS "Posts são visíveis a todos" ON public.posts;
DROP POLICY IF EXISTS "Posts linha visível" ON public.posts;
DROP POLICY IF EXISTS "Posts visíveis conforme acesso" ON public.posts;
DROP POLICY IF EXISTS "Posts visíveis para adultos conforme acesso"
  ON public.posts;
CREATE POLICY "Posts visíveis para adultos conforme acesso"
  ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND public.can_view_post(id, auth.uid())
  );

DROP POLICY IF EXISTS "Mídia visível a todos" ON public.post_media;
DROP POLICY IF EXISTS "Mídia linha visível" ON public.post_media;
DROP POLICY IF EXISTS "Mídia visível com acesso" ON public.post_media;
DROP POLICY IF EXISTS "Mídia visível conforme acesso ao post"
  ON public.post_media;
DROP POLICY IF EXISTS "Mídia visível para adultos conforme acesso"
  ON public.post_media;
CREATE POLICY "Mídia visível para adultos conforme acesso"
  ON public.post_media
  FOR SELECT
  TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND public.can_view_post(post_id, auth.uid())
  );

-- SECURITY DEFINER functions default to PUBLIC execution in PostgreSQL.
-- Reset every such function to service_role, then explicitly reopen only the
-- audited RPCs/helpers required by authenticated application flows.
DO $$
DECLARE
  _function regprocedure;
BEGIN
  FOR _function IN
    SELECT p.oid::regprocedure
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      _function
    );
    EXECUTE pg_catalog.format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      _function
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_age_verified(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_story_path(text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_path_to_post_id(text)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_feed_posts(uuid, uuid, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_thread_messages_verified(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_mass_dm(
  public.mass_dm_segment,
  uuid,
  text,
  text,
  text,
  integer,
  timestamptz,
  uuid,
  integer,
  boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_mass_dm_recipients(
  public.mass_dm_segment,
  uuid,
  integer,
  boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mass_dm_campaign_revenue(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_platform_fee_pct()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_fee_pct()
  TO authenticated, service_role;

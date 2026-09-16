-- Temporary account pause with immediate visibility and commerce enforcement.
-- Existing subscription dates are intentionally never shifted by this feature.

CREATE TABLE IF NOT EXISTS public.account_lifecycle (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  paused_at timestamptz,
  reactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_pause_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('paused', 'reactivated')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_pause_events_user_created_idx
  ON public.account_pause_events(user_id, created_at DESC);

ALTER TABLE public.account_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_pause_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own account lifecycle" ON public.account_lifecycle;
CREATE POLICY "Users read own account lifecycle"
  ON public.account_lifecycle FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own account pause events" ON public.account_pause_events;
CREATE POLICY "Users read own account pause events"
  ON public.account_pause_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.account_lifecycle FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.account_pause_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_account_paused(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_lifecycle lifecycle
    WHERE lifecycle.user_id = _user_id
      AND lifecycle.status = 'paused'
  );
$$;

REVOKE ALL ON FUNCTION public.is_account_paused(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_paused(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_my_account_paused(_paused boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _current_status text;
  _row public.account_lifecycle%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'VENYX_AUTH_REQUIRED';
  END IF;

  INSERT INTO public.account_lifecycle (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT status INTO _current_status
  FROM public.account_lifecycle
  WHERE user_id = _user_id
  FOR UPDATE;

  IF (_paused AND _current_status = 'paused')
     OR (NOT _paused AND _current_status = 'active') THEN
    SELECT * INTO _row
    FROM public.account_lifecycle
    WHERE user_id = _user_id;
    RETURN jsonb_build_object(
      'paused', _row.status = 'paused',
      'paused_at', _row.paused_at,
      'reactivated_at', _row.reactivated_at
    );
  END IF;

  IF _paused THEN
    UPDATE public.account_lifecycle
    SET status = 'paused',
        paused_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE user_id = _user_id
    RETURNING * INTO _row;

    -- A pending QR must not become a surprise purchase after the account pauses.
    UPDATE public.pix_charges
    SET status = 'cancelled'
    WHERE status IN ('pending'::public.pix_charge_status, 'processing'::public.pix_charge_status)
      AND (payer_id = _user_id OR payee_id = _user_id);

    INSERT INTO public.account_pause_events (user_id, action)
    VALUES (_user_id, 'paused');
  ELSE
    UPDATE public.account_lifecycle
    SET status = 'active',
        reactivated_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE user_id = _user_id
    RETURNING * INTO _row;

    INSERT INTO public.account_pause_events (user_id, action)
    VALUES (_user_id, 'reactivated');
  END IF;

  RETURN jsonb_build_object(
    'paused', _row.status = 'paused',
    'paused_at', _row.paused_at,
    'reactivated_at', _row.reactivated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_account_paused(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_account_paused(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_paused_pix_charge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_account_paused(NEW.payer_id)
     OR public.is_account_paused(NEW.payee_id) THEN
    RAISE EXCEPTION 'VENYX_ACCOUNT_PAUSED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_paused_pix_charge ON public.pix_charges;
CREATE TRIGGER guard_paused_pix_charge
  BEFORE INSERT ON public.pix_charges
  FOR EACH ROW EXECUTE FUNCTION public.guard_paused_pix_charge();

CREATE OR REPLACE FUNCTION public.guard_paused_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _starts_or_extends boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _starts_or_extends := true;
  ELSE
    _starts_or_extends := (
      NEW.status = 'active'::public.subscription_status
      AND (
        OLD.status IS DISTINCT FROM NEW.status
        OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
           AND NEW.current_period_end > OLD.current_period_end
      )
    );
  END IF;

  IF _starts_or_extends
     AND (
       public.is_account_paused(NEW.subscriber_id)
       OR public.is_account_paused(NEW.creator_id)
     ) THEN
    RAISE EXCEPTION 'VENYX_ACCOUNT_PAUSED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_paused_subscription ON public.subscriptions;
CREATE TRIGGER guard_paused_subscription
  BEFORE INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_paused_subscription();

CREATE OR REPLACE FUNCTION public.guard_paused_chat_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_account_paused(NEW.user_a)
     OR public.is_account_paused(NEW.user_b) THEN
    RAISE EXCEPTION 'VENYX_ACCOUNT_PAUSED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_paused_chat_thread ON public.chat_threads;
CREATE TRIGGER guard_paused_chat_thread
  BEFORE INSERT ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.guard_paused_chat_thread();

CREATE OR REPLACE FUNCTION public.guard_paused_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _other_id uuid;
  _content_changed boolean := true;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    _content_changed := NEW.body IS DISTINCT FROM OLD.body
      OR NEW.media_path IS DISTINCT FROM OLD.media_path
      OR NEW.ppv_price_cents IS DISTINCT FROM OLD.ppv_price_cents;
  END IF;
  IF NOT _content_changed THEN RETURN NEW; END IF;

  SELECT CASE WHEN thread.user_a = NEW.sender_id THEN thread.user_b ELSE thread.user_a END
  INTO _other_id
  FROM public.chat_threads thread
  WHERE thread.id = NEW.thread_id
    AND NEW.sender_id IN (thread.user_a, thread.user_b);

  IF _other_id IS NULL
     OR public.is_account_paused(NEW.sender_id)
     OR public.is_account_paused(_other_id) THEN
    RAISE EXCEPTION 'VENYX_ACCOUNT_PAUSED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_paused_chat_message ON public.chat_messages;
CREATE TRIGGER guard_paused_chat_message
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_paused_chat_message();

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
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_profile(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Users read own account lifecycle" ON public.account_lifecycle;
CREATE POLICY "Users read visible account lifecycle"
  ON public.account_lifecycle FOR SELECT TO authenticated
  USING (public.can_view_profile(user_id, auth.uid()));

DROP POLICY IF EXISTS "Profiles are publicly viewable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles respect temporary pause" ON public.profiles;
CREATE POLICY "Profiles respect temporary pause"
  ON public.profiles FOR SELECT
  USING (public.can_view_profile(user_id, auth.uid()));

-- Hide public content from discovery during a pause while retaining already-paid access.
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

REVOKE ALL ON FUNCTION public.guard_paused_pix_charge() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_paused_subscription() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_paused_chat_thread() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_paused_chat_message() FROM PUBLIC;

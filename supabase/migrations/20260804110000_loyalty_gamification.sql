-- Gamificação de fidelidade: nível global, VIP, benefícios configuráveis,
-- limite de interações, resgates auditáveis e reversão em estornos.

ALTER TABLE public.loyalty_points
  DROP CONSTRAINT IF EXISTS loyalty_points_tier_check;
ALTER TABLE public.loyalty_points
  ADD CONSTRAINT loyalty_points_tier_check
  CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond', 'vip'));

CREATE OR REPLACE FUNCTION public.calc_loyalty_tier(_points integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _points >= 2500 THEN 'vip'
    WHEN _points >= 1200 THEN 'diamond'
    WHEN _points >= 500 THEN 'gold'
    WHEN _points >= 150 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_tier_rank(_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE _tier
    WHEN 'vip' THEN 5
    WHEN 'diamond' THEN 4
    WHEN 'gold' THEN 3
    WHEN 'silver' THEN 2
    ELSE 1
  END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_reference_unique
  ON public.loyalty_ledger(user_id, creator_id, reason, ref_id)
  WHERE ref_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.loyalty_global_points (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  tier text NOT NULL DEFAULT 'bronze'
    CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond', 'vip')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  interaction_points_enabled boolean NOT NULL DEFAULT true,
  show_global_tier boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 80),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 2 AND 240),
  reward_type text NOT NULL CHECK (
    reward_type IN (
      'renewal_discount',
      'ppv_coupon',
      'exclusive_content',
      'personal_message',
      'early_access',
      'fan_badge'
    )
  ),
  minimum_tier text NOT NULL CHECK (
    minimum_tier IN ('bronze', 'silver', 'gold', 'diamond', 'vip')
  ),
  stock integer CHECK (stock IS NULL OR stock > 0),
  redeemed_count integer NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (stock IS NULL OR redeemed_count <= stock)
);

CREATE INDEX IF NOT EXISTS loyalty_rewards_creator_active_idx
  ON public.loyalty_rewards(creator_id, active, minimum_tier);

CREATE TABLE IF NOT EXISTS public.loyalty_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'used', 'expired', 'revoked')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (reward_id, user_id)
);

CREATE INDEX IF NOT EXISTS loyalty_claims_user_created_idx
  ON public.loyalty_reward_claims(user_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_claims_creator_created_idx
  ON public.loyalty_reward_claims(creator_id, claimed_at DESC);

CREATE OR REPLACE FUNCTION public.touch_loyalty_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_loyalty_program_updated_at ON public.loyalty_programs;
CREATE TRIGGER touch_loyalty_program_updated_at
  BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_loyalty_updated_at();

DROP TRIGGER IF EXISTS touch_loyalty_reward_updated_at ON public.loyalty_rewards;
CREATE TRIGGER touch_loyalty_reward_updated_at
  BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.touch_loyalty_updated_at();

ALTER TABLE public.loyalty_global_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_reward_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global loyalty owner or subscribed creator read"
  ON public.loyalty_global_points;
CREATE POLICY "Global loyalty owner or subscribed creator read"
  ON public.loyalty_global_points FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.subscriptions subscription
      WHERE subscription.subscriber_id = loyalty_global_points.user_id
        AND subscription.creator_id = auth.uid()
        AND subscription.status = 'active'::public.subscription_status
    )
  );

DROP POLICY IF EXISTS "Loyalty programs subscribed read" ON public.loyalty_programs;
CREATE POLICY "Loyalty programs subscribed read"
  ON public.loyalty_programs FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.subscriptions subscription
      WHERE subscription.creator_id = loyalty_programs.creator_id
        AND subscription.subscriber_id = auth.uid()
        AND subscription.status = 'active'::public.subscription_status
    )
  );

DROP POLICY IF EXISTS "Creators create loyalty program" ON public.loyalty_programs;
CREATE POLICY "Creators create loyalty program"
  ON public.loyalty_programs FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  );

DROP POLICY IF EXISTS "Creators update loyalty program" ON public.loyalty_programs;
CREATE POLICY "Creators update loyalty program"
  ON public.loyalty_programs FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  )
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Loyalty rewards eligible read" ON public.loyalty_rewards;
CREATE POLICY "Loyalty rewards eligible read"
  ON public.loyalty_rewards FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR (
      active
      AND (expires_at IS NULL OR expires_at > pg_catalog.now())
      AND EXISTS (
        SELECT 1 FROM public.loyalty_programs program
        WHERE program.creator_id = loyalty_rewards.creator_id AND program.enabled
      )
      AND EXISTS (
        SELECT 1 FROM public.subscriptions subscription
        WHERE subscription.creator_id = loyalty_rewards.creator_id
          AND subscription.subscriber_id = auth.uid()
          AND subscription.status = 'active'::public.subscription_status
      )
    )
  );

DROP POLICY IF EXISTS "Creators create loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Creators create loyalty rewards"
  ON public.loyalty_rewards FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  );

DROP POLICY IF EXISTS "Creators update loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Creators update loyalty rewards"
  ON public.loyalty_rewards FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  )
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Loyalty claims participants read" ON public.loyalty_reward_claims;
CREATE POLICY "Loyalty claims participants read"
  ON public.loyalty_reward_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR creator_id = auth.uid());

DROP POLICY IF EXISTS "Creators update loyalty claims" ON public.loyalty_reward_claims;
CREATE POLICY "Creators update loyalty claims"
  ON public.loyalty_reward_claims FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  )
  WITH CHECK (creator_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.loyalty_global_points FROM anon, authenticated;
REVOKE DELETE ON public.loyalty_programs, public.loyalty_rewards FROM anon, authenticated;
REVOKE INSERT, DELETE ON public.loyalty_reward_claims FROM anon, authenticated;

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

  -- A creator can pause new accruals without blocking refund reversals.
  IF _delta > 0 AND EXISTS (
    SELECT 1 FROM public.loyalty_programs program
    WHERE program.creator_id = _creator_id AND NOT program.enabled
  ) THEN
    RETURN;
  END IF;

  IF _ref_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.loyalty_ledger
    WHERE user_id = _user_id
      AND creator_id = _creator_id
      AND reason = _reason
      AND ref_id = _ref_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.loyalty_ledger (
    user_id, creator_id, points_delta, reason, ref_id
  ) VALUES (
    _user_id, _creator_id, _delta, _reason, _ref_id
  )
  ON CONFLICT (user_id, creator_id, reason, ref_id)
    WHERE ref_id IS NOT NULL DO NOTHING;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.loyalty_points (user_id, creator_id, points, tier)
  VALUES (
    _user_id,
    _creator_id,
    GREATEST(_delta, 0),
    public.calc_loyalty_tier(GREATEST(_delta, 0))
  )
  ON CONFLICT (user_id, creator_id) DO UPDATE
    SET points = GREATEST(public.loyalty_points.points + _delta, 0),
        tier = public.calc_loyalty_tier(
          GREATEST(public.loyalty_points.points + _delta, 0)
        ),
        updated_at = pg_catalog.now();

  INSERT INTO public.loyalty_global_points (user_id, points, tier)
  VALUES (
    _user_id,
    GREATEST(_delta, 0),
    public.calc_loyalty_tier(GREATEST(_delta, 0))
  )
  ON CONFLICT (user_id) DO UPDATE
    SET points = GREATEST(public.loyalty_global_points.points + _delta, 0),
        tier = public.calc_loyalty_tier(
          GREATEST(public.loyalty_global_points.points + _delta, 0)
        ),
        updated_at = pg_catalog.now();
END;
$$;

REVOKE ALL ON FUNCTION public.award_loyalty_points(uuid, uuid, integer, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(uuid, uuid, integer, text, uuid)
  TO service_role;

INSERT INTO public.loyalty_global_points (user_id, points, tier)
SELECT user_id, pg_catalog.sum(points)::integer, public.calc_loyalty_tier(pg_catalog.sum(points)::integer)
FROM public.loyalty_points
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
SET points = EXCLUDED.points,
    tier = EXCLUDED.tier,
    updated_at = pg_catalog.now();

UPDATE public.loyalty_points
SET tier = public.calc_loyalty_tier(points),
    updated_at = pg_catalog.now()
WHERE tier IS DISTINCT FROM public.calc_loyalty_tier(points);

CREATE OR REPLACE FUNCTION public.award_engagement_loyalty_points(
  _user_id uuid,
  _creator_id uuid,
  _requested_delta integer,
  _reason text,
  _ref_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _used integer;
  _delta integer;
BEGIN
  IF _requested_delta <= 0 OR _reason NOT IN ('post_like', 'post_comment') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.loyalty_programs program
    WHERE program.creator_id = _creator_id
      AND program.enabled
      AND program.interaction_points_enabled
  ) OR NOT EXISTS (
    SELECT 1 FROM public.subscriptions subscription
    WHERE subscription.subscriber_id = _user_id
      AND subscription.creator_id = _creator_id
      AND subscription.status = 'active'::public.subscription_status
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(pg_catalog.sum(points_delta), 0)::integer
  INTO _used
  FROM public.loyalty_ledger
  WHERE user_id = _user_id
    AND creator_id = _creator_id
    AND reason IN ('post_like', 'post_comment')
    AND created_at >= pg_catalog.date_trunc('week', pg_catalog.now());

  _delta := LEAST(_requested_delta, GREATEST(10 - _used, 0));
  IF _delta > 0 THEN
    PERFORM public.award_loyalty_points(
      _user_id, _creator_id, _delta, _reason, _ref_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.award_engagement_loyalty_points(
  uuid, uuid, integer, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_engagement_loyalty_points(
  uuid, uuid, integer, text, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_post_like_loyalty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _creator_id uuid;
BEGIN
  SELECT creator_id INTO _creator_id FROM public.posts WHERE id = NEW.post_id;
  IF _creator_id IS NOT NULL THEN
    PERFORM public.award_engagement_loyalty_points(
      NEW.user_id, _creator_id, 1, 'post_like', NEW.post_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_loyalty_on_post_like ON public.post_likes;
CREATE TRIGGER award_loyalty_on_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_like_loyalty();

CREATE OR REPLACE FUNCTION public.trg_post_comment_loyalty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _creator_id uuid;
BEGIN
  SELECT creator_id INTO _creator_id FROM public.posts WHERE id = NEW.post_id;
  IF _creator_id IS NOT NULL THEN
    PERFORM public.award_engagement_loyalty_points(
      NEW.user_id, _creator_id, 2, 'post_comment', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_loyalty_on_post_comment ON public.post_comments;
CREATE TRIGGER award_loyalty_on_post_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_comment_loyalty();

CREATE OR REPLACE FUNCTION public.trg_ppv_unlock_award_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _creator uuid;
BEGIN
  SELECT creator_id INTO _creator FROM public.posts WHERE id = NEW.post_id;
  IF _creator IS NOT NULL THEN
    PERFORM public.award_loyalty_points(
      NEW.user_id, _creator, NEW.amount_cents / 100, 'ppv_post', NEW.id
    );
    PERFORM public.award_loyalty_points(
      NEW.user_id, _creator, 5, 'ppv_bonus', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_chat_ppv_unlock_award_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _creator uuid;
BEGIN
  SELECT sender_id INTO _creator FROM public.chat_messages WHERE id = NEW.message_id;
  IF _creator IS NOT NULL THEN
    PERFORM public.award_loyalty_points(
      NEW.user_id, _creator, NEW.amount_cents / 100, 'ppv_chat', NEW.message_id
    );
    PERFORM public.award_loyalty_points(
      NEW.user_id, _creator, 5, 'ppv_chat_bonus', NEW.message_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pix_paid_award_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'paid'::public.pix_charge_status
     AND OLD.status IS DISTINCT FROM 'paid'::public.pix_charge_status
     AND NEW.purpose IN (
       'subscription'::public.pix_charge_purpose,
       'tip'::public.pix_charge_purpose,
       'goal'::public.pix_charge_purpose
     ) THEN
    PERFORM public.award_loyalty_points(
      NEW.payer_id,
      NEW.payee_id,
      NEW.amount_cents / 100,
      'pix_' || NEW.purpose::text,
      NEW.id
    );

    IF NEW.purpose = 'subscription'::public.pix_charge_purpose
       AND EXISTS (
         SELECT 1 FROM public.pix_charges previous
         WHERE previous.id <> NEW.id
           AND previous.payer_id = NEW.payer_id
           AND previous.payee_id = NEW.payee_id
           AND previous.purpose = 'subscription'::public.pix_charge_purpose
           AND previous.status = 'paid'::public.pix_charge_status
       ) THEN
      PERFORM public.award_loyalty_points(
        NEW.payer_id, NEW.payee_id, 25, 'renewal_streak', NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pix_refund_reverse_loyalty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _entry record;
BEGIN
  IF NEW.status = 'refunded'::public.pix_charge_status
     AND OLD.status = 'paid'::public.pix_charge_status THEN
    FOR _entry IN
      SELECT creator_id, user_id, points_delta, reason
      FROM public.loyalty_ledger
      WHERE ref_id = NEW.id
        AND points_delta > 0
        AND reason IN ('pix_subscription', 'pix_tip', 'pix_goal', 'renewal_streak')
    LOOP
      PERFORM public.award_loyalty_points(
        _entry.user_id,
        _entry.creator_id,
        -_entry.points_delta,
        'refund_' || _entry.reason,
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reverse_loyalty_on_pix_refund ON public.pix_charges;
CREATE TRIGGER reverse_loyalty_on_pix_refund
  AFTER UPDATE OF status ON public.pix_charges
  FOR EACH ROW EXECUTE FUNCTION public.trg_pix_refund_reverse_loyalty();

CREATE OR REPLACE FUNCTION public.trg_ppv_unlock_reverse_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _creator uuid;
BEGIN
  SELECT creator_id INTO _creator FROM public.posts WHERE id = OLD.post_id;
  IF _creator IS NOT NULL THEN
    PERFORM public.award_loyalty_points(
      OLD.user_id, _creator, -(OLD.amount_cents / 100), 'refund_ppv_post', OLD.id
    );
    PERFORM public.award_loyalty_points(
      OLD.user_id, _creator, -5, 'refund_ppv_bonus', OLD.id
    );
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS reverse_loyalty_on_ppv_unlock_delete ON public.ppv_unlocks;
CREATE TRIGGER reverse_loyalty_on_ppv_unlock_delete
  AFTER DELETE ON public.ppv_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.trg_ppv_unlock_reverse_points();

CREATE OR REPLACE FUNCTION public.trg_chat_ppv_unlock_reverse_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _creator uuid;
BEGIN
  SELECT sender_id INTO _creator FROM public.chat_messages WHERE id = OLD.message_id;
  IF _creator IS NOT NULL THEN
    PERFORM public.award_loyalty_points(
      OLD.user_id, _creator, -(OLD.amount_cents / 100), 'refund_ppv_chat', OLD.message_id
    );
    PERFORM public.award_loyalty_points(
      OLD.user_id, _creator, -5, 'refund_ppv_chat_bonus', OLD.message_id
    );
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS reverse_loyalty_on_chat_ppv_unlock_delete ON public.chat_ppv_unlocks;
CREATE TRIGGER reverse_loyalty_on_chat_ppv_unlock_delete
  AFTER DELETE ON public.chat_ppv_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.trg_chat_ppv_unlock_reverse_points();

CREATE OR REPLACE FUNCTION public.claim_loyalty_reward(_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _reward public.loyalty_rewards%ROWTYPE;
  _tier text;
  _claim_id uuid;
BEGIN
  IF _viewer IS NULL THEN
    RAISE EXCEPTION 'VENYX_AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _reward
  FROM public.loyalty_rewards
  WHERE id = _reward_id
  FOR UPDATE;

  IF NOT FOUND OR NOT _reward.active
     OR (_reward.expires_at IS NOT NULL AND _reward.expires_at <= pg_catalog.now()) THEN
    RAISE EXCEPTION 'VENYX_REWARD_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.loyalty_programs program
    WHERE program.creator_id = _reward.creator_id AND program.enabled
  ) OR NOT EXISTS (
    SELECT 1 FROM public.subscriptions subscription
    WHERE subscription.creator_id = _reward.creator_id
      AND subscription.subscriber_id = _viewer
      AND subscription.status = 'active'::public.subscription_status
  ) THEN
    RAISE EXCEPTION 'VENYX_REWARD_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT tier INTO _tier
  FROM public.loyalty_points
  WHERE user_id = _viewer AND creator_id = _reward.creator_id;

  IF public.loyalty_tier_rank(COALESCE(_tier, 'bronze'))
     < public.loyalty_tier_rank(_reward.minimum_tier) THEN
    RAISE EXCEPTION 'VENYX_REWARD_TIER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO _claim_id
  FROM public.loyalty_reward_claims
  WHERE reward_id = _reward.id AND user_id = _viewer;

  IF _claim_id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'already_claimed', true, 'claim_id', _claim_id
    );
  END IF;

  IF _reward.stock IS NOT NULL AND _reward.redeemed_count >= _reward.stock THEN
    RAISE EXCEPTION 'VENYX_REWARD_SOLD_OUT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.loyalty_reward_claims (
    reward_id, creator_id, user_id
  ) VALUES (
    _reward.id, _reward.creator_id, _viewer
  ) RETURNING id INTO _claim_id;

  UPDATE public.loyalty_rewards
  SET redeemed_count = redeemed_count + 1
  WHERE id = _reward.id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'already_claimed', false, 'claim_id', _claim_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_loyalty_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_loyalty_reward(uuid) TO authenticated, service_role;

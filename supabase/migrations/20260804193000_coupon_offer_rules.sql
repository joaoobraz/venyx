-- Ofertas de assinatura por link: benefícios, elegibilidade, expiração e auditoria.

ALTER TABLE public.subscription_coupons
  ADD COLUMN IF NOT EXISTS offer_type text,
  ADD COLUMN IF NOT EXISTS discount_amount_cents integer,
  ADD COLUMN IF NOT EXISTS normal_price_snapshot_cents integer,
  ADD COLUMN IF NOT EXISTS post_trial_price_cents integer,
  ADD COLUMN IF NOT EXISTS auto_renew_after_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligibility text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_only boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_uses_per_user integer NOT NULL DEFAULT 1;

UPDATE public.subscription_coupons
SET offer_type = CASE
  WHEN trial_days IS NOT NULL THEN 'trial'
  WHEN discount_pct IS NOT NULL THEN 'percentage_discount'
  ELSE 'special_price'
END
WHERE offer_type IS NULL;

UPDATE public.subscription_coupons
SET eligibility = CASE
  WHEN new_subscribers_only THEN 'new_subscribers'
  ELSE 'new_and_former'
END
WHERE eligibility IS NULL;

ALTER TABLE public.subscription_coupons
  ALTER COLUMN offer_type SET DEFAULT 'special_price',
  ALTER COLUMN offer_type SET NOT NULL,
  ALTER COLUMN eligibility SET DEFAULT 'new_subscribers',
  ALTER COLUMN eligibility SET NOT NULL;

ALTER TABLE public.subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_exactly_one_benefit_check,
  DROP CONSTRAINT IF EXISTS subscription_coupons_offer_type_check,
  DROP CONSTRAINT IF EXISTS subscription_coupons_eligibility_check,
  DROP CONSTRAINT IF EXISTS subscription_coupons_discount_amount_check,
  DROP CONSTRAINT IF EXISTS subscription_coupons_normal_price_check,
  DROP CONSTRAINT IF EXISTS subscription_coupons_post_trial_price_check,
  DROP CONSTRAINT IF EXISTS subscription_coupons_max_uses_per_user_check;

ALTER TABLE public.subscription_coupons
  ADD CONSTRAINT subscription_coupons_offer_type_check CHECK (
    offer_type IN (
      'percentage_discount',
      'fixed_discount',
      'first_month',
      'special_price',
      'trial'
    )
  ),
  ADD CONSTRAINT subscription_coupons_eligibility_check CHECK (
    eligibility IN ('new_subscribers', 'former_subscribers', 'new_and_former')
  ),
  ADD CONSTRAINT subscription_coupons_discount_amount_check CHECK (
    discount_amount_cents IS NULL OR discount_amount_cents >= 100
  ),
  ADD CONSTRAINT subscription_coupons_normal_price_check CHECK (
    normal_price_snapshot_cents IS NULL OR normal_price_snapshot_cents >= 100
  ),
  ADD CONSTRAINT subscription_coupons_post_trial_price_check CHECK (
    post_trial_price_cents IS NULL OR post_trial_price_cents >= 100
  ),
  ADD CONSTRAINT subscription_coupons_max_uses_per_user_check CHECK (
    max_uses_per_user = 1
  ),
  ADD CONSTRAINT subscription_coupons_exactly_one_benefit_check CHECK (
    (offer_type = 'trial'
      AND trial_days IS NOT NULL
      AND discount_pct IS NULL
      AND fixed_price_cents IS NULL
      AND discount_amount_cents IS NULL)
    OR
    (offer_type = 'percentage_discount'
      AND trial_days IS NULL
      AND discount_pct IS NOT NULL
      AND fixed_price_cents IS NULL
      AND discount_amount_cents IS NULL)
    OR
    (offer_type = 'fixed_discount'
      AND trial_days IS NULL
      AND discount_pct IS NULL
      AND fixed_price_cents IS NULL
      AND discount_amount_cents IS NOT NULL)
    OR
    (offer_type IN ('first_month', 'special_price')
      AND trial_days IS NULL
      AND discount_pct IS NULL
      AND fixed_price_cents IS NOT NULL
      AND discount_amount_cents IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_subscription_coupons_expiration
  ON public.subscription_coupons(expires_at)
  WHERE is_active;

ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS subscription_id uuid
  REFERENCES public.subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_subscription
  ON public.coupon_redemptions(subscription_id)
  WHERE subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.link_coupon_redemption_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.subscription_id IS NULL THEN
    SELECT s.id
    INTO NEW.subscription_id
    FROM public.subscriptions s
    JOIN public.subscription_coupons c
      ON c.id = NEW.coupon_id
     AND c.creator_id = s.creator_id
    WHERE s.subscriber_id = NEW.user_id
    ORDER BY s.current_period_start DESC NULLS LAST, s.created_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_coupon_redemption_subscription
  ON public.coupon_redemptions;
CREATE TRIGGER trg_link_coupon_redemption_subscription
BEFORE INSERT ON public.coupon_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.link_coupon_redemption_subscription();

REVOKE ALL ON FUNCTION public.link_coupon_redemption_subscription() FROM PUBLIC;

-- Reserva a vaga de forma atômica. Usos confirmados e PIX pendentes contam
-- juntos, impedindo que uma oferta de 10 vagas aceite a 11ª pessoa.
CREATE OR REPLACE FUNCTION public.reserve_coupon_use(
  _coupon_id uuid,
  _user_id uuid,
  _pix_charge_id uuid,
  _expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _coupon public.subscription_coupons%ROWTYPE;
  _reservation public.coupon_reservations%ROWTYPE;
  _active_reservations integer := 0;
  _reservation_id uuid;
BEGIN
  SELECT * INTO _coupon
  FROM public.subscription_coupons
  WHERE id = _coupon_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT _coupon.is_active
     OR (_coupon.expires_at IS NOT NULL AND _coupon.expires_at <= pg_catalog.now()) THEN
    RAISE EXCEPTION 'VENYX_COUPON_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = _coupon_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'VENYX_COUPON_ALREADY_USED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _reservation
  FROM public.coupon_reservations
  WHERE coupon_id = _coupon_id AND user_id = _user_id
  FOR UPDATE;

  IF FOUND AND _reservation.status = 'reserved' AND _reservation.expires_at > pg_catalog.now() THEN
    RAISE EXCEPTION 'VENYX_COUPON_ALREADY_RESERVED' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::integer INTO _active_reservations
  FROM public.coupon_reservations
  WHERE coupon_id = _coupon_id
    AND status = 'reserved'
    AND expires_at > pg_catalog.now();

  IF _coupon.max_uses <> 0
     AND _coupon.uses_count + _active_reservations >= _coupon.max_uses THEN
    RAISE EXCEPTION 'VENYX_COUPON_SOLD_OUT' USING ERRCODE = 'P0001';
  END IF;

  IF FOUND THEN
    UPDATE public.coupon_reservations
    SET
      pix_charge_id = _pix_charge_id,
      status = 'reserved',
      expires_at = GREATEST(_expires_at, pg_catalog.now() + pg_catalog.make_interval(mins => 1)),
      updated_at = pg_catalog.now()
    WHERE id = _reservation.id
    RETURNING id INTO _reservation_id;
  ELSE
    INSERT INTO public.coupon_reservations (
      coupon_id, user_id, pix_charge_id, status, expires_at
    ) VALUES (
      _coupon_id,
      _user_id,
      _pix_charge_id,
      'reserved',
      GREATEST(_expires_at, pg_catalog.now() + pg_catalog.make_interval(mins => 1))
    ) RETURNING id INTO _reservation_id;
  END IF;

  RETURN _reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_coupon_use(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_coupon_use(uuid, uuid, uuid, timestamptz)
  TO service_role;

-- Trial: valida público, validade, limite e uso anterior na mesma transação.
CREATE OR REPLACE FUNCTION public.activate_coupon_trial(
  _creator_id uuid,
  _subscriber_id uuid,
  _coupon_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _coupon public.subscription_coupons%ROWTYPE;
  _subscription_id uuid;
  _period_end timestamptz;
  _was_subscriber boolean;
BEGIN
  IF _creator_id IS NULL OR _subscriber_id IS NULL OR _coupon_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('error', 'invalid_coupon');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_subscriber_id::text || ':' || _creator_id::text, 6161)
  );

  SELECT * INTO _coupon
  FROM public.subscription_coupons
  WHERE id = _coupon_id AND creator_id = _creator_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT _coupon.is_active
     OR _coupon.offer_type <> 'trial'
     OR _coupon.trial_days IS NULL
     OR (_coupon.expires_at IS NOT NULL AND _coupon.expires_at <= pg_catalog.now())
     OR (_coupon.max_uses <> 0 AND _coupon.uses_count >= _coupon.max_uses) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'invalid_coupon');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = _coupon_id AND user_id = _subscriber_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'coupon_already_used');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriber_id = _subscriber_id
      AND creator_id = _creator_id
      AND status = 'active'::public.subscription_status
  ) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'already_subscribed');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriber_id = _subscriber_id AND creator_id = _creator_id
  ) INTO _was_subscriber;

  IF (_coupon.eligibility = 'new_subscribers' AND _was_subscriber)
     OR (_coupon.eligibility = 'former_subscribers' AND NOT _was_subscriber) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'not_eligible');
  END IF;

  _period_end := pg_catalog.now() + pg_catalog.make_interval(days => _coupon.trial_days);

  INSERT INTO public.subscriptions (
    subscriber_id, creator_id, price_cents, status,
    current_period_start, current_period_end, is_trial, months
  ) VALUES (
    _subscriber_id, _creator_id, 0, 'active'::public.subscription_status,
    pg_catalog.now(), _period_end, true, 0
  )
  ON CONFLICT (subscriber_id, creator_id) DO UPDATE SET
    price_cents = EXCLUDED.price_cents,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    is_trial = EXCLUDED.is_trial,
    months = EXCLUDED.months
  RETURNING id INTO _subscription_id;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, subscription_id)
  VALUES (_coupon_id, _subscriber_id, _subscription_id);

  UPDATE public.subscription_coupons
  SET uses_count = uses_count + 1
  WHERE id = _coupon_id;

  RETURN pg_catalog.jsonb_build_object(
    'subscription_id', _subscription_id,
    'trial_days', _coupon.trial_days,
    'auto_renew_after_trial', _coupon.auto_renew_after_trial,
    'post_trial_price_cents', _coupon.post_trial_price_cents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_coupon_trial(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_coupon_trial(uuid, uuid, uuid)
  TO service_role;

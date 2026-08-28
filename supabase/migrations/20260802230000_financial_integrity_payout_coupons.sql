-- Integridade financeira: quarentena de chave Pix e reservas atômicas de cupom.

ALTER TABLE public.creator_payout_keys
  ADD COLUMN IF NOT EXISTS key_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS withdrawal_eligible_at timestamptz NOT NULL DEFAULT now();

-- Chaves que já existiam antes desta regra continuam disponíveis.
UPDATE public.creator_payout_keys
SET
  key_changed_at = COALESCE(updated_at, created_at, now()),
  withdrawal_eligible_at = now();

CREATE OR REPLACE FUNCTION public.set_payout_key_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.key_changed_at := pg_catalog.now();
    NEW.withdrawal_eligible_at := pg_catalog.now();
  ELSIF NEW.pix_key IS DISTINCT FROM OLD.pix_key
     OR NEW.pix_key_type IS DISTINCT FROM OLD.pix_key_type
     OR NEW.holder_name IS DISTINCT FROM OLD.holder_name
     OR NEW.holder_document IS DISTINCT FROM OLD.holder_document THEN
    NEW.key_changed_at := pg_catalog.now();
    NEW.withdrawal_eligible_at := pg_catalog.now() + pg_catalog.make_interval(hours => 48);
  ELSE
    NEW.key_changed_at := OLD.key_changed_at;
    NEW.withdrawal_eligible_at := OLD.withdrawal_eligible_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payout_key_cooldown ON public.creator_payout_keys;
CREATE TRIGGER trg_payout_key_cooldown
  BEFORE INSERT OR UPDATE OF pix_key, pix_key_type, holder_name, holder_document
  ON public.creator_payout_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_payout_key_cooldown();

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  _creator_id uuid,
  _amount_cents integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _payout_key public.creator_payout_keys%ROWTYPE;
  _min_withdrawal_cents integer;
  _available_cents bigint := 0;
  _withdrawal_id uuid;
BEGIN
  IF _creator_id IS NULL
     OR NOT public.has_role(_creator_id, 'creator'::public.app_role) THEN
    RAISE EXCEPTION 'VENYX_NOT_CREATOR' USING ERRCODE = 'P0001';
  END IF;

  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'VENYX_INVALID_AMOUNT' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_creator_id::text, 8675309)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.kyc_requests
    WHERE user_id = _creator_id
      AND status = 'approved'::public.kyc_status
  ) THEN
    RAISE EXCEPTION 'VENYX_KYC_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT min_withdrawal_cents
  INTO _min_withdrawal_cents
  FROM public.platform_settings
  WHERE id = 1;

  IF _amount_cents < COALESCE(_min_withdrawal_cents, 3000) THEN
    RAISE EXCEPTION 'VENYX_MIN_WITHDRAWAL' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO _payout_key
  FROM public.creator_payout_keys
  WHERE user_id = _creator_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENYX_PIX_KEY_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF _payout_key.withdrawal_eligible_at > pg_catalog.now() THEN
    RAISE EXCEPTION 'VENYX_PIX_KEY_COOLDOWN' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.identity_verifications iv
    WHERE iv.user_id = _creator_id
      AND iv.status = 'verified'
      AND pg_catalog.regexp_replace(iv.cpf, '[^0-9]', '', 'g') =
          pg_catalog.regexp_replace(_payout_key.holder_document, '[^0-9]', '', 'g')
  ) THEN
    RAISE EXCEPTION 'VENYX_PIX_IDENTITY_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(available_cents, 0)
  INTO _available_cents
  FROM public.creator_balances
  WHERE creator_id = _creator_id;

  IF _amount_cents > COALESCE(_available_cents, 0) THEN
    RAISE EXCEPTION 'VENYX_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.withdrawal_requests (
    creator_id, amount_cents, pix_key, pix_key_type, holder_name, holder_document, status
  ) VALUES (
    _creator_id,
    _amount_cents,
    _payout_key.pix_key,
    _payout_key.pix_key_type,
    _payout_key.holder_name,
    _payout_key.holder_document,
    'pending'::public.withdrawal_status
  )
  RETURNING id INTO _withdrawal_id;

  RETURN _withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal_request(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(uuid, integer)
  TO service_role;

ALTER TABLE public.subscription_coupons
  ADD COLUMN IF NOT EXISTS fixed_price_cents integer,
  ADD COLUMN IF NOT EXISTS new_subscribers_only boolean NOT NULL DEFAULT true;

ALTER TABLE public.subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_check;
ALTER TABLE public.subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_fixed_price_cents_check;
ALTER TABLE public.subscription_coupons
  ADD CONSTRAINT subscription_coupons_fixed_price_cents_check
    CHECK (fixed_price_cents IS NULL OR fixed_price_cents >= 100),
  ADD CONSTRAINT subscription_coupons_exactly_one_benefit_check
    CHECK (
      (CASE WHEN trial_days IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN discount_pct IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN fixed_price_cents IS NULL THEN 0 ELSE 1 END) = 1
    );

CREATE TABLE IF NOT EXISTS public.coupon_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.subscription_coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pix_charge_id uuid NOT NULL UNIQUE REFERENCES public.pix_charges(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'redeemed', 'released')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_reservations_capacity
  ON public.coupon_reservations(coupon_id, status, expires_at);

ALTER TABLE public.coupon_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coupon_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.coupon_reservations TO service_role;

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

  IF NOT FOUND OR NOT _coupon.is_active THEN
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

CREATE OR REPLACE FUNCTION public.release_coupon_reservation(_pix_charge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.coupon_reservations
  SET status = 'released', updated_at = pg_catalog.now()
  WHERE pix_charge_id = _pix_charge_id AND status = 'reserved';
END;
$$;

REVOKE ALL ON FUNCTION public.release_coupon_reservation(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_coupon_reservation(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_coupon_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.coupon_reservations
  SET status = 'redeemed', updated_at = pg_catalog.now()
  WHERE coupon_id = NEW.coupon_id
    AND user_id = NEW.user_id
    AND status = 'reserved';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalize_coupon_reservation ON public.coupon_redemptions;
CREATE TRIGGER trg_finalize_coupon_reservation
  AFTER INSERT ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.finalize_coupon_reservation();

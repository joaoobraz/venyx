-- Impulse Pay: dados obrigatórios de cobrança e rastreio de saques.

ALTER TABLE public.identity_verifications
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.identity_verifications
  DROP CONSTRAINT IF EXISTS identity_verifications_phone_check;
ALTER TABLE public.identity_verifications
  ADD CONSTRAINT identity_verifications_phone_check
  CHECK (phone IS NULL OR phone ~ '^[0-9]{10,11}$');

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS gateway_transfer_id text,
  ADD COLUMN IF NOT EXISTS gateway_status text,
  ADD COLUMN IF NOT EXISTS gateway_fee_cents integer,
  ADD COLUMN IF NOT EXISTS gateway_net_amount_cents integer,
  ADD COLUMN IF NOT EXISTS gateway_end_to_end text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_gateway_transfer_id
  ON public.withdrawal_requests (gateway_transfer_id)
  WHERE gateway_transfer_id IS NOT NULL;

-- A integração anterior gravava o nome do gateway dentro desta função.
CREATE OR REPLACE FUNCTION public.fulfill_subscription_payment(
  _charge_id uuid,
  _subscriber_id uuid,
  _creator_id uuid,
  _amount_cents integer,
  _months integer,
  _is_trial boolean,
  _trial_days integer,
  _gateway_ref text,
  _coupon_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _subscription_id uuid;
  _current_period_end timestamptz;
  _base_date timestamptz;
  _new_period_end timestamptz;
  _idempotency_key text := _charge_id::text || ':subscription';
  _redemption_inserted integer := 0;
BEGIN
  IF _charge_id IS NULL
     OR _subscriber_id IS NULL
     OR _creator_id IS NULL
     OR _amount_cents IS NULL
     OR _amount_cents < 0
     OR _months IS NULL
     OR _months NOT BETWEEN 1 AND 24
     OR _is_trial IS NULL
     OR _trial_days IS NULL
     OR _trial_days NOT BETWEEN 0 AND 30 THEN
    RAISE EXCEPTION 'VENYX_INVALID_SUBSCRIPTION_PAYMENT' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_subscriber_id::text || ':' || _creator_id::text, 5150)
  );

  SELECT reference_id INTO _subscription_id
  FROM public.transactions
  WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN _subscription_id; END IF;

  SELECT id, current_period_end INTO _subscription_id, _current_period_end
  FROM public.subscriptions
  WHERE subscriber_id = _subscriber_id AND creator_id = _creator_id
  FOR UPDATE;

  _base_date := CASE
    WHEN _current_period_end IS NOT NULL AND _current_period_end > pg_catalog.now()
      THEN _current_period_end
    ELSE pg_catalog.now()
  END;
  IF _is_trial AND _trial_days > 0 THEN
    _new_period_end := _base_date + pg_catalog.make_interval(days => _trial_days);
  ELSE
    _new_period_end := _base_date + pg_catalog.make_interval(months => _months);
  END IF;

  IF FOUND THEN
    UPDATE public.subscriptions SET
      price_cents = pg_catalog.round(_amount_cents::numeric / _months)::integer,
      status = 'active'::public.subscription_status,
      current_period_start = pg_catalog.now(),
      current_period_end = _new_period_end,
      is_trial = _is_trial,
      months = _months
    WHERE id = _subscription_id;
  ELSE
    INSERT INTO public.subscriptions (
      subscriber_id, creator_id, price_cents, status, current_period_start,
      current_period_end, is_trial, months
    ) VALUES (
      _subscriber_id, _creator_id,
      pg_catalog.round(_amount_cents::numeric / _months)::integer,
      'active'::public.subscription_status, pg_catalog.now(), _new_period_end,
      _is_trial, _months
    ) RETURNING id INTO _subscription_id;
  END IF;

  INSERT INTO public.transactions (
    payer_id, payee_id, type, status, amount_cents, reference_id, gateway,
    gateway_ref, idempotency_key, metadata
  ) VALUES (
    _subscriber_id, _creator_id, 'subscription'::public.tx_type,
    'paid'::public.tx_status, _amount_cents, _subscription_id, 'impulsepay',
    _gateway_ref, _idempotency_key,
    pg_catalog.jsonb_build_object(
      'charge_id', _charge_id, 'months', _months, 'coupon', _coupon_id
    )
  );

  IF _coupon_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.subscription_coupons
    WHERE id = _coupon_id AND creator_id = _creator_id
  ) THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id)
    VALUES (_coupon_id, _subscriber_id)
    ON CONFLICT (coupon_id, user_id) DO NOTHING;
    GET DIAGNOSTICS _redemption_inserted = ROW_COUNT;
    IF _redemption_inserted = 1 THEN
      UPDATE public.subscription_coupons SET uses_count = uses_count + 1
      WHERE id = _coupon_id AND creator_id = _creator_id;
    END IF;
  END IF;

  RETURN _subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_subscription_payment(
  uuid, uuid, uuid, integer, integer, boolean, integer, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_subscription_payment(
  uuid, uuid, uuid, integer, integer, boolean, integer, text, uuid
) TO service_role;

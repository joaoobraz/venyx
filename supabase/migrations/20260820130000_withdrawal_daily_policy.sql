-- Política de saques do MVP Fanlira:
-- 1º saque válido do dia grátis; do 2º ao 5º, R$ 3,00 por saque.
-- Máximo de 5 saques por dia no fuso de São Paulo e mínimo de R$ 30,00.
-- A taxa da Impulse Pay é absorvida pela Fanlira: após a resposta da adquirente,
-- o saldo da criadora é debitado pelo líquido transferido, não pela taxa do gateway.

BEGIN;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS fanlira_withdrawal_fee_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_fanlira_fee_check;
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_fanlira_fee_check
  CHECK (fanlira_withdrawal_fee_cents IN (0, 300));

CREATE OR REPLACE VIEW public.creator_balances
WITH (security_invoker = true)
AS
WITH s AS (
  SELECT platform_fee_pct, hold_days, min_withdrawal_cents
  FROM public.platform_settings
  WHERE id = 1
),
earnings AS (
  SELECT
    t.payee_id AS creator_id,
    t.amount_cents,
    t.created_at,
    (t.amount_cents * (100 - (SELECT platform_fee_pct FROM s)) / 100) AS net_cents,
    (t.created_at <= now() - make_interval(days => (SELECT hold_days FROM s))) AS is_available
  FROM public.transactions t
  WHERE t.status = 'paid'
    AND t.payee_id IS NOT NULL
    AND t.type IN ('subscription', 'ppv', 'tip', 'chat_ppv', 'affiliate_commission')
),
agg AS (
  SELECT
    creator_id,
    COALESCE(SUM(amount_cents), 0) AS gross_lifetime_cents,
    COALESCE(SUM(net_cents), 0) AS net_lifetime_cents,
    COALESCE(SUM(CASE WHEN is_available THEN net_cents ELSE 0 END), 0) AS available_gross_cents,
    COALESCE(SUM(CASE WHEN NOT is_available THEN net_cents ELSE 0 END), 0) AS pending_cents
  FROM earnings
  GROUP BY creator_id
),
withdrawn AS (
  SELECT
    creator_id,
    COALESCE(SUM(
      CASE WHEN status = 'paid' THEN
        COALESCE(gateway_net_amount_cents, amount_cents) + fanlira_withdrawal_fee_cents
      ELSE 0 END
    ), 0) AS total_paid_cents,
    COALESCE(SUM(
      CASE WHEN status IN ('pending', 'approved', 'processing') THEN
        COALESCE(gateway_net_amount_cents, amount_cents) + fanlira_withdrawal_fee_cents
      ELSE 0 END
    ), 0) AS in_flight_cents
  FROM public.withdrawal_requests
  GROUP BY creator_id
)
SELECT
  a.creator_id,
  a.gross_lifetime_cents,
  a.net_lifetime_cents,
  a.pending_cents,
  COALESCE(w.total_paid_cents, 0) AS total_withdrawn_cents,
  COALESCE(w.in_flight_cents, 0) AS in_flight_cents,
  GREATEST(
    a.available_gross_cents - COALESCE(w.total_paid_cents, 0) - COALESCE(w.in_flight_cents, 0),
    0
  ) AS available_cents
FROM agg a
LEFT JOIN withdrawn w ON w.creator_id = a.creator_id;

GRANT SELECT ON public.creator_balances TO authenticated;

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
  _daily_count integer := 0;
  _fanlira_fee_cents integer := 0;
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

  SELECT COUNT(*)::integer
  INTO _daily_count
  FROM public.withdrawal_requests
  WHERE creator_id = _creator_id
    AND status IN (
      'pending'::public.withdrawal_status,
      'approved'::public.withdrawal_status,
      'processing'::public.withdrawal_status,
      'paid'::public.withdrawal_status
    )
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date =
        (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;

  IF _daily_count >= 5 THEN
    RAISE EXCEPTION 'FANLIRA_DAILY_WITHDRAWAL_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  IF _daily_count > 0 THEN
    _fanlira_fee_cents := 300;
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

  IF (_amount_cents + _fanlira_fee_cents) > COALESCE(_available_cents, 0) THEN
    RAISE EXCEPTION 'VENYX_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.withdrawal_requests (
    creator_id,
    amount_cents,
    fanlira_withdrawal_fee_cents,
    pix_key,
    pix_key_type,
    holder_name,
    holder_document,
    status
  ) VALUES (
    _creator_id,
    _amount_cents,
    _fanlira_fee_cents,
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

COMMIT;

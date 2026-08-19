-- P0 financeiro: reconciliação transacional e idempotente de estornos do gateway.

ALTER TABLE public.pix_charges
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reference text;

CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pix_charge_id uuid NOT NULL UNIQUE REFERENCES public.pix_charges(id) ON DELETE RESTRICT,
  gateway_reference text,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  refunded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payment refund participants read" ON public.payment_refunds;
CREATE POLICY "Payment refund participants read"
  ON public.payment_refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pix_charges charge
      WHERE charge.id = pix_charge_id
        AND (
          auth.uid() IN (charge.payer_id, charge.payee_id)
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.payment_refunds FROM anon, authenticated;

-- Compras de bump/upsell também precisam refletir um estorno.
ALTER TABLE public.upsell_purchases
  DROP CONSTRAINT IF EXISTS upsell_purchases_status_check;
ALTER TABLE public.upsell_purchases
  ADD CONSTRAINT upsell_purchases_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'refunded'));

CREATE OR REPLACE FUNCTION public.reconcile_pix_refund(
  _charge_id uuid,
  _gateway_reference text,
  _amount_cents integer,
  _refunded_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _charge public.pix_charges%ROWTYPE;
  _subscription_id uuid;
  _transaction_metadata jsonb;
  _months integer;
  _trial_days integer;
  _new_period_end timestamptz;
  _media_post_id uuid;
  _raised_cents integer;
BEGIN
  IF _charge_id IS NULL OR _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'VENYX_INVALID_REFUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _charge
  FROM public.pix_charges
  WHERE id = _charge_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENYX_CHARGE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF _charge.amount_cents <> _amount_cents THEN
    RAISE EXCEPTION 'VENYX_REFUND_AMOUNT_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  IF _charge.status = 'refunded'::public.pix_charge_status THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'already_refunded', true);
  END IF;

  IF _charge.status <> 'paid'::public.pix_charge_status THEN
    RAISE EXCEPTION 'VENYX_CHARGE_NOT_PAID' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.payment_refunds (
    pix_charge_id,
    gateway_reference,
    amount_cents,
    refunded_at
  ) VALUES (
    _charge.id,
    NULLIF(_gateway_reference, ''),
    _amount_cents,
    COALESCE(_refunded_at, pg_catalog.now())
  )
  ON CONFLICT (pix_charge_id) DO NOTHING;

  UPDATE public.pix_charges
  SET status = 'refunded'::public.pix_charge_status,
      refunded_at = COALESCE(_refunded_at, pg_catalog.now()),
      refund_reference = NULLIF(_gateway_reference, '')
  WHERE id = _charge.id;

  UPDATE public.transactions
  SET status = 'refunded'::public.tx_status,
      metadata = COALESCE(metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'refunded_at', COALESCE(_refunded_at, pg_catalog.now()),
        'refund_reference', NULLIF(_gateway_reference, '')
      )
  WHERE idempotency_key LIKE _charge.id::text || ':%'
     OR metadata->>'charge_id' = _charge.id::text;

  IF _charge.purpose = 'ppv'::public.pix_charge_purpose AND _charge.reference_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pix_charges other
      WHERE other.id <> _charge.id
        AND other.payer_id = _charge.payer_id
        AND other.purpose = 'ppv'::public.pix_charge_purpose
        AND other.reference_id = _charge.reference_id
        AND other.status = 'paid'::public.pix_charge_status
    ) THEN
      DELETE FROM public.ppv_unlocks
      WHERE user_id = _charge.payer_id AND post_id = _charge.reference_id;
    END IF;
  ELSIF _charge.purpose = 'chat_ppv'::public.pix_charge_purpose
        AND _charge.reference_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pix_charges other
      WHERE other.id <> _charge.id
        AND other.payer_id = _charge.payer_id
        AND other.purpose = 'chat_ppv'::public.pix_charge_purpose
        AND other.reference_id = _charge.reference_id
        AND other.status = 'paid'::public.pix_charge_status
    ) THEN
      DELETE FROM public.chat_ppv_unlocks
      WHERE user_id = _charge.payer_id AND message_id = _charge.reference_id;
    END IF;
  ELSIF _charge.purpose = 'goal'::public.pix_charge_purpose
        AND _charge.reference_id IS NOT NULL THEN
    DELETE FROM public.post_goal_contributions
    WHERE pix_charge_id = _charge.id;

    SELECT COALESCE(pg_catalog.sum(amount_cents), 0)::integer INTO _raised_cents
    FROM public.post_goal_contributions
    WHERE post_id = _charge.reference_id;

    UPDATE public.post_goals
    SET raised_cents = _raised_cents,
        is_unlocked = (_raised_cents >= target_cents),
        unlocked_at = CASE
          WHEN _raised_cents >= target_cents THEN COALESCE(unlocked_at, pg_catalog.now())
          ELSE NULL
        END
    WHERE post_id = _charge.reference_id;
  ELSIF _charge.purpose = 'subscription'::public.pix_charge_purpose THEN
    SELECT reference_id, metadata
      INTO _subscription_id, _transaction_metadata
    FROM public.transactions
    WHERE idempotency_key = _charge.id::text || ':subscription'
    LIMIT 1;

    IF _subscription_id IS NOT NULL THEN
      _months := CASE
        WHEN COALESCE(_transaction_metadata->>'months', '') ~ '^[0-9]+$'
          THEN GREATEST(1, LEAST(24, (_transaction_metadata->>'months')::integer))
        ELSE 1
      END;
      _trial_days := CASE
        WHEN COALESCE(_transaction_metadata->>'trial_days', '') ~ '^[0-9]+$'
          THEN GREATEST(0, LEAST(30, (_transaction_metadata->>'trial_days')::integer))
        ELSE 0
      END;

      SELECT CASE
        WHEN COALESCE((_transaction_metadata->>'is_trial')::boolean, false)
             AND _trial_days > 0
          THEN current_period_end - pg_catalog.make_interval(days => _trial_days)
        ELSE current_period_end - pg_catalog.make_interval(months => _months)
      END
      INTO _new_period_end
      FROM public.subscriptions
      WHERE id = _subscription_id
      FOR UPDATE;

      UPDATE public.subscriptions
      SET current_period_end = GREATEST(
            COALESCE(current_period_start, pg_catalog.now()),
            COALESCE(_new_period_end, pg_catalog.now())
          ),
          status = CASE
            WHEN COALESCE(_new_period_end, pg_catalog.now()) > pg_catalog.now()
              THEN 'active'::public.subscription_status
            ELSE 'expired'::public.subscription_status
          END,
          is_trial = false
      WHERE id = _subscription_id;
    END IF;
  END IF;

  -- Bumps e upsells podem estar associados a qualquer cobrança principal.
  UPDATE public.upsell_purchases
  SET status = 'refunded'
  WHERE (pix_charge_id = _charge.id OR parent_charge_id = _charge.id)
    AND status = 'paid';

  FOR _media_post_id IN
    SELECT DISTINCT offer.media_post_id
    FROM public.upsell_purchases purchase
    JOIN public.upsell_offers offer ON offer.id = purchase.offer_id
    WHERE (purchase.pix_charge_id = _charge.id OR purchase.parent_charge_id = _charge.id)
      AND offer.media_post_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.pix_charges paid_charge
      WHERE paid_charge.payer_id = _charge.payer_id
        AND paid_charge.purpose = 'ppv'::public.pix_charge_purpose
        AND paid_charge.reference_id = _media_post_id
        AND paid_charge.status = 'paid'::public.pix_charge_status
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.upsell_purchases paid_purchase
      JOIN public.upsell_offers paid_offer ON paid_offer.id = paid_purchase.offer_id
      WHERE paid_purchase.buyer_id = _charge.payer_id
        AND paid_purchase.status = 'paid'
        AND paid_offer.media_post_id = _media_post_id
    ) THEN
      DELETE FROM public.ppv_unlocks
      WHERE user_id = _charge.payer_id AND post_id = _media_post_id;
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'already_refunded', false);
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_pix_refund(uuid, text, integer, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_pix_refund(uuid, text, integer, timestamptz)
  TO service_role;

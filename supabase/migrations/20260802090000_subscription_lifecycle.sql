-- Subscription lifecycle for PIX renewals: cancellation at period end,
-- safe reactivation and idempotent renewal reminders.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_cancellation_reason_length;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_cancellation_reason_length
  CHECK (cancellation_reason IS NULL OR char_length(cancellation_reason) <= 500);

-- Cancellation is only exposed through the audited RPCs below. The historical
-- UPDATE policy cancelled immediately and could remove already-paid access.
DROP POLICY IF EXISTS "Usuário cancela sua assinatura" ON public.subscriptions;
DROP POLICY IF EXISTS "Assinante só pode cancelar a própria assinatura" ON public.subscriptions;
REVOKE UPDATE ON public.subscriptions FROM authenticated;

CREATE OR REPLACE FUNCTION public.schedule_my_subscription_cancellation(
  _subscription_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _subscription public.subscriptions%ROWTYPE;
  _clean_reason text := NULLIF(pg_catalog.btrim(COALESCE(_reason, '')), '');
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'VENYX_NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF _subscription_id IS NULL OR char_length(COALESCE(_clean_reason, '')) > 500 THEN
    RAISE EXCEPTION 'VENYX_INVALID_CANCELLATION' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _subscription
  FROM public.subscriptions
  WHERE id = _subscription_id
    AND subscriber_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENYX_SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF _subscription.status <> 'active'::public.subscription_status
     OR _subscription.current_period_end IS NULL
     OR _subscription.current_period_end <= pg_catalog.now() THEN
    RAISE EXCEPTION 'VENYX_SUBSCRIPTION_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  IF NOT _subscription.cancel_at_period_end THEN
    UPDATE public.subscriptions
    SET cancel_at_period_end = true,
        cancel_requested_at = pg_catalog.now(),
        cancellation_reason = _clean_reason
    WHERE id = _subscription.id;

    INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
    VALUES (
      _user_id,
      'subscription_cancellation',
      'Cancelamento agendado',
      'Seu acesso continua ativo até o fim do período já pago.',
      '/settings/payments',
      pg_catalog.jsonb_build_object(
        'subscription_id', _subscription.id::text,
        'current_period_end', _subscription.current_period_end
      )
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cancel_at_period_end', true,
    'current_period_end', _subscription.current_period_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_my_subscription_cancellation(
  _subscription_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _subscription public.subscriptions%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'VENYX_NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _subscription
  FROM public.subscriptions
  WHERE id = _subscription_id
    AND subscriber_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENYX_SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF _subscription.status <> 'active'::public.subscription_status
     OR _subscription.current_period_end IS NULL
     OR _subscription.current_period_end <= pg_catalog.now() THEN
    RAISE EXCEPTION 'VENYX_SUBSCRIPTION_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  IF _subscription.cancel_at_period_end THEN
    UPDATE public.subscriptions
    SET cancel_at_period_end = false,
        cancel_requested_at = NULL,
        cancellation_reason = NULL
    WHERE id = _subscription.id;

    INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
    VALUES (
      _user_id,
      'subscription_cancellation_undone',
      'Cancelamento desfeito',
      'Sua assinatura permanece ativa até a data atual de vencimento.',
      '/settings/payments',
      pg_catalog.jsonb_build_object(
        'subscription_id', _subscription.id::text,
        'current_period_end', _subscription.current_period_end
      )
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'cancel_at_period_end', false,
    'current_period_end', _subscription.current_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_my_subscription_cancellation(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_my_subscription_cancellation(uuid, text)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.undo_my_subscription_cancellation(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_my_subscription_cancellation(uuid)
  TO authenticated, service_role;

-- Any paid renewal that extends the current period automatically clears a
-- previously scheduled cancellation.
CREATE OR REPLACE FUNCTION public.clear_scheduled_cancellation_on_renewal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.current_period_end IS NOT NULL
     AND (OLD.current_period_end IS NULL OR NEW.current_period_end > OLD.current_period_end) THEN
    NEW.cancel_at_period_end := false;
    NEW.cancel_requested_at := NULL;
    NEW.cancellation_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_scheduled_cancellation_on_renewal ON public.subscriptions;
CREATE TRIGGER clear_scheduled_cancellation_on_renewal
  BEFORE UPDATE OF current_period_end ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_scheduled_cancellation_on_renewal();

CREATE TABLE IF NOT EXISTS public.subscription_renewal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL,
  period_end timestamptz NOT NULL,
  days_before integer NOT NULL CHECK (days_before IN (1, 3, 7)),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_end, days_before)
);

ALTER TABLE public.subscription_renewal_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_renewal_reminders FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_subscription_renewal_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _row record;
  _delivery_id uuid;
  _count integer := 0;
BEGIN
  FOR _row IN
    SELECT
      s.id AS subscription_id,
      s.subscriber_id,
      s.current_period_end,
      CEIL(EXTRACT(EPOCH FROM (s.current_period_end - pg_catalog.now())) / 86400.0)::integer
        AS days_before,
      p.username,
      COALESCE(NULLIF(p.display_name, ''), p.username, 'sua criadora') AS creator_name
    FROM public.subscriptions s
    LEFT JOIN public.profiles p ON p.user_id = s.creator_id
    WHERE s.status = 'active'::public.subscription_status
      AND NOT s.cancel_at_period_end
      AND s.current_period_end > pg_catalog.now()
      AND CEIL(EXTRACT(EPOCH FROM (s.current_period_end - pg_catalog.now())) / 86400.0)::integer
          IN (1, 3, 7)
  LOOP
    _delivery_id := NULL;
    INSERT INTO public.subscription_renewal_reminders(
      subscription_id,
      subscriber_id,
      period_end,
      days_before
    ) VALUES (
      _row.subscription_id,
      _row.subscriber_id,
      _row.current_period_end,
      _row.days_before
    )
    ON CONFLICT (subscription_id, period_end, days_before) DO NOTHING
    RETURNING id INTO _delivery_id;

    IF _delivery_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
      VALUES (
        _row.subscriber_id,
        'subscription_renewal',
        'Sua assinatura vence em ' || _row.days_before::text ||
          CASE WHEN _row.days_before = 1 THEN ' dia' ELSE ' dias' END,
        'Gere um novo PIX para continuar acompanhando ' || _row.creator_name || '.',
        CASE WHEN _row.username IS NULL
          THEN '/settings/payments'
          ELSE '/profile/' || _row.username
        END,
        pg_catalog.jsonb_build_object(
          'subscription_id', _row.subscription_id::text,
          'current_period_end', _row.current_period_end,
          'days_before', _row.days_before
        )
      );
      _count := _count + 1;
    END IF;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_subscription_renewal_reminders()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_subscription_renewal_reminders()
  TO service_role;

NOTIFY pgrst, 'reload schema';

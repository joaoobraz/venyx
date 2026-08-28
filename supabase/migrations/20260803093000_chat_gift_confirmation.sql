-- A confirmação de mimo nasce da transação paga e aparece na conversa dos participantes.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS gift_amount_cents integer,
  ADD COLUMN IF NOT EXISTS gift_message text,
  ADD COLUMN IF NOT EXISTS financial_transaction_id uuid REFERENCES public.transactions(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'chat_messages_kind_check'
      AND conrelid = 'public.chat_messages'::regclass
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_kind_check
      CHECK (message_kind IN ('text', 'gift'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'chat_messages_gift_amount_check'
      AND conrelid = 'public.chat_messages'::regclass
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_gift_amount_check
      CHECK (gift_amount_cents IS NULL OR gift_amount_cents >= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'chat_messages_gift_message_length_check'
      AND conrelid = 'public.chat_messages'::regclass
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_gift_message_length_check
      CHECK (gift_message IS NULL OR char_length(gift_message) <= 200);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_financial_transaction_unique
  ON public.chat_messages(financial_transaction_id)
  WHERE financial_transaction_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.list_thread_messages_verified(uuid);
DROP FUNCTION IF EXISTS public.list_thread_messages(uuid);

CREATE FUNCTION public.list_thread_messages(_thread_id uuid)
RETURNS TABLE (
  id uuid,
  thread_id uuid,
  sender_id uuid,
  body text,
  media_path text,
  mime_type text,
  ppv_price_cents integer,
  subscribers_only boolean,
  campaign_id uuid,
  message_kind text,
  gift_amount_cents integer,
  gift_message text,
  financial_transaction_id uuid,
  created_at timestamptz,
  read_at timestamptz,
  unlocked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _is_participant boolean;
  _other uuid;
  _has_sub boolean;
BEGIN
  IF _viewer IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = _thread_id AND (t.user_a = _viewer OR t.user_b = _viewer)
    ),
    (
      SELECT CASE WHEN t.user_a = _viewer THEN t.user_b ELSE t.user_a END
      FROM public.chat_threads t WHERE t.id = _thread_id
    )
  INTO _is_participant, _other;

  IF NOT _is_participant THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.status = 'active'
      AND (
        (s.creator_id = _other AND s.subscriber_id = _viewer)
        OR (s.creator_id = _viewer AND s.subscriber_id = _other)
      )
  ) INTO _has_sub;

  RETURN QUERY
  SELECT
    m.id,
    m.thread_id,
    m.sender_id,
    m.body,
    CASE
      WHEN m.media_path IS NULL THEN NULL
      WHEN m.sender_id = _viewer THEN m.media_path
      WHEN m.ppv_price_cents > 0 AND NOT EXISTS (
        SELECT 1 FROM public.chat_ppv_unlocks u
        WHERE u.message_id = m.id AND u.user_id = _viewer
      ) THEN NULL
      WHEN m.subscribers_only AND NOT _has_sub THEN NULL
      ELSE m.media_path
    END,
    CASE
      WHEN m.media_path IS NULL THEN NULL
      WHEN m.sender_id = _viewer THEN m.mime_type
      WHEN m.ppv_price_cents > 0 AND NOT EXISTS (
        SELECT 1 FROM public.chat_ppv_unlocks u
        WHERE u.message_id = m.id AND u.user_id = _viewer
      ) THEN NULL
      WHEN m.subscribers_only AND NOT _has_sub THEN NULL
      ELSE m.mime_type
    END,
    m.ppv_price_cents,
    m.subscribers_only,
    m.campaign_id,
    m.message_kind,
    m.gift_amount_cents,
    m.gift_message,
    m.financial_transaction_id,
    m.created_at,
    m.read_at,
    (
      m.sender_id = _viewer
      OR (m.ppv_price_cents = 0 AND (NOT m.subscribers_only OR _has_sub))
      OR EXISTS (
        SELECT 1 FROM public.chat_ppv_unlocks u
        WHERE u.message_id = m.id AND u.user_id = _viewer
      )
    )
  FROM public.chat_messages m
  WHERE m.thread_id = _thread_id
  ORDER BY m.created_at ASC;
END;
$$;

CREATE FUNCTION public.list_thread_messages_verified(_thread_id uuid)
RETURNS TABLE (
  id uuid,
  thread_id uuid,
  sender_id uuid,
  body text,
  media_path text,
  mime_type text,
  ppv_price_cents integer,
  subscribers_only boolean,
  campaign_id uuid,
  message_kind text,
  gift_amount_cents integer,
  gift_message text,
  financial_transaction_id uuid,
  created_at timestamptz,
  read_at timestamptz,
  unlocked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_age_verified(auth.uid()) THEN
    RAISE EXCEPTION 'VENYX_ADULT_VERIFICATION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY SELECT * FROM public.list_thread_messages(_thread_id);
END;
$$;

REVOKE ALL ON FUNCTION public.list_thread_messages(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_thread_messages(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.list_thread_messages_verified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_thread_messages_verified(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient_id uuid;
  actor_name text;
BEGIN
  SELECT CASE WHEN t.user_a = NEW.sender_id THEN t.user_b ELSE t.user_a END
  INTO recipient_id
  FROM public.chat_threads t
  WHERE t.id = NEW.thread_id AND NEW.sender_id IN (t.user_a, t.user_b);

  IF recipient_id IS NULL
    OR NOT public.notifications_allow_actor(recipient_id, NEW.sender_id)
    OR public.notification_target_is_muted(recipient_id, 'thread', NEW.thread_id) THEN
    RETURN NEW;
  END IF;

  actor_name := public.actor_username(NEW.sender_id);
  DELETE FROM public.notifications n
  WHERE n.user_id = recipient_id
    AND n.type = 'chat_message'
    AND n.read_at IS NULL
    AND n.metadata @> pg_catalog.jsonb_build_object('thread_id', NEW.thread_id::text);

  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  VALUES (
    recipient_id,
    'chat_message',
    CASE WHEN NEW.message_kind = 'gift'
      THEN 'Mimo confirmado no chat'
      ELSE 'Nova mensagem de @' || actor_name
    END,
    CASE
      WHEN NEW.body IS NOT NULL THEN pg_catalog.left(NEW.body, 120)
      ELSE 'Mídia recebida'
    END,
    '/chat?thread=' || NEW.thread_id::text,
    pg_catalog.jsonb_build_object(
      'thread_id', NEW.thread_id::text,
      'message_id', NEW.id::text,
      'actor_id', NEW.sender_id::text,
      'actor_username', actor_name,
      'message_kind', NEW.message_kind
    )
  );
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Keep chat notifications tied to an existing conversation and route directly
-- to the thread that generated them.

-- Recreate and explicitly expose the verified chat RPC. Some staging projects
-- kept the function in PostgreSQL while PostgREST's schema cache stopped
-- exposing it after the security grants were hardened.
CREATE OR REPLACE FUNCTION public.list_thread_messages_verified(_thread_id uuid)
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
    RAISE EXCEPTION 'VENYX_ADULT_VERIFICATION_REQUIRED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.list_thread_messages(_thread_id);
END;
$$;

REVOKE ALL ON FUNCTION public.list_thread_messages_verified(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_thread_messages_verified(uuid)
  TO authenticated, service_role;

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
  SELECT
    CASE WHEN t.user_a = NEW.sender_id THEN t.user_b ELSE t.user_a END
  INTO recipient_id
  FROM public.chat_threads t
  WHERE t.id = NEW.thread_id
    AND NEW.sender_id IN (t.user_a, t.user_b);

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
    'Nova mensagem de @' || actor_name,
    CASE
      WHEN NEW.body IS NOT NULL THEN pg_catalog.left(NEW.body, 120)
      ELSE 'Mídia recebida'
    END,
    '/chat?thread=' || NEW.thread_id::text,
    pg_catalog.jsonb_build_object(
      'thread_id', NEW.thread_id::text,
      'message_id', NEW.id::text,
      'actor_id', NEW.sender_id::text,
      'actor_username', actor_name
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_chat_notifications_for_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.notifications n
  WHERE n.type = 'chat_message'
    AND n.metadata->>'thread_id' = OLD.id::text;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_chat_notifications_for_thread() FROM PUBLIC;

DROP TRIGGER IF EXISTS cleanup_chat_notifications_for_thread ON public.chat_threads;
CREATE TRIGGER cleanup_chat_notifications_for_thread
  BEFORE DELETE ON public.chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_chat_notifications_for_thread();

-- Remove old ghost notifications and normalize links created by previous versions.
DELETE FROM public.notifications n
WHERE n.type = 'chat_message'
  AND (
    n.metadata->>'thread_id' IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id::text = n.metadata->>'thread_id'
    )
  );

UPDATE public.notifications n
SET link = '/chat?thread=' || (n.metadata->>'thread_id')
WHERE n.type = 'chat_message'
  AND n.metadata->>'thread_id' IS NOT NULL;

NOTIFY pgrst, 'reload schema';

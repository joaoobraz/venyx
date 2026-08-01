-- Comment threads, mentions, abuse controls and interaction notifications.

ALTER TABLE public.content_reports
  DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type IN ('post', 'profile', 'message', 'conversation', 'comment'));

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
    REFERENCES public.post_comments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS post_comments_parent_idx
  ON public.post_comments(parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can read comments on visible posts" ON public.post_comments;
CREATE POLICY "Users can read comments on visible posts"
  ON public.post_comments
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_post(post_id, auth.uid())
    AND NOT public.users_are_blocked(auth.uid(), user_id)
  );

CREATE OR REPLACE FUNCTION public.enforce_post_comment_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_post_id uuid;
BEGIN
  NEW.body = btrim(NEW.body);

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT c.post_id
    INTO parent_post_id
    FROM public.post_comments c
    WHERE c.id = NEW.parent_comment_id;

    IF parent_post_id IS NULL OR parent_post_id <> NEW.post_id THEN
      RAISE EXCEPTION 'COMMENT_INVALID_PARENT' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF (
    SELECT count(*)
    FROM public.post_comments c
    WHERE c.user_id = NEW.user_id
      AND c.created_at >= pg_catalog.now() - interval '1 minute'
  ) >= 5 THEN
    RAISE EXCEPTION 'COMMENT_RATE_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.post_comments c
    WHERE c.user_id = NEW.user_id
      AND pg_catalog.lower(pg_catalog.btrim(c.body)) = pg_catalog.lower(NEW.body)
      AND c.created_at >= pg_catalog.now() - interval '5 minutes'
  ) THEN
    RAISE EXCEPTION 'COMMENT_DUPLICATE' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_post_comment_rules ON public.post_comments;
CREATE TRIGGER enforce_post_comment_rules
  BEFORE INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_post_comment_rules();

CREATE OR REPLACE FUNCTION public.actor_username(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT p.username
      FROM public.profiles p
      WHERE p.user_id = _user_id
      LIMIT 1
    ),
    'usuario'
  );
$$;

CREATE OR REPLACE FUNCTION public.notifications_allow_actor(
  _recipient_id uuid,
  _actor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    _recipient_id <> _actor_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_mutes m
      WHERE m.user_id = _recipient_id
        AND m.muted_user_id = _actor_id
    )
    AND NOT public.users_are_blocked(_recipient_id, _actor_id);
$$;

CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient_id uuid;
  actor_name text;
  target_post_id uuid := COALESCE(NEW.post_id, OLD.post_id);
  actor_id uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  SELECT p.creator_id
  INTO recipient_id
  FROM public.posts p
  WHERE p.id = target_post_id;

  IF recipient_id IS NULL
    OR NOT public.notifications_allow_actor(recipient_id, actor_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications n
    WHERE n.user_id = recipient_id
      AND n.type = 'post_like'
      AND n.read_at IS NULL
      AND n.metadata @> pg_catalog.jsonb_build_object(
        'post_id', target_post_id::text,
        'actor_id', actor_id::text
      );
    RETURN OLD;
  END IF;

  actor_name := public.actor_username(actor_id);
  DELETE FROM public.notifications n
  WHERE n.user_id = recipient_id
    AND n.type = 'post_like'
    AND n.read_at IS NULL
    AND n.metadata @> pg_catalog.jsonb_build_object(
      'post_id', target_post_id::text,
      'actor_id', actor_id::text
    );

  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  VALUES (
    recipient_id,
    'post_like',
    '@' || actor_name || ' curtiu sua publicação',
    NULL,
    '/saved/' || target_post_id::text,
    pg_catalog.jsonb_build_object(
      'post_id', target_post_id::text,
      'actor_id', actor_id::text,
      'actor_username', actor_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_like ON public.post_likes;
CREATE TRIGGER notify_post_like
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_like();

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  creator_id uuid;
  reply_user_id uuid;
  mentioned_id uuid;
  actor_name text;
  notified_ids uuid[] := '{}'::uuid[];
  notification_title text;
BEGIN
  actor_name := public.actor_username(NEW.user_id);
  SELECT p.creator_id
  INTO creator_id
  FROM public.posts p
  WHERE p.id = NEW.post_id;

  IF creator_id IS NOT NULL
    AND public.notifications_allow_actor(creator_id, NEW.user_id) THEN
    INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
    VALUES (
      creator_id,
      'post_comment',
      '@' || actor_name || ' comentou na sua publicação',
      pg_catalog.left(NEW.body, 160),
      '/saved/' || NEW.post_id::text,
      pg_catalog.jsonb_build_object(
        'post_id', NEW.post_id::text,
        'comment_id', NEW.id::text,
        'actor_id', NEW.user_id::text,
        'actor_username', actor_name
      )
    );
    notified_ids := pg_catalog.array_append(notified_ids, creator_id);
  END IF;

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT c.user_id
    INTO reply_user_id
    FROM public.post_comments c
    WHERE c.id = NEW.parent_comment_id;

    IF reply_user_id IS NOT NULL
      AND NOT (reply_user_id = ANY(notified_ids))
      AND public.notifications_allow_actor(reply_user_id, NEW.user_id) THEN
      INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
      VALUES (
        reply_user_id,
        'comment_reply',
        '@' || actor_name || ' respondeu ao seu comentário',
        pg_catalog.left(NEW.body, 160),
        '/saved/' || NEW.post_id::text,
        pg_catalog.jsonb_build_object(
          'post_id', NEW.post_id::text,
          'comment_id', NEW.id::text,
          'parent_comment_id', NEW.parent_comment_id::text,
          'actor_id', NEW.user_id::text,
          'actor_username', actor_name
        )
      );
      notified_ids := pg_catalog.array_append(notified_ids, reply_user_id);
    END IF;
  END IF;

  FOREACH mentioned_id IN ARRAY NEW.mentioned_user_ids
  LOOP
    IF mentioned_id IS NOT NULL
      AND NOT (mentioned_id = ANY(notified_ids))
      AND public.notifications_allow_actor(mentioned_id, NEW.user_id) THEN
      notification_title := '@' || actor_name || ' mencionou você em um comentário';
      INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
      VALUES (
        mentioned_id,
        'comment_mention',
        notification_title,
        pg_catalog.left(NEW.body, 160),
        '/saved/' || NEW.post_id::text,
        pg_catalog.jsonb_build_object(
          'post_id', NEW.post_id::text,
          'comment_id', NEW.id::text,
          'actor_id', NEW.user_id::text,
          'actor_username', actor_name
        )
      );
      notified_ids := pg_catalog.array_append(notified_ids, mentioned_id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_comment ON public.post_comments;
CREATE TRIGGER notify_post_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_comment();

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
    OR NOT public.notifications_allow_actor(recipient_id, NEW.sender_id) THEN
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
    '/chat?with=' || NEW.sender_id::text,
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

DROP TRIGGER IF EXISTS notify_chat_message ON public.chat_messages;
CREATE TRIGGER notify_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();

REVOKE ALL ON FUNCTION public.actor_username(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notifications_allow_actor(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_username(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notifications_allow_actor(uuid, uuid)
  TO authenticated, service_role;

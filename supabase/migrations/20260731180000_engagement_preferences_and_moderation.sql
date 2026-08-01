-- Engagement polish: scoped notification mutes, editable content and creator moderation.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE TABLE IF NOT EXISTS public.notification_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'thread')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS notification_mutes_user_idx
  ON public.notification_mutes(user_id, target_type, target_id);

ALTER TABLE public.notification_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their notification mutes"
  ON public.notification_mutes;
CREATE POLICY "Users manage their notification mutes"
  ON public.notification_mutes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.creator_moderation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('keyword', 'user')),
  value text,
  blocked_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_moderation_rule_shape CHECK (
    (kind = 'keyword' AND char_length(btrim(value)) BETWEEN 2 AND 60 AND blocked_user_id IS NULL)
    OR
    (kind = 'user' AND value IS NULL AND blocked_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_moderation_keyword_unique
  ON public.creator_moderation_rules(creator_id, lower(btrim(value)))
  WHERE kind = 'keyword';

CREATE UNIQUE INDEX IF NOT EXISTS creator_moderation_user_unique
  ON public.creator_moderation_rules(creator_id, blocked_user_id)
  WHERE kind = 'user';

ALTER TABLE public.creator_moderation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators manage their moderation rules"
  ON public.creator_moderation_rules;
CREATE POLICY "Creators manage their moderation rules"
  ON public.creator_moderation_rules
  FOR ALL
  TO authenticated
  USING (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  )
  WITH CHECK (
    creator_id = auth.uid()
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.notification_target_is_muted(
  _user_id uuid,
  _target_type text,
  _target_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_mutes m
    WHERE m.user_id = _user_id
      AND m.target_type = _target_type
      AND m.target_id = _target_id
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_post_comment_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_post_id uuid;
  post_creator_id uuid;
BEGIN
  NEW.body = btrim(NEW.body);

  SELECT p.creator_id
  INTO post_creator_id
  FROM public.posts p
  WHERE p.id = NEW.post_id;

  IF post_creator_id IS NULL THEN
    RAISE EXCEPTION 'COMMENT_POST_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.creator_moderation_rules r
    WHERE r.creator_id = post_creator_id
      AND r.kind = 'user'
      AND r.blocked_user_id = NEW.user_id
      AND r.is_active
  ) THEN
    RAISE EXCEPTION 'COMMENT_CREATOR_BLOCKED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.creator_moderation_rules r
    WHERE r.creator_id = post_creator_id
      AND r.kind = 'keyword'
      AND r.is_active
      AND strpos(lower(NEW.body), lower(btrim(r.value))) > 0
  ) THEN
    RAISE EXCEPTION 'COMMENT_BLOCKED_KEYWORD' USING ERRCODE = 'P0001';
  END IF;

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
      AND lower(btrim(c.body)) = lower(NEW.body)
      AND c.created_at >= pg_catalog.now() - interval '5 minutes'
  ) THEN
    RAISE EXCEPTION 'COMMENT_DUPLICATE' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_post_comment_edit_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  post_creator_id uuid;
BEGIN
  NEW.body = btrim(NEW.body);
  SELECT p.creator_id
  INTO post_creator_id
  FROM public.posts p
  WHERE p.id = NEW.post_id;

  IF EXISTS (
    SELECT 1
    FROM public.creator_moderation_rules r
    WHERE r.creator_id = post_creator_id
      AND r.kind = 'keyword'
      AND r.is_active
      AND strpos(lower(NEW.body), lower(btrim(r.value))) > 0
  ) THEN
    RAISE EXCEPTION 'COMMENT_BLOCKED_KEYWORD' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_post_comment_edit_rules ON public.post_comments;
CREATE TRIGGER enforce_post_comment_edit_rules
  BEFORE UPDATE OF body ON public.post_comments
  FOR EACH ROW
  WHEN (OLD.body IS DISTINCT FROM NEW.body)
  EXECUTE FUNCTION public.enforce_post_comment_edit_rules();

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

  IF recipient_id IS NULL
    OR NOT public.notifications_allow_actor(recipient_id, actor_id)
    OR public.notification_target_is_muted(recipient_id, 'post', target_post_id) THEN
    RETURN NEW;
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
BEGIN
  actor_name := public.actor_username(NEW.user_id);
  SELECT p.creator_id
  INTO creator_id
  FROM public.posts p
  WHERE p.id = NEW.post_id;

  IF creator_id IS NOT NULL
    AND NOT public.notification_target_is_muted(creator_id, 'post', NEW.post_id)
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
      AND NOT public.notification_target_is_muted(reply_user_id, 'post', NEW.post_id)
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
      AND NOT public.notification_target_is_muted(mentioned_id, 'post', NEW.post_id)
      AND public.notifications_allow_actor(mentioned_id, NEW.user_id) THEN
      INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
      VALUES (
        mentioned_id,
        'comment_mention',
        '@' || actor_name || ' mencionou você em um comentário',
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

REVOKE ALL ON FUNCTION public.notification_target_is_muted(uuid, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_target_is_muted(uuid, text, uuid)
  TO authenticated, service_role;

GRANT SELECT, INSERT, DELETE ON public.notification_mutes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_moderation_rules TO authenticated;

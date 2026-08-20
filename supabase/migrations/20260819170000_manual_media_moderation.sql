-- Fanlira MVP: moderacao humana fail-closed, sem fornecedor pago.
-- Conteudo novo nunca fica visivel a terceiros antes da decisao administrativa.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderated_by uuid,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_note text;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderated_by uuid,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_note text;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderated_by uuid,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_note text;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'posts_moderation_status_check'
  ) THEN
    ALTER TABLE public.posts ADD CONSTRAINT posts_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'stories_moderation_status_check'
  ) THEN
    ALTER TABLE public.stories ADD CONSTRAINT stories_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'chat_messages_moderation_status_check'
  ) THEN
    ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS idx_posts_manual_moderation
  ON public.posts(moderation_status, created_at);
CREATE INDEX IF NOT EXISTS idx_stories_manual_moderation
  ON public.stories(moderation_status, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_manual_moderation
  ON public.chat_messages(moderation_status, created_at)
  WHERE media_path IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.manual_media_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (surface IN ('post', 'story', 'chat')),
  target_id uuid NOT NULL,
  bucket text NOT NULL CHECK (bucket IN ('posts', 'stories', 'chat-media')),
  storage_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(surface, target_id)
);

ALTER TABLE public.manual_media_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads manual media review" ON public.manual_media_reviews;
CREATE POLICY "Owner reads manual media review"
  ON public.manual_media_reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin reads manual media reviews" ON public.manual_media_reviews;
CREATE POLICY "Admin reads manual media reviews"
  ON public.manual_media_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE INSERT, UPDATE, DELETE ON public.manual_media_reviews FROM anon, authenticated;
GRANT SELECT ON public.manual_media_reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_manual_moderation_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _role text := pg_catalog.current_setting('request.jwt.claim.role', true);
BEGIN
  IF _role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'chat_messages' AND NEW.media_path IS NULL THEN
      NEW.moderation_status := 'approved';
    ELSE
      NEW.moderation_status := 'pending';
    END IF;
    NEW.moderated_by := NULL;
    NEW.moderated_at := NULL;
    NEW.moderation_note := NULL;
    RETURN NEW;
  END IF;

  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    RAISE EXCEPTION 'FANLIRA_MODERATION_STATUS_SERVER_ONLY' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_manual_moderation_submission()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_manual_moderation_submission()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_posts_manual_moderation ON public.posts;
CREATE TRIGGER enforce_posts_manual_moderation
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_manual_moderation_submission();

DROP TRIGGER IF EXISTS enforce_stories_manual_moderation ON public.stories;
CREATE TRIGGER enforce_stories_manual_moderation
  BEFORE INSERT OR UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_manual_moderation_submission();

DROP TRIGGER IF EXISTS enforce_chat_manual_moderation ON public.chat_messages;
CREATE TRIGGER enforce_chat_manual_moderation
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_manual_moderation_submission();

-- Nao permitir que uma criadora acrescente midia a um post ja aprovado.
DROP POLICY IF EXISTS "Criadora insere mídia em seus posts" ON public.post_media;
CREATE POLICY "Criadora insere mídia em post pendente"
  ON public.post_media FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.posts post
    WHERE post.id = post_id
      AND post.creator_id = auth.uid()
      AND post.moderation_status = 'pending'
  ));

-- Cards e midia de posts pendentes so aparecem para autora ou admin.
CREATE OR REPLACE FUNCTION public.can_view_post_metadata(
  _post_id uuid,
  _viewer_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer AS (
    SELECT CASE
      WHEN auth.role() = 'service_role' THEN _viewer_id
      ELSE auth.uid()
    END AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.posts post
    CROSS JOIN viewer
    WHERE post.id = _post_id
      AND viewer.id IS NOT NULL
      AND public.is_age_verified(viewer.id)
      AND (
        post.moderation_status = 'approved'
        OR post.creator_id = viewer.id
        OR public.has_role(viewer.id, 'admin'::public.app_role)
      )
      AND public.creator_allows_viewer(post.creator_id, viewer.id)
      AND (
        NOT public.is_account_paused(post.creator_id)
        OR post.creator_id = viewer.id
        OR EXISTS (
          SELECT 1 FROM public.subscriptions subscription
          WHERE subscription.creator_id = post.creator_id
            AND subscription.subscriber_id = viewer.id
            AND subscription.status = 'active'::public.subscription_status
            AND (subscription.current_period_end IS NULL OR subscription.current_period_end > now())
        )
        OR EXISTS (
          SELECT 1 FROM public.ppv_unlocks unlock
          WHERE unlock.post_id = post.id AND unlock.user_id = viewer.id
        )
        OR EXISTS (
          SELECT 1 FROM public.post_goal_contributions contribution
          WHERE contribution.post_id = post.id AND contribution.user_id = viewer.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_post(
  _post_id uuid,
  _viewer_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer AS (
    SELECT CASE
      WHEN auth.role() = 'service_role' THEN _viewer_id
      ELSE auth.uid()
    END AS id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.posts post
    CROSS JOIN viewer
    WHERE post.id = _post_id
      AND viewer.id IS NOT NULL
      AND public.can_view_post_metadata(post.id, viewer.id)
      AND (
        post.creator_id = viewer.id
        OR public.has_role(viewer.id, 'admin'::public.app_role)
        OR post.visibility = 'public'::public.post_visibility
        OR (
          post.visibility = 'subscribers'::public.post_visibility
          AND EXISTS (
            SELECT 1 FROM public.subscriptions subscription
            WHERE subscription.creator_id = post.creator_id
              AND subscription.subscriber_id = viewer.id
              AND subscription.status = 'active'::public.subscription_status
              AND (subscription.current_period_end IS NULL OR subscription.current_period_end > now())
          )
        )
        OR (
          post.visibility = 'ppv'::public.post_visibility
          AND EXISTS (
            SELECT 1 FROM public.ppv_unlocks unlock
            WHERE unlock.post_id = post.id AND unlock.user_id = viewer.id
          )
        )
        OR (
          post.visibility = 'goal'::public.post_visibility
          AND EXISTS (
            SELECT 1 FROM public.post_goals goal
            WHERE goal.post_id = post.id AND goal.is_unlocked
          )
          AND EXISTS (
            SELECT 1 FROM public.post_goal_contributions contribution
            WHERE contribution.post_id = post.id AND contribution.user_id = viewer.id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_post_metadata(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_post_metadata(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_view_post(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Stories visíveis enquanto não expiram" ON public.stories;
DROP POLICY IF EXISTS "Stories: pública ou assinante ou dono" ON public.stories;
DROP POLICY IF EXISTS "Stories visíveis para adultos" ON public.stories;
CREATE POLICY "Stories moderados visíveis para adultos"
  ON public.stories FOR SELECT TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND expires_at > now()
    AND (
      moderation_status = 'approved'
      OR creator_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    AND (
      visibility = 'public'
      OR creator_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        visibility = 'subscribers'
        AND EXISTS (
          SELECT 1 FROM public.subscriptions subscription
          WHERE subscription.creator_id = stories.creator_id
            AND subscription.subscriber_id = auth.uid()
            AND subscription.status = 'active'::public.subscription_status
            AND (subscription.current_period_end IS NULL OR subscription.current_period_end > now())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Participantes leem mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Participantes adultos leem mensagens" ON public.chat_messages;
CREATE POLICY "Participantes leem mensagens moderadas"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND (
      moderation_status = 'approved'
      OR sender_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    AND EXISTS (
      SELECT 1 FROM public.chat_threads thread
      WHERE thread.id = thread_id AND auth.uid() IN (thread.user_a, thread.user_b)
    )
  );

DROP POLICY IF EXISTS "Participantes enviam mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Participantes adultos enviam mensagens" ON public.chat_messages;
DROP POLICY IF EXISTS "Unblocked participants send messages" ON public.chat_messages;
CREATE POLICY "Participantes adultos enviam mensagens moderadas"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_age_verified(auth.uid())
    AND auth.uid() = sender_id
    AND (
      (media_path IS NULL AND moderation_status = 'approved')
      OR (media_path IS NOT NULL AND moderation_status = 'pending')
    )
    AND EXISTS (
      SELECT 1 FROM public.chat_threads thread
      WHERE thread.id = thread_id
        AND auth.uid() IN (thread.user_a, thread.user_b)
        AND NOT public.users_are_blocked(thread.user_a, thread.user_b)
    )
  );

-- A RPC SECURITY DEFINER tambem exclui midia pendente para o destinatario.
CREATE OR REPLACE FUNCTION public.list_thread_messages(_thread_id uuid)
RETURNS TABLE (
  id uuid, thread_id uuid, sender_id uuid, body text, media_path text,
  mime_type text, ppv_price_cents integer, subscribers_only boolean,
  campaign_id uuid, message_kind text, gift_amount_cents integer,
  gift_message text, financial_transaction_id uuid, created_at timestamptz,
  read_at timestamptz, ppv_paid_at timestamptz, unlocked boolean
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
  IF _viewer IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads thread
    WHERE thread.id = _thread_id AND _viewer IN (thread.user_a, thread.user_b)
  ), (
    SELECT CASE WHEN thread.user_a = _viewer THEN thread.user_b ELSE thread.user_a END
    FROM public.chat_threads thread WHERE thread.id = _thread_id
  ) INTO _is_participant, _other;
  IF NOT _is_participant THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions subscription
    WHERE subscription.status = 'active'::public.subscription_status
      AND ((subscription.creator_id = _other AND subscription.subscriber_id = _viewer)
        OR (subscription.creator_id = _viewer AND subscription.subscriber_id = _other))
  ) INTO _has_sub;

  RETURN QUERY
  SELECT message.id, message.thread_id, message.sender_id, message.body,
    CASE
      WHEN message.media_path IS NULL THEN NULL
      WHEN message.sender_id = _viewer THEN message.media_path
      WHEN message.ppv_price_cents > 0 AND NOT EXISTS (
        SELECT 1 FROM public.chat_ppv_unlocks unlock
        WHERE unlock.message_id = message.id AND unlock.user_id = _viewer
      ) THEN NULL
      WHEN message.subscribers_only AND NOT _has_sub THEN NULL
      ELSE message.media_path
    END,
    CASE
      WHEN message.media_path IS NULL THEN NULL
      WHEN message.sender_id = _viewer THEN message.mime_type
      WHEN message.ppv_price_cents > 0 AND NOT EXISTS (
        SELECT 1 FROM public.chat_ppv_unlocks unlock
        WHERE unlock.message_id = message.id AND unlock.user_id = _viewer
      ) THEN NULL
      WHEN message.subscribers_only AND NOT _has_sub THEN NULL
      ELSE message.mime_type
    END,
    message.ppv_price_cents, message.subscribers_only, message.campaign_id,
    message.message_kind, message.gift_amount_cents, message.gift_message,
    message.financial_transaction_id, message.created_at, message.read_at,
    (SELECT min(unlock.unlocked_at) FROM public.chat_ppv_unlocks unlock
      WHERE unlock.message_id = message.id),
    (message.sender_id = _viewer
      OR (message.ppv_price_cents = 0 AND (NOT message.subscribers_only OR _has_sub))
      OR EXISTS (SELECT 1 FROM public.chat_ppv_unlocks unlock
        WHERE unlock.message_id = message.id AND unlock.user_id = _viewer))
  FROM public.chat_messages message
  WHERE message.thread_id = _thread_id
    AND (message.moderation_status = 'approved' OR message.sender_id = _viewer)
  ORDER BY message.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_thread_messages(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_thread_messages(uuid) TO service_role;

-- Mensagens de midia pendentes nao geram notificacao. A aprovacao gera a
-- notificacao por um segundo trigger de UPDATE.
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
  IF NEW.moderation_status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.moderation_status = 'approved' THEN RETURN NEW; END IF;
  SELECT CASE WHEN thread.user_a = NEW.sender_id THEN thread.user_b ELSE thread.user_a END
  INTO recipient_id FROM public.chat_threads thread
  WHERE thread.id = NEW.thread_id AND NEW.sender_id IN (thread.user_a, thread.user_b);
  IF recipient_id IS NULL
    OR NOT public.notifications_allow_actor(recipient_id, NEW.sender_id)
    OR public.notification_target_is_muted(recipient_id, 'thread', NEW.thread_id)
  THEN RETURN NEW; END IF;
  actor_name := public.actor_username(NEW.sender_id);
  DELETE FROM public.notifications notification
  WHERE notification.user_id = recipient_id
    AND notification.type = 'chat_message'
    AND notification.read_at IS NULL
    AND notification.metadata @> jsonb_build_object('thread_id', NEW.thread_id::text);
  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  VALUES (
    recipient_id, 'chat_message',
    CASE WHEN NEW.message_kind = 'gift' THEN 'Mimo confirmado no chat'
      ELSE 'Nova mensagem de @' || actor_name END,
    CASE WHEN NEW.body IS NOT NULL THEN left(NEW.body, 120) ELSE 'Mídia recebida' END,
    '/chat?thread=' || NEW.thread_id::text,
    jsonb_build_object('thread_id', NEW.thread_id::text, 'message_id', NEW.id::text,
      'actor_id', NEW.sender_id::text, 'actor_username', actor_name,
      'message_kind', NEW.message_kind)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_chat_message ON public.chat_messages;
CREATE TRIGGER notify_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();
DROP TRIGGER IF EXISTS notify_chat_message_after_moderation ON public.chat_messages;
CREATE TRIGGER notify_chat_message_after_moderation
  AFTER UPDATE OF moderation_status ON public.chat_messages
  FOR EACH ROW
  WHEN (OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
    AND NEW.moderation_status = 'approved')
  EXECUTE FUNCTION public.notify_chat_message();

NOTIFY pgrst, 'reload schema';

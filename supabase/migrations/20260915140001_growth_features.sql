-- =====================================================================
-- 2026-09-15 — Recursos de crescimento (V1.1)
--  1) Agendamento de posts: posts.published_at (feed só mostra o que já
--     publicou; a autora vê os agendados).
--  2) Mensagem automática de boas-vindas ao novo assinante (por criadora).
--  3) Preview com blur do conteúdo pago: post_media.blur_storage_path,
--     legível por quem pode ver o post existir (nunca a original).
--  4) Mass DM: segmento "vencendo em 3 dias" (combate churn do Pix).
-- =====================================================================

-- ------------------------- 1) Agendamento -------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS published_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS posts_creator_published_idx
  ON public.posts (creator_id, published_at DESC);

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
      -- Agendado: só a autora (e admin) vê antes da hora.
      AND (
        post.published_at <= now()
        OR post.creator_id = viewer.id
        OR public.has_role(viewer.id, 'admin'::public.app_role)
      )
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

DROP FUNCTION IF EXISTS public.list_feed_posts_v2(uuid, uuid, integer);
CREATE FUNCTION public.list_feed_posts_v2(
  _creator_id uuid DEFAULT NULL,
  _post_id uuid DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  body text,
  visibility public.post_visibility,
  price_cents integer,
  likes_count integer,
  comments_count integer,
  created_at timestamptz,
  published_at timestamptz,
  is_pinned boolean,
  has_access boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH visible AS (
    SELECT
      post.*,
      (post.creator_id = auth.uid() OR public.can_view_post(post.id, auth.uid())) AS has_access
    FROM public.posts post
    WHERE post.archived_at IS NULL
      AND (_post_id IS NULL OR post.id = _post_id)
      AND (_creator_id IS NULL OR post.creator_id = _creator_id)
      AND (
        post.creator_id = auth.uid()
        OR (
          public.can_view_post_metadata(post.id, auth.uid())
          AND NOT COALESCE(public.users_are_blocked(post.creator_id, auth.uid()), false)
        )
      )
    ORDER BY post.is_pinned DESC, post.published_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 30), 1), 100)
  )
  SELECT
    v.id, v.creator_id,
    CASE WHEN v.has_access THEN v.body ELSE NULL END,
    v.visibility, v.price_cents, v.likes_count, v.comments_count,
    v.created_at, v.published_at, v.is_pinned, v.has_access
  FROM visible v
  ORDER BY v.is_pinned DESC, v.published_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_feed_posts_v2(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_feed_posts_v2(uuid, uuid, integer) TO anon, authenticated, service_role;

-- ------------------------- 2) Boas-vindas -------------------------
CREATE TABLE IF NOT EXISTS public.creator_welcome_messages (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  media_path text,
  mime_type text,
  ppv_price_cents integer NOT NULL DEFAULT 0 CHECK (ppv_price_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A mídia precisa estar na pasta da própria criadora no bucket chat-media.
  CONSTRAINT welcome_media_owned CHECK (media_path IS NULL OR media_path LIKE creator_id::text || '/%'),
  CONSTRAINT welcome_has_content CHECK (char_length(btrim(body)) > 0 OR media_path IS NOT NULL)
);
ALTER TABLE public.creator_welcome_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Criadora gerencia boas-vindas" ON public.creator_welcome_messages;
CREATE POLICY "Criadora gerencia boas-vindas" ON public.creator_welcome_messages
  FOR ALL TO authenticated
  USING (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'::public.app_role))
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'::public.app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_welcome_messages TO authenticated;

-- ------------------------- 3) Blur do PPV -------------------------
ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS blur_storage_path text;

-- Quem pode ver que o post existe pode ver o blur (minúsculo e desfocado);
-- a mídia original continua atrás de can_view_post.
DROP POLICY IF EXISTS "Posts media: blur preview" ON storage.objects;
CREATE POLICY "Posts media: blur preview"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'posts'
    AND name LIKE '%-blur.jpg'
    AND public.is_age_verified(auth.uid())
    AND public.can_view_post_metadata(public.storage_path_to_post_id(name), auth.uid())
  );

-- ------------------------- 4) Mass DM -------------------------

-- enqueue_mass_dm: novo segmento 'expiring_subscribers' (vence em até 3 dias)
CREATE OR REPLACE FUNCTION public.enqueue_mass_dm(
  _segment public.mass_dm_segment,
  _tag_id UUID,
  _body TEXT,
  _media_path TEXT,
  _mime_type TEXT,
  _ppv_price_cents INTEGER,
  _scheduled_at TIMESTAMPTZ,
  _template_id UUID,
  _filter_hours INTEGER,
  _filter_link_clicked BOOLEAN
)
RETURNS TABLE(campaign_id UUID, recipients INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator UUID := auth.uid();
  _camp_id UUID;
  _target UUID;
  _count INTEGER := 0;
  _sched TIMESTAMPTZ := COALESCE(_scheduled_at, now());
BEGIN
  IF _creator IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT has_role(_creator, 'creator'::app_role) THEN
    RAISE EXCEPTION 'Apenas criadoras podem disparar mailings';
  END IF;
  IF coalesce(_body,'') = '' AND _media_path IS NULL THEN
    RAISE EXCEPTION 'Mensagem vazia';
  END IF;

  INSERT INTO public.mass_dm_campaigns(
    creator_id, segment, tag_id, body, media_path, mime_type,
    ppv_price_cents, status, scheduled_at, template_id,
    filter_last_chat_within_hours, filter_link_clicked
  )
  VALUES (
    _creator, _segment, _tag_id, _body, _media_path, _mime_type,
    coalesce(_ppv_price_cents,0),
    CASE WHEN _sched > now() THEN 'scheduled' ELSE 'queued' END,
    _sched, _template_id, _filter_hours, coalesce(_filter_link_clicked, false)
  )
  RETURNING id INTO _camp_id;

  -- enfileira jobs
  FOR _target IN (
    SELECT DISTINCT u FROM (
      SELECT s.subscriber_id AS u FROM public.subscriptions s
       WHERE _segment = 'active_subscribers' AND s.creator_id = _creator AND s.status = 'active'
      UNION
      SELECT s.subscriber_id FROM public.subscriptions s
       WHERE _segment = 'expired_subscribers' AND s.creator_id = _creator AND s.status IN ('canceled','expired')
      UNION
      SELECT sx.subscriber_id FROM public.subscriptions sx
       WHERE _segment = 'expiring_subscribers' AND sx.creator_id = _creator AND sx.status = 'active'
         AND sx.current_period_end IS NOT NULL
         AND sx.current_period_end BETWEEN now() AND now() + interval '3 days'
      UNION
      SELECT CASE WHEN t.user_a = _creator THEN t.user_b ELSE t.user_a END
        FROM public.chat_threads t
       WHERE _segment = 'non_subscribers'
         AND (t.user_a = _creator OR t.user_b = _creator)
         AND NOT EXISTS (
           SELECT 1 FROM public.subscriptions s2
            WHERE s2.creator_id = _creator
              AND s2.subscriber_id = CASE WHEN t.user_a = _creator THEN t.user_b ELSE t.user_a END
              AND s2.status = 'active'
         )
      UNION
      SELECT CASE WHEN t.user_a = _creator THEN t.user_b ELSE t.user_a END
        FROM public.chat_threads t
       WHERE _segment = 'all_contacts' AND (t.user_a = _creator OR t.user_b = _creator)
      UNION
      SELECT s.subscriber_id FROM public.subscriptions s
       WHERE _segment = 'all_contacts' AND s.creator_id = _creator
      UNION
      SELECT a.user_id FROM public.user_tag_assignments a
       WHERE _segment = 'tag' AND a.creator_id = _creator AND a.tag_id = _tag_id
    ) sub
    WHERE u IS NOT NULL AND u <> _creator
      -- filtro de janela de última conversa
      AND (
        _filter_hours IS NULL OR EXISTS (
          SELECT 1 FROM public.chat_threads tt
           WHERE ((tt.user_a = _creator AND tt.user_b = u) OR (tt.user_b = _creator AND tt.user_a = u))
             AND tt.last_message_at > now() - make_interval(hours => _filter_hours)
        )
      )
      -- filtro de já clicou em algum link/PPV
      AND (
        coalesce(_filter_link_clicked, false) = false OR EXISTS (
          SELECT 1 FROM public.chat_link_clicks c
           WHERE c.creator_id = _creator AND c.user_id = u
        )
      )
  ) LOOP
    INSERT INTO public.mass_dm_jobs(campaign_id, creator_id, recipient_id, body, ppv_price_cents, media_path, mime_type, scheduled_at)
    VALUES (_camp_id, _creator, _target, _body, coalesce(_ppv_price_cents,0), _media_path, _mime_type, _sched);
    _count := _count + 1;
  END LOOP;

  UPDATE public.mass_dm_campaigns
     SET recipients_count = _count, total_pending = _count
   WHERE id = _camp_id;

  -- atualiza contador de uso do template
  IF _template_id IS NOT NULL THEN
    UPDATE public.dm_templates SET uses_count = uses_count + 1 WHERE id = _template_id AND creator_id = _creator;
  END IF;

  RETURN QUERY SELECT _camp_id, _count;
END;
$$;

-- preview_mass_dm_recipients: novo segmento 'expiring_subscribers' (vence em até 3 dias)
CREATE OR REPLACE FUNCTION public.preview_mass_dm_recipients(
  _segment public.mass_dm_segment,
  _tag_id UUID,
  _filter_hours INTEGER,
  _filter_link_clicked BOOLEAN
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  display_name TEXT,
  is_active_sub BOOLEAN,
  is_expired_sub BOOLEAN,
  has_thread BOOLEAN,
  last_chat_at TIMESTAMPTZ,
  tags TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator UUID := auth.uid();
BEGIN
  IF _creator IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT has_role(_creator, 'creator'::app_role) THEN
    RAISE EXCEPTION 'Apenas criadoras';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT DISTINCT u FROM (
      SELECT s.subscriber_id AS u FROM public.subscriptions s
       WHERE _segment = 'active_subscribers' AND s.creator_id = _creator AND s.status = 'active'
      UNION
      SELECT s.subscriber_id FROM public.subscriptions s
       WHERE _segment = 'expired_subscribers' AND s.creator_id = _creator AND s.status IN ('canceled','expired')
      UNION
      SELECT sx.subscriber_id FROM public.subscriptions sx
       WHERE _segment = 'expiring_subscribers' AND sx.creator_id = _creator AND sx.status = 'active'
         AND sx.current_period_end IS NOT NULL
         AND sx.current_period_end BETWEEN now() AND now() + interval '3 days'
      UNION
      SELECT CASE WHEN t.user_a = _creator THEN t.user_b ELSE t.user_a END
        FROM public.chat_threads t
       WHERE _segment = 'non_subscribers'
         AND (t.user_a = _creator OR t.user_b = _creator)
         AND NOT EXISTS (
           SELECT 1 FROM public.subscriptions s2
            WHERE s2.creator_id = _creator
              AND s2.subscriber_id = CASE WHEN t.user_a = _creator THEN t.user_b ELSE t.user_a END
              AND s2.status = 'active'
         )
      UNION
      SELECT CASE WHEN t.user_a = _creator THEN t.user_b ELSE t.user_a END
        FROM public.chat_threads t
       WHERE _segment = 'all_contacts' AND (t.user_a = _creator OR t.user_b = _creator)
      UNION
      SELECT s.subscriber_id FROM public.subscriptions s
       WHERE _segment = 'all_contacts' AND s.creator_id = _creator
      UNION
      SELECT a.user_id FROM public.user_tag_assignments a
       WHERE _segment = 'tag' AND a.creator_id = _creator AND a.tag_id = _tag_id
    ) sub
    WHERE u IS NOT NULL AND u <> _creator
  )
  SELECT
    p.user_id,
    p.username,
    p.display_name,
    EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.creator_id = _creator AND s.subscriber_id = p.user_id AND s.status = 'active'),
    EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.creator_id = _creator AND s.subscriber_id = p.user_id AND s.status IN ('canceled','expired')),
    EXISTS(SELECT 1 FROM public.chat_threads t WHERE (t.user_a = _creator AND t.user_b = p.user_id) OR (t.user_b = _creator AND t.user_a = p.user_id)),
    (SELECT MAX(t.last_message_at) FROM public.chat_threads t WHERE (t.user_a = _creator AND t.user_b = p.user_id) OR (t.user_b = _creator AND t.user_a = p.user_id)),
    COALESCE(ARRAY(SELECT st.name FROM public.user_tag_assignments uta JOIN public.subscriber_tags st ON st.id = uta.tag_id WHERE uta.creator_id = _creator AND uta.user_id = p.user_id), ARRAY[]::TEXT[])
  FROM base b
  JOIN public.profiles p ON p.user_id = b.u
  WHERE
    (_filter_hours IS NULL OR EXISTS (
      SELECT 1 FROM public.chat_threads tt
       WHERE ((tt.user_a = _creator AND tt.user_b = p.user_id) OR (tt.user_b = _creator AND tt.user_a = p.user_id))
         AND tt.last_message_at > now() - make_interval(hours => _filter_hours)
    ))
    AND (
      coalesce(_filter_link_clicked, false) = false OR EXISTS (
        SELECT 1 FROM public.chat_link_clicks c
         WHERE c.creator_id = _creator AND c.user_id = p.user_id
      )
    );
END;
$$;

NOTIFY pgrst, 'reload schema';

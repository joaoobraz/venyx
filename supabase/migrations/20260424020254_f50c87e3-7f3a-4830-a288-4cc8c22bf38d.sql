-- ============================================
-- 1. SUBSCRIBER TAGS (tags da criadora)
-- ============================================
CREATE TABLE public.subscriber_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#D4AF7A',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, name)
);

ALTER TABLE public.subscriber_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criadora vê suas tags" ON public.subscriber_tags
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora cria suas tags" ON public.subscriber_tags
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND has_role(auth.uid(), 'creator'::app_role));
CREATE POLICY "Criadora atualiza suas tags" ON public.subscriber_tags
  FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora apaga suas tags" ON public.subscriber_tags
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE INDEX idx_subscriber_tags_creator ON public.subscriber_tags(creator_id);

-- ============================================
-- 2. USER TAG ASSIGNMENTS (fã ↔ tag)
-- ============================================
CREATE TABLE public.user_tag_assignments (
  tag_id UUID NOT NULL REFERENCES public.subscriber_tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, user_id)
);

ALTER TABLE public.user_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criadora vê atribuições suas" ON public.user_tag_assignments
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora atribui tags" ON public.user_tag_assignments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND has_role(auth.uid(), 'creator'::app_role));
CREATE POLICY "Criadora remove atribuições" ON public.user_tag_assignments
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE INDEX idx_uta_creator_user ON public.user_tag_assignments(creator_id, user_id);
CREATE INDEX idx_uta_tag ON public.user_tag_assignments(tag_id);

-- ============================================
-- 3. MASS DM CAMPAIGNS (registro de disparos)
-- ============================================
CREATE TYPE public.mass_dm_segment AS ENUM (
  'active_subscribers',
  'expired_subscribers',
  'non_subscribers',
  'all_contacts',
  'tag'
);

CREATE TABLE public.mass_dm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  segment public.mass_dm_segment NOT NULL,
  tag_id UUID REFERENCES public.subscriber_tags(id) ON DELETE SET NULL,
  body TEXT,
  media_path TEXT,
  mime_type TEXT,
  ppv_price_cents INTEGER NOT NULL DEFAULT 0,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mass_dm_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criadora vê suas campanhas" ON public.mass_dm_campaigns
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora cria suas campanhas" ON public.mass_dm_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND has_role(auth.uid(), 'creator'::app_role));

CREATE INDEX idx_mass_dm_creator ON public.mass_dm_campaigns(creator_id, created_at DESC);

-- ============================================
-- 4. RPC: mass_send_dm (disparo em lote)
-- ============================================
CREATE OR REPLACE FUNCTION public.mass_send_dm(
  _segment public.mass_dm_segment,
  _tag_id UUID,
  _body TEXT,
  _media_path TEXT,
  _mime_type TEXT,
  _ppv_price_cents INTEGER
) RETURNS TABLE(campaign_id UUID, sent INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator UUID := auth.uid();
  _camp_id UUID;
  _target_user UUID;
  _thread UUID;
  _sent INTEGER := 0;
BEGIN
  IF _creator IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT has_role(_creator, 'creator'::app_role) THEN
    RAISE EXCEPTION 'Apenas criadoras podem enviar mailings';
  END IF;
  IF coalesce(_body, '') = '' AND _media_path IS NULL THEN
    RAISE EXCEPTION 'Mensagem vazia';
  END IF;

  INSERT INTO public.mass_dm_campaigns(creator_id, segment, tag_id, body, media_path, mime_type, ppv_price_cents, status)
  VALUES (_creator, _segment, _tag_id, _body, _media_path, _mime_type, coalesce(_ppv_price_cents, 0), 'running')
  RETURNING id INTO _camp_id;

  FOR _target_user IN (
    SELECT DISTINCT u FROM (
      -- Assinantes ativos
      SELECT s.subscriber_id AS u
        FROM public.subscriptions s
       WHERE _segment = 'active_subscribers'
         AND s.creator_id = _creator
         AND s.status = 'active'
      UNION
      -- Ex-assinantes (cancelado/expirado)
      SELECT s.subscriber_id
        FROM public.subscriptions s
       WHERE _segment = 'expired_subscribers'
         AND s.creator_id = _creator
         AND s.status IN ('canceled','expired')
      UNION
      -- Não-assinantes que já conversaram (lead)
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
      -- Todos os contatos (qualquer thread + assinantes)
      SELECT CASE WHEN t.user_a = _creator THEN t.user_b ELSE t.user_a END
        FROM public.chat_threads t
       WHERE _segment = 'all_contacts'
         AND (t.user_a = _creator OR t.user_b = _creator)
      UNION
      SELECT s.subscriber_id
        FROM public.subscriptions s
       WHERE _segment = 'all_contacts' AND s.creator_id = _creator
      UNION
      -- Por tag
      SELECT a.user_id
        FROM public.user_tag_assignments a
       WHERE _segment = 'tag'
         AND a.creator_id = _creator
         AND a.tag_id = _tag_id
    ) sub
    WHERE u IS NOT NULL AND u <> _creator
  ) LOOP
    -- thread (ordem canônica: menor uuid primeiro)
    SELECT id INTO _thread FROM public.chat_threads
     WHERE (user_a = LEAST(_creator, _target_user) AND user_b = GREATEST(_creator, _target_user))
     LIMIT 1;
    IF _thread IS NULL THEN
      INSERT INTO public.chat_threads(user_a, user_b)
      VALUES (LEAST(_creator, _target_user), GREATEST(_creator, _target_user))
      RETURNING id INTO _thread;
    END IF;

    INSERT INTO public.chat_messages(thread_id, sender_id, body, media_path, mime_type, ppv_price_cents)
    VALUES (_thread, _creator, _body, _media_path, _mime_type, coalesce(_ppv_price_cents, 0));

    _sent := _sent + 1;
  END LOOP;

  UPDATE public.mass_dm_campaigns
     SET sent_count = _sent, recipients_count = _sent, status = 'completed'
   WHERE id = _camp_id;

  RETURN QUERY SELECT _camp_id, _sent;
END;
$$;

REVOKE ALL ON FUNCTION public.mass_send_dm(public.mass_dm_segment, UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mass_send_dm(public.mass_dm_segment, UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

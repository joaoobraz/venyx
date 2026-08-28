-- =========================================
-- 1) DM TEMPLATES
-- =========================================
CREATE TABLE public.dm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  default_ppv_price_cents INTEGER NOT NULL DEFAULT 0,
  uses_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dm_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Criadora vê seus templates" ON public.dm_templates
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora cria templates" ON public.dm_templates
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND has_role(auth.uid(), 'creator'::app_role));
CREATE POLICY "Criadora edita templates" ON public.dm_templates
  FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora apaga templates" ON public.dm_templates
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE TRIGGER trg_dm_templates_updated
  BEFORE UPDATE ON public.dm_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 2) Colunas extras em campanhas + mensagens
-- =========================================
ALTER TABLE public.mass_dm_campaigns
  ADD COLUMN scheduled_at TIMESTAMPTZ,
  ADD COLUMN template_id UUID REFERENCES public.dm_templates(id) ON DELETE SET NULL,
  ADD COLUMN filter_last_chat_within_hours INTEGER,
  ADD COLUMN filter_link_clicked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN total_failed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN total_pending INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.chat_messages
  ADD COLUMN campaign_id UUID;

-- =========================================
-- 3) MASS DM JOBS (fila)
-- =========================================
CREATE TYPE public.mass_dm_job_status AS ENUM ('pending','processing','sent','failed','cancelled');

CREATE TABLE public.mass_dm_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.mass_dm_campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  body TEXT,
  ppv_price_cents INTEGER NOT NULL DEFAULT 0,
  media_path TEXT,
  mime_type TEXT,
  status public.mass_dm_job_status NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_pending ON public.mass_dm_jobs(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_jobs_campaign ON public.mass_dm_jobs(campaign_id);
ALTER TABLE public.mass_dm_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Criadora vê seus jobs" ON public.mass_dm_jobs
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora cancela jobs" ON public.mass_dm_jobs
  FOR UPDATE TO authenticated USING (auth.uid() = creator_id);

-- =========================================
-- 4) CREATOR LINK TREE
-- =========================================
CREATE TABLE public.creator_link_pages (
  user_id UUID PRIMARY KEY,
  bio TEXT,
  theme TEXT NOT NULL DEFAULT 'champagne',
  background_color TEXT,
  text_color TEXT,
  button_style TEXT NOT NULL DEFAULT 'rounded',
  cover_url TEXT,
  show_avatar BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT true,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_link_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Páginas de link visíveis a todos" ON public.creator_link_pages
  FOR SELECT TO public USING (is_published = true OR auth.uid() = user_id);
CREATE POLICY "Criadora cria sua página" ON public.creator_link_pages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Criadora edita sua página" ON public.creator_link_pages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_link_pages_updated
  BEFORE UPDATE ON public.creator_link_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.creator_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_creator_links_user ON public.creator_links(user_id, position);
ALTER TABLE public.creator_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Links visíveis a todos" ON public.creator_links
  FOR SELECT TO public USING (is_active = true OR auth.uid() = user_id);
CREATE POLICY "Criadora cria links" ON public.creator_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Criadora edita links" ON public.creator_links
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Criadora apaga links" ON public.creator_links
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_creator_links_updated
  BEFORE UPDATE ON public.creator_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 5) CHAT LINK CLICKS (para segmentar quem abriu PPV/link)
-- =========================================
CREATE TABLE public.chat_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  click_type TEXT NOT NULL DEFAULT 'open',
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_clicks_creator_user ON public.chat_link_clicks(creator_id, user_id);
ALTER TABLE public.chat_link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário registra clique" ON public.chat_link_clicks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Criadora vê cliques nas suas mensagens" ON public.chat_link_clicks
  FOR SELECT TO authenticated USING (auth.uid() = creator_id OR auth.uid() = user_id);

-- =========================================
-- 6) FUNÇÃO: enfileirar disparo (substitui o síncrono)
-- =========================================
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

-- =========================================
-- 7) FUNÇÃO: processar lote da fila (chamada pelo cron)
-- =========================================
CREATE OR REPLACE FUNCTION public.process_mass_dm_batch(_limit INTEGER DEFAULT 50)
RETURNS TABLE(processed INTEGER, sent INTEGER, failed INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job RECORD;
  _thread UUID;
  _processed INTEGER := 0;
  _sent INTEGER := 0;
  _failed INTEGER := 0;
BEGIN
  FOR _job IN (
    SELECT * FROM public.mass_dm_jobs
     WHERE status = 'pending' AND scheduled_at <= now()
     ORDER BY scheduled_at
     LIMIT _limit
     FOR UPDATE SKIP LOCKED
  ) LOOP
    UPDATE public.mass_dm_jobs SET status = 'processing', attempts = attempts + 1 WHERE id = _job.id;
    BEGIN
      SELECT id INTO _thread FROM public.chat_threads
       WHERE (user_a = LEAST(_job.creator_id, _job.recipient_id)
              AND user_b = GREATEST(_job.creator_id, _job.recipient_id))
       LIMIT 1;
      IF _thread IS NULL THEN
        INSERT INTO public.chat_threads(user_a, user_b)
        VALUES (LEAST(_job.creator_id, _job.recipient_id), GREATEST(_job.creator_id, _job.recipient_id))
        RETURNING id INTO _thread;
      END IF;

      INSERT INTO public.chat_messages(thread_id, sender_id, body, media_path, mime_type, ppv_price_cents, campaign_id)
      VALUES (_thread, _job.creator_id, _job.body, _job.media_path, _job.mime_type, _job.ppv_price_cents, _job.campaign_id);

      UPDATE public.mass_dm_jobs SET status = 'sent', processed_at = now(), error_reason = NULL WHERE id = _job.id;
      UPDATE public.mass_dm_campaigns
         SET sent_count = sent_count + 1, total_pending = GREATEST(total_pending - 1, 0)
       WHERE id = _job.campaign_id;
      _sent := _sent + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.mass_dm_jobs SET status = 'failed', processed_at = now(), error_reason = SQLERRM WHERE id = _job.id;
      UPDATE public.mass_dm_campaigns
         SET total_failed = total_failed + 1, total_pending = GREATEST(total_pending - 1, 0)
       WHERE id = _job.campaign_id;
      _failed := _failed + 1;
    END;
    _processed := _processed + 1;
  END LOOP;

  -- marca campanhas finalizadas
  UPDATE public.mass_dm_campaigns
     SET status = 'completed'
   WHERE total_pending = 0 AND status IN ('queued','scheduled','running');

  RETURN QUERY SELECT _processed, _sent, _failed;
END;
$$;

-- =========================================
-- 8) FUNÇÃO: pré-visualizar destinatários (para export)
-- =========================================
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

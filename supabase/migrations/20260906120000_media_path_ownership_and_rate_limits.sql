-- =====================================================================
-- 2026-09-06 — Fechamento de duas pontas soltas antes do lançamento
--
-- 1) DONO DO CAMINHO DA MÍDIA (crítico)
--    O servidor assinava qualquer storage_path/media_path gravado em
--    post_media, stories e chat_messages. Como os caminhos são previsíveis
--    (<creator_id>/<post_id>/<posição>.<ext>), uma criadora conseguia apontar
--    uma linha própria para o arquivo de outra criadora e receber a URL
--    assinada do conteúdo pago. Agora o banco exige que todo caminho comece
--    com o id do dono (posts: creator_id do post; stories: creator_id;
--    chat: sender_id) e o servidor confere de novo antes de assinar.
--
-- 2) RATE LIMIT (alto)
--    Tabela + função consume_rate_limit usada pelo servidor (service role)
--    para limitar cobranças Pix, verificação de identidade e busca.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Dono do caminho da mídia
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.media_path_belongs_to(_owner uuid, _path text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT _owner IS NOT NULL
     AND _path IS NOT NULL
     AND _path LIKE _owner::text || '/%'
     AND _path NOT LIKE '%..%'
     AND pg_catalog.length(_path) <= 500;
$$;

REVOKE ALL ON FUNCTION public.media_path_belongs_to(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.media_path_belongs_to(uuid, text) TO authenticated, service_role;

-- post_media: dono = criadora do post (storage_path e cover_storage_path)
CREATE OR REPLACE FUNCTION public.enforce_post_media_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _creator uuid;
BEGIN
  SELECT creator_id INTO _creator FROM public.posts WHERE id = NEW.post_id;
  IF _creator IS NULL THEN
    RAISE EXCEPTION 'FANLIRA_MEDIA_PATH_POST_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  IF NOT public.media_path_belongs_to(_creator, NEW.storage_path) THEN
    RAISE EXCEPTION 'FANLIRA_MEDIA_PATH_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NEW.cover_storage_path IS NOT NULL
     AND NOT public.media_path_belongs_to(_creator, NEW.cover_storage_path) THEN
    RAISE EXCEPTION 'FANLIRA_MEDIA_PATH_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_post_media_path() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_post_media_path ON public.post_media;
CREATE TRIGGER enforce_post_media_path
  BEFORE INSERT OR UPDATE OF storage_path, cover_storage_path, post_id ON public.post_media
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_media_path();

-- stories: dono = creator_id
CREATE OR REPLACE FUNCTION public.enforce_story_media_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.media_path_belongs_to(NEW.creator_id, NEW.media_path) THEN
    RAISE EXCEPTION 'FANLIRA_MEDIA_PATH_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_story_media_path() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_story_media_path ON public.stories;
CREATE TRIGGER enforce_story_media_path
  BEFORE INSERT OR UPDATE OF media_path, creator_id ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_story_media_path();

-- chat_messages: dono = sender_id (mensagens só de texto passam)
CREATE OR REPLACE FUNCTION public.enforce_chat_media_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.media_path IS NOT NULL
     AND NOT public.media_path_belongs_to(NEW.sender_id, NEW.media_path) THEN
    RAISE EXCEPTION 'FANLIRA_MEDIA_PATH_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_chat_media_path() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_chat_media_path ON public.chat_messages;
CREATE TRIGGER enforce_chat_media_path
  BEFORE INSERT OR UPDATE OF media_path, sender_id ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_media_path();

-- Relatório (não bloqueia): linhas antigas fora do padrão, para revisão manual.
DO $$
DECLARE
  _posts integer;
  _stories integer;
  _chat integer;
BEGIN
  SELECT count(*) INTO _posts
    FROM public.post_media pm JOIN public.posts p ON p.id = pm.post_id
   WHERE NOT public.media_path_belongs_to(p.creator_id, pm.storage_path)
      OR (pm.cover_storage_path IS NOT NULL
          AND NOT public.media_path_belongs_to(p.creator_id, pm.cover_storage_path));
  SELECT count(*) INTO _stories
    FROM public.stories s WHERE NOT public.media_path_belongs_to(s.creator_id, s.media_path);
  SELECT count(*) INTO _chat
    FROM public.chat_messages m
   WHERE m.media_path IS NOT NULL AND NOT public.media_path_belongs_to(m.sender_id, m.media_path);
  RAISE NOTICE 'media_path fora do padrão do dono: post_media=% stories=% chat_messages=%',
    _posts, _stories, _chat;
END
$$;

-- ---------------------------------------------------------------------
-- 2) Rate limit (janela fixa por chave; só o service role consome)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket_key        text PRIMARY KEY,
  count             integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(_key text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _now timestamptz := pg_catalog.now();
  _window interval := pg_catalog.make_interval(secs => _window_seconds);
  _count integer;
BEGIN
  IF pg_catalog.current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'FANLIRA_RATE_LIMIT_SERVICE_ONLY' USING ERRCODE = '42501';
  END IF;
  IF _key IS NULL OR pg_catalog.length(_key) = 0 OR pg_catalog.length(_key) > 200
     OR _limit IS NULL OR _limit < 1 OR _window_seconds IS NULL OR _window_seconds < 1 THEN
    RAISE EXCEPTION 'FANLIRA_RATE_LIMIT_BAD_ARGS' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rate_limits AS rl (bucket_key, count, window_started_at, updated_at)
  VALUES (_key, 1, _now, _now)
  ON CONFLICT (bucket_key) DO UPDATE SET
    count = CASE WHEN rl.window_started_at + _window < _now THEN 1 ELSE rl.count + 1 END,
    window_started_at = CASE WHEN rl.window_started_at + _window < _now THEN _now ELSE rl.window_started_at END,
    updated_at = _now
  RETURNING rl.count INTO _count;

  -- Faxina ocasional de chaves paradas há mais de um dia.
  IF pg_catalog.random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE updated_at < _now - interval '1 day';
  END IF;

  RETURN _count <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------
-- 3) Documentos KYC: sem leitura direta pelo Storage
--    O painel admin já usa getKycSignedUrlServer (service role + MFA).
--    A policy antiga deixava qualquer sessão de admin, mesmo sem 2FA,
--    baixar documentos e selfies direto do bucket.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins read all KYC files" ON storage.objects;

-- ---------------------------------------------------------------------
-- 4) Bloqueio da criadora vale para posts e stories
--    Comentários e chat já respeitavam user_blocks; posts e stories não.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Posts visíveis para adultos conforme acesso" ON public.posts;
CREATE POLICY "Posts visíveis para adultos conforme acesso"
  ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_post_metadata(id, auth.uid())
    AND NOT public.users_are_blocked(creator_id, auth.uid())
  );

DROP POLICY IF EXISTS "Stories moderados visíveis para adultos" ON public.stories;
CREATE POLICY "Stories moderados visíveis para adultos"
  ON public.stories FOR SELECT TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND expires_at > now()
    AND NOT public.users_are_blocked(creator_id, auth.uid())
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

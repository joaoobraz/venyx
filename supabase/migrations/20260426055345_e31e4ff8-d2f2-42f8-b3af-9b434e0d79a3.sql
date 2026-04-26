-- =====================================================================
-- 1) Função segura para listar mensagens de um thread.
--    Mascara media_path / mime_type quando a mensagem é PPV (ou
--    "subscribers_only") e o viewer ainda não tem direito de ver.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_thread_messages(_thread_id uuid)
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
SET search_path = public
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
    (SELECT CASE WHEN t.user_a = _viewer THEN t.user_b ELSE t.user_a END
       FROM public.chat_threads t WHERE t.id = _thread_id)
  INTO _is_participant, _other;

  IF NOT _is_participant THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Assinatura ativa entre viewer e o "outro" usuário (em qualquer direção)
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.status = 'active'
       AND ((s.creator_id = _other AND s.subscriber_id = _viewer)
         OR (s.creator_id = _viewer AND s.subscriber_id = _other))
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
    END AS media_path,
    CASE
      WHEN m.media_path IS NULL THEN NULL
      WHEN m.sender_id = _viewer THEN m.mime_type
      WHEN m.ppv_price_cents > 0 AND NOT EXISTS (
        SELECT 1 FROM public.chat_ppv_unlocks u
         WHERE u.message_id = m.id AND u.user_id = _viewer
      ) THEN NULL
      WHEN m.subscribers_only AND NOT _has_sub THEN NULL
      ELSE m.mime_type
    END AS mime_type,
    m.ppv_price_cents,
    m.subscribers_only,
    m.campaign_id,
    m.created_at,
    m.read_at,
    (
      m.sender_id = _viewer
      OR (m.ppv_price_cents = 0 AND (NOT m.subscribers_only OR _has_sub))
      OR EXISTS (
        SELECT 1 FROM public.chat_ppv_unlocks u
         WHERE u.message_id = m.id AND u.user_id = _viewer
      )
    ) AS unlocked
  FROM public.chat_messages m
  WHERE m.thread_id = _thread_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_thread_messages(uuid) TO authenticated;

-- =====================================================================
-- 2) Remover chat_messages e chat_threads do publication Realtime.
--    A UI já recarrega via RPC ao detectar evento; não precisa do payload.
--    Vamos manter apenas um canal "leve" via broadcast manual.
--    (A UI atual usa postgres_changes — vamos trocá-la por broadcast no
--     código de aplicação. Para isso aqui, removemos a publicação para
--     impedir vazamento do row completo pelo wire.)
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages';
  END IF;
END $$;

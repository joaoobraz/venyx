
-- 1) Função: expirar assinaturas vencidas
CREATE OR REPLACE FUNCTION public.expire_due_subscriptions()
RETURNS TABLE(expired_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  WITH upd AS (
    UPDATE public.subscriptions
       SET status = 'expired'
     WHERE status = 'active'
       AND current_period_end IS NOT NULL
       AND current_period_end < now()
    RETURNING id
  )
  SELECT count(*) INTO _count FROM upd;
  RETURN QUERY SELECT COALESCE(_count, 0);
END;
$$;

-- 2) Função: listar assinaturas vencendo em N dias (pra futuro renew reminder)
CREATE OR REPLACE FUNCTION public.subscriptions_expiring_in(_days integer DEFAULT 3)
RETURNS TABLE(id uuid, subscriber_id uuid, creator_id uuid, current_period_end timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.subscriber_id, s.creator_id, s.current_period_end
  FROM public.subscriptions s
  WHERE s.status = 'active'
    AND s.current_period_end BETWEEN now() AND now() + make_interval(days => _days);
$$;

-- 3) Função: deletar stories expirados (DB + retorna paths pra o cron rota apagar do storage)
CREATE OR REPLACE FUNCTION public.cleanup_expired_stories()
RETURNS TABLE(deleted_paths text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _paths text[];
BEGIN
  WITH del AS (
    DELETE FROM public.stories
     WHERE expires_at < now()
    RETURNING media_path
  )
  SELECT COALESCE(array_agg(media_path) FILTER (WHERE media_path IS NOT NULL), ARRAY[]::text[]) INTO _paths FROM del;
  RETURN QUERY SELECT _paths;
END;
$$;

-- 4) Garantir extensions pra cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

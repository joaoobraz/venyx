-- =====================================================================
-- 2026-09-14 — Corrige consume_rate_limit: nunca deixava passar nada
--
-- A checagem usava current_setting('request.jwt.claim.role', true) direto.
-- Nesse projeto (como em record_creator_consents e
-- submit_creator_kyc_with_consent) o jeito que funciona de verdade é
-- auth.role(), que também sabe ler o claim de dentro de request.jwt.claims
-- quando ele vem como JSON. Com o current_setting cru, a função sempre
-- caía no RAISE EXCEPTION, então TODA chamada de rate limit falhava
-- (cobrança, verificação de identidade, busca de criadoras) — confirmado
-- no teste real do usuário em 2026-09-14 (erro "Serviço temporariamente
-- indisponível" na verificação de identidade).
-- =====================================================================

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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
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

NOTIFY pgrst, 'reload schema';

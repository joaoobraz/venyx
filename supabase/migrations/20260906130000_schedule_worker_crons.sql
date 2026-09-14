-- =====================================================================
-- 2026-09-06 — Agendar as rotinas HTTP do Worker que não tinham agendador
--
-- expire_due_subscriptions, lembretes e mass DM já rodam via pg_cron dentro
-- do banco. Mas duas rotinas só existem como rota HTTP no Worker e ninguém
-- as chamava:
--   POST /api/public/cron/reconcile-pix   (cobranças pagas cujo webhook falhou)
--   POST /api/public/cron/cleanup-stories (apaga arquivos de stories expirados)
--
-- Ambas exigem o cabeçalho x-cron-secret = CRON_SECRET. O segredo fica no
-- Vault do Supabase com o nome 'fanlira_cron_secret'. Enquanto o segredo não
-- estiver cadastrado, o job simplesmente não chama nada (sem erro).
--
-- Para cadastrar (uma vez, no SQL Editor, substituindo pelo valor real):
--   SELECT vault.create_secret('<VALOR_DO_CRON_SECRET>', 'fanlira_cron_secret');
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.call_worker_cron(_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
   WHERE name = 'fanlira_cron_secret'
   LIMIT 1;
  IF _secret IS NULL OR pg_catalog.length(_secret) < 32 THEN
    RAISE NOTICE 'fanlira_cron_secret ausente no Vault; rotina % não chamada', _path;
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://fanlira.com.br' || _path,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', _secret
    ),
    timeout_milliseconds := 25000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.call_worker_cron(text) FROM PUBLIC, anon, authenticated;

-- Reconciliação Pix a cada 10 minutos (pega pagamentos cujo webhook não chegou).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fanlira-reconcile-pix';
SELECT cron.schedule(
  'fanlira-reconcile-pix',
  '*/10 * * * *',
  $job$SELECT public.call_worker_cron('/api/public/cron/reconcile-pix');$job$
);

-- Limpeza de arquivos de stories expirados, uma vez por dia (03:30 UTC).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fanlira-cleanup-stories';
SELECT cron.schedule(
  'fanlira-cleanup-stories',
  '30 3 * * *',
  $job$SELECT public.call_worker_cron('/api/public/cron/cleanup-stories');$job$
);

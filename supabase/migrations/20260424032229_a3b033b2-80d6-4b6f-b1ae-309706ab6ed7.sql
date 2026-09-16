-- Fresh projects do not have pg_cron enabled by default.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove qualquer agendamento antigo que chamava o endpoint HTTP
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT jobid, jobname FROM cron.job WHERE jobname IN ('process-mass-dm-queue', 'process-mailing-queue') LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Agenda processamento interno (sem HTTP, sem secret) a cada minuto
SELECT cron.schedule(
  'process-mass-dm-queue-internal',
  '* * * * *',
  $$ SELECT public.process_mass_dm_batch(50); $$
);

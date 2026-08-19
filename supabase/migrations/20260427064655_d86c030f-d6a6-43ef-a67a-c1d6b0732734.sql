
-- Os jobs HTTP do protótipo Lovable foram removidos. Em instalações novas,
-- nunca agendamos chamadas para hosts antigos nem persistimos segredos no SQL.
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid
      FROM cron.job
     WHERE jobname IN (
       'lovable-process-mass-dm',
       'lovable-expire-subscriptions',
       'lovable-cleanup-stories'
     )
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END
$$;

-- The public Venyx host has not been selected yet. Disable jobs that still call
-- the previous Lovable preview so staging never sends operational traffic there.
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

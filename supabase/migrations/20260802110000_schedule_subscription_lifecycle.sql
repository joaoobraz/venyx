-- Run the subscription lifecycle inside Supabase so it does not depend on a
-- public application host. pg_cron uses UTC.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  _job record;
BEGIN
  FOR _job IN
    SELECT jobid
      FROM cron.job
     WHERE jobname IN (
       'venyx-expire-subscriptions',
       'venyx-subscription-renewal-reminders'
     )
  LOOP
    PERFORM cron.unschedule(_job.jobid);
  END LOOP;
END
$$;

-- Expire access shortly after the paid period ends.
SELECT cron.schedule(
  'venyx-expire-subscriptions',
  '7 * * * *',
  $job$SELECT public.expire_due_subscriptions();$job$
);
-- 12:05 UTC = 09:05 in Sao Paulo. The reminder function is idempotent.
SELECT cron.schedule(
  'venyx-subscription-renewal-reminders',
  '5 12 * * *',
  $job$SELECT public.dispatch_subscription_renewal_reminders();$job$
);

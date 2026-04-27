
-- desagenda se já existirem (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('lovable-process-mass-dm');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('lovable-expire-subscriptions');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('lovable-cleanup-stories');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- a cada minuto: processar mass DM
SELECT cron.schedule(
  'lovable-process-mass-dm',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--59549983-d8c7-43dd-bb65-ffb37fd041ca.lovable.app/api/public/cron/process-mass-dm',
    headers:='{"Content-Type":"application/json","x-cron-secret":"ab16ccc09e80ed67d15ed07c6cd4c98671115586866d2d3d72fd6e9976a7d8cd"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- diariamente 00:05: expirar assinaturas
SELECT cron.schedule(
  'lovable-expire-subscriptions',
  '5 0 * * *',
  $$
  SELECT net.http_post(
    url:='https://project--59549983-d8c7-43dd-bb65-ffb37fd041ca.lovable.app/api/public/cron/expire-subscriptions',
    headers:='{"Content-Type":"application/json","x-cron-secret":"ab16ccc09e80ed67d15ed07c6cd4c98671115586866d2d3d72fd6e9976a7d8cd"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- a cada hora: limpar stories expirados
SELECT cron.schedule(
  'lovable-cleanup-stories',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--59549983-d8c7-43dd-bb65-ffb37fd041ca.lovable.app/api/public/cron/cleanup-stories',
    headers:='{"Content-Type":"application/json","x-cron-secret":"ab16ccc09e80ed67d15ed07c6cd4c98671115586866d2d3d72fd6e9976a7d8cd"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

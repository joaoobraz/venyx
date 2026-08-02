-- Privacy-aware operational events, alerts and funnel measurement.

CREATE TABLE IF NOT EXISTS public.operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_kind text NOT NULL CHECK (event_kind IN ('product', 'error', 'security', 'system')),
  event_name text NOT NULL CHECK (char_length(event_name) BETWEEN 2 AND 80),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'high', 'critical')),
  user_id uuid,
  anonymous_id_hash text CHECK (anonymous_id_hash IS NULL OR char_length(anonymous_id_hash) = 64),
  route text CHECK (route IS NULL OR char_length(route) <= 255),
  device_family text CHECK (device_family IS NULL OR device_family IN ('desktop', 'mobile', 'tablet', 'unknown')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text CHECK (fingerprint IS NULL OR char_length(fingerprint) <= 128),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operational_events_name_created_idx
  ON public.operational_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS operational_events_errors_idx
  ON public.operational_events(severity, created_at DESC)
  WHERE event_kind = 'error';
CREATE INDEX IF NOT EXISTS operational_events_anon_rate_idx
  ON public.operational_events(anonymous_id_hash, created_at DESC)
  WHERE anonymous_id_hash IS NOT NULL;

ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operational_events FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.operational_events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operational_alerts_queue_idx
  ON public.operational_alerts(status, created_at DESC);
ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operational_alerts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_operational_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.event_kind = 'error' AND NEW.severity IN ('high', 'critical') THEN
    INSERT INTO public.operational_alerts(event_id) VALUES (NEW.id)
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_operational_alert ON public.operational_events;
CREATE TRIGGER trg_create_operational_alert
  AFTER INSERT ON public.operational_events
  FOR EACH ROW EXECUTE FUNCTION public.create_operational_alert();

CREATE OR REPLACE FUNCTION public.record_operational_event(
  _event_kind text,
  _event_name text,
  _severity text,
  _user_id uuid,
  _anonymous_id_hash text,
  _route text,
  _device_family text,
  _metadata jsonb,
  _fingerprint text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _event_id uuid;
  _recent_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'VENYX_SERVICE_ROLE_REQUIRED';
  END IF;
  IF _anonymous_id_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(_anonymous_id_hash));
    SELECT count(*) INTO _recent_count
    FROM public.operational_events
    WHERE anonymous_id_hash = _anonymous_id_hash
      AND created_at > now() - interval '1 hour';
    IF _recent_count >= 180 THEN
      RAISE EXCEPTION 'VENYX_TELEMETRY_RATE_LIMIT';
    END IF;
  END IF;

  INSERT INTO public.operational_events(
    event_kind,
    event_name,
    severity,
    user_id,
    anonymous_id_hash,
    route,
    device_family,
    metadata,
    fingerprint
  ) VALUES (
    _event_kind,
    _event_name,
    _severity,
    _user_id,
    _anonymous_id_hash,
    LEFT(_route, 255),
    _device_family,
    COALESCE(_metadata, '{}'::jsonb),
    LEFT(_fingerprint, 128)
  ) RETURNING id INTO _event_id;
  RETURN _event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_operational_event(text, text, text, uuid, text, text, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_operational_event(text, text, text, uuid, text, text, text, jsonb, text)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.backup_verification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_provider text NOT NULL CHECK (char_length(backup_provider) BETWEEN 2 AND 80),
  backup_reference text NOT NULL CHECK (char_length(backup_reference) BETWEEN 3 AND 255),
  source_environment text NOT NULL CHECK (char_length(source_environment) BETWEEN 2 AND 80),
  restore_environment text NOT NULL CHECK (char_length(restore_environment) BETWEEN 2 AND 80),
  status text NOT NULL CHECK (status IN ('passed', 'failed')),
  verified_by uuid NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  row_count_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL CHECK (char_length(note) BETWEEN 10 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backup_verification_time_order CHECK (completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS backup_verification_runs_created_idx
  ON public.backup_verification_runs(created_at DESC);
ALTER TABLE public.backup_verification_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_verification_runs FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

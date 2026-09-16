-- Priority, SLA, assignment and restricted evidence preservation for reports.

ALTER TABLE public.content_reports
  DROP CONSTRAINT IF EXISTS content_reports_reason_check;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_reason_check CHECK (reason IN (
    'spam',
    'harassment',
    'impersonation',
    'underage',
    'non_consensual',
    'illegal',
    'other'
  ));

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note text
    CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS content_reports_priority_queue_idx
  ON public.content_reports(status, priority, sla_due_at, created_at);

CREATE TABLE IF NOT EXISTS public.safety_incident_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE REFERENCES public.content_reports(id) ON DELETE RESTRICT,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  preserved_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  legal_hold boolean NOT NULL DEFAULT false,
  chain_of_custody jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_incident_evidence_retention_idx
  ON public.safety_incident_evidence(retention_until)
  WHERE legal_hold = false;

ALTER TABLE public.safety_incident_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.safety_incident_evidence FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_content_report_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.priority := CASE
    WHEN NEW.reason IN ('underage', 'non_consensual') THEN 'critical'
    WHEN NEW.reason IN ('illegal', 'harassment') THEN 'high'
    ELSE 'normal'
  END;
  NEW.sla_due_at := COALESCE(
    NEW.sla_due_at,
    NEW.created_at,
    now()
  ) + CASE NEW.priority
    WHEN 'critical' THEN interval '15 minutes'
    WHEN 'high' THEN interval '4 hours'
    ELSE interval '24 hours'
  END;

  IF TG_OP = 'INSERT' AND auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.status := 'pending';
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.assigned_to := NULL;
    NEW.escalated_at := CASE WHEN NEW.priority = 'critical' THEN now() ELSE NULL END;
    NEW.resolution_note := NULL;
  ELSIF NEW.priority = 'critical' AND NEW.escalated_at IS NULL THEN
    NEW.escalated_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_content_report_operations ON public.content_reports;
CREATE TRIGGER trg_content_report_operations
  BEFORE INSERT OR UPDATE OF reason ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_content_report_operations();

UPDATE public.content_reports
SET reason = reason
WHERE sla_due_at IS NULL;

CREATE OR REPLACE FUNCTION public.capture_safety_incident_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _snapshot jsonb := '{}'::jsonb;
BEGIN
  IF NEW.target_type = 'post' THEN
    SELECT jsonb_build_object(
      'record', to_jsonb(p),
      'media', COALESCE((
        SELECT jsonb_agg(to_jsonb(pm) ORDER BY pm.position)
        FROM public.post_media pm WHERE pm.post_id = p.id
      ), '[]'::jsonb)
    ) INTO _snapshot
    FROM public.posts p WHERE p.id = NEW.target_id;
  ELSIF NEW.target_type = 'profile' THEN
    SELECT jsonb_build_object(
      'user_id', p.user_id,
      'username', p.username,
      'display_name', p.display_name,
      'bio', p.bio,
      'avatar_url', p.avatar_url,
      'created_at', p.created_at
    ) INTO _snapshot
    FROM public.profiles p WHERE p.user_id = NEW.target_id;
  ELSIF NEW.target_type = 'message' THEN
    SELECT to_jsonb(m) INTO _snapshot
    FROM public.chat_messages m WHERE m.id = NEW.target_id;
  ELSIF NEW.target_type = 'conversation' THEN
    SELECT jsonb_build_object(
      'thread', to_jsonb(t),
      'messages', COALESCE((
        SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at)
        FROM (
          SELECT * FROM public.chat_messages
          WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 200
        ) m
      ), '[]'::jsonb)
    ) INTO _snapshot
    FROM public.chat_threads t WHERE t.id = NEW.target_id;
  END IF;

  INSERT INTO public.safety_incident_evidence(
    report_id,
    target_type,
    target_id,
    snapshot,
    legal_hold,
    chain_of_custody
  ) VALUES (
    NEW.id,
    NEW.target_type,
    NEW.target_id,
    COALESCE(_snapshot, '{}'::jsonb),
    NEW.priority = 'critical',
    jsonb_build_array(jsonb_build_object(
      'action', 'captured',
      'at', now(),
      'actor', 'system'
    ))
  )
  ON CONFLICT (report_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_safety_incident_evidence ON public.content_reports;
CREATE TRIGGER trg_capture_safety_incident_evidence
  AFTER INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.capture_safety_incident_evidence();

CREATE OR REPLACE FUNCTION public.review_safety_report(
  _report_id uuid,
  _reviewer_id uuid,
  _status text,
  _note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _updated integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'VENYX_SERVICE_ROLE_REQUIRED';
  END IF;
  IF _status NOT IN ('reviewing', 'resolved', 'rejected') THEN
    RAISE EXCEPTION 'VENYX_REPORT_STATUS_INVALID';
  END IF;
  IF _status IN ('resolved', 'rejected') AND char_length(trim(COALESCE(_note, ''))) < 5 THEN
    RAISE EXCEPTION 'VENYX_RESOLUTION_NOTE_REQUIRED';
  END IF;

  UPDATE public.content_reports
  SET status = _status,
      assigned_to = COALESCE(assigned_to, _reviewer_id),
      reviewed_by = CASE WHEN _status = 'reviewing' THEN reviewed_by ELSE _reviewer_id END,
      reviewed_at = CASE WHEN _status = 'reviewing' THEN NULL ELSE now() END,
      resolution_note = CASE WHEN _status = 'reviewing' THEN resolution_note ELSE trim(_note) END,
      updated_at = now()
  WHERE id = _report_id;
  GET DIAGNOSTICS _updated = ROW_COUNT;

  IF _updated = 1 THEN
    UPDATE public.safety_incident_evidence
    SET chain_of_custody = chain_of_custody || jsonb_build_array(jsonb_build_object(
      'action', _status,
      'at', now(),
      'actor', _reviewer_id,
      'note_recorded', NULLIF(trim(COALESCE(_note, '')), '') IS NOT NULL
    ))
    WHERE report_id = _report_id;
  END IF;

  RETURN _updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.review_safety_report(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_safety_report(uuid, uuid, text, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

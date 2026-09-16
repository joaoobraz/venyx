-- Financial reconciliation queue for PIX charges that were not finalized by
-- the normal webhook path. Only trusted server code can read or write it.

CREATE TABLE IF NOT EXISTS public.financial_reconciliation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL REFERENCES public.pix_charges(id) ON DELETE CASCADE,
  issue_code text NOT NULL CHECK (issue_code IN (
    'missing_gateway_reference',
    'provider_lookup_failed',
    'gateway_data_mismatch',
    'fulfillment_failed',
    'status_mismatch'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  local_status text NOT NULL,
  gateway_status text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charge_id, issue_code)
);

CREATE INDEX IF NOT EXISTS financial_reconciliation_issues_open_idx
  ON public.financial_reconciliation_issues(status, severity, last_detected_at DESC);

DROP TRIGGER IF EXISTS update_financial_reconciliation_issues_updated_at
  ON public.financial_reconciliation_issues;
CREATE TRIGGER update_financial_reconciliation_issues_updated_at
  BEFORE UPDATE ON public.financial_reconciliation_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.financial_reconciliation_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_reconciliation_issues FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.financial_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cron', 'admin')),
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  scanned_count integer NOT NULL DEFAULT 0 CHECK (scanned_count >= 0),
  recovered_count integer NOT NULL DEFAULT 0 CHECK (recovered_count >= 0),
  expired_count integer NOT NULL DEFAULT 0 CHECK (expired_count >= 0),
  issue_count integer NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_reconciliation_runs_created_idx
  ON public.financial_reconciliation_runs(created_at DESC);

ALTER TABLE public.financial_reconciliation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_reconciliation_runs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_financial_reconciliation_issue(
  _charge_id uuid,
  _issue_code text,
  _severity text,
  _local_status text,
  _gateway_status text,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _issue_id uuid;
BEGIN
  INSERT INTO public.financial_reconciliation_issues(
    charge_id,
    issue_code,
    severity,
    status,
    local_status,
    gateway_status,
    details
  ) VALUES (
    _charge_id,
    _issue_code,
    _severity,
    'open',
    _local_status,
    _gateway_status,
    COALESCE(_details, '{}'::jsonb)
  )
  ON CONFLICT (charge_id, issue_code) DO UPDATE
  SET severity = EXCLUDED.severity,
      status = 'open',
      local_status = EXCLUDED.local_status,
      gateway_status = EXCLUDED.gateway_status,
      details = EXCLUDED.details,
      attempt_count = public.financial_reconciliation_issues.attempt_count + 1,
      last_detected_at = now(),
      resolved_at = NULL,
      resolved_by = NULL,
      resolution_note = NULL
  RETURNING id INTO _issue_id;

  RETURN _issue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_financial_reconciliation_issues_for_charge(
  _charge_id uuid,
  _note text DEFAULT 'Resolvida automaticamente pela conciliação'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.financial_reconciliation_issues
     SET status = 'resolved',
         resolved_at = now(),
         resolved_by = NULL,
         resolution_note = LEFT(COALESCE(_note, 'Resolvida automaticamente'), 2000)
   WHERE charge_id = _charge_id
     AND status = 'open';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.report_financial_reconciliation_issue(uuid, text, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_financial_reconciliation_issue(uuid, text, text, text, text, jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.resolve_financial_reconciliation_issues_for_charge(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_financial_reconciliation_issues_for_charge(uuid, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

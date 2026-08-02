-- Minimum support desk, account-recovery intake, and LGPD request tracking.

CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE DEFAULT (
    'VNX-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN (
    'account', 'billing', 'creator', 'safety', 'technical', 'privacy', 'other'
  )),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 140),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'critical')),
  assigned_to uuid,
  admin_notes text CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS support_requests_queue_idx
  ON public.support_requests(status, priority, created_at);
CREATE INDEX IF NOT EXISTS support_requests_user_idx
  ON public.support_requests(user_id, created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own support requests" ON public.support_requests;
CREATE POLICY "Users read own support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.support_requests FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_support_request_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.priority := CASE WHEN NEW.category = 'safety' THEN 'critical' ELSE 'normal' END;
    NEW.status := 'open';
    NEW.assigned_to := NULL;
    NEW.admin_notes := NULL;
    NEW.resolved_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_request_defaults ON public.support_requests;
CREATE TRIGGER trg_support_request_defaults
  BEFORE INSERT OR UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_support_request_defaults();

CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE DEFAULT (
    'REC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  login_email text NOT NULL CHECK (char_length(login_email) BETWEEN 5 AND 254),
  contact_email text NOT NULL CHECK (char_length(contact_email) BETWEEN 5 AND 254),
  issue_type text NOT NULL CHECK (issue_type IN ('lost_email', 'lost_2fa', 'locked_out')),
  details text NOT NULL CHECK (char_length(details) BETWEEN 20 AND 4000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'approved', 'rejected', 'closed')),
  request_ip_hash text NOT NULL CHECK (char_length(request_ip_hash) = 64),
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_recovery_queue_idx
  ON public.account_recovery_requests(status, created_at);
CREATE INDEX IF NOT EXISTS account_recovery_rate_idx
  ON public.account_recovery_requests(request_ip_hash, created_at DESC);

ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_recovery_requests FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE DEFAULT (
    'LGPD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export', 'deletion')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'processing', 'completed', 'rejected', 'canceled')),
  user_note text CHECK (user_note IS NULL OR char_length(user_note) <= 2000),
  retention_exceptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  download_path text,
  download_expires_at timestamptz,
  admin_notes text CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 4000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS privacy_requests_one_open_type_idx
  ON public.privacy_requests(user_id, request_type)
  WHERE status IN ('pending', 'verified', 'processing');
CREATE INDEX IF NOT EXISTS privacy_requests_queue_idx
  ON public.privacy_requests(status, created_at);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users read own privacy requests"
  ON public.privacy_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.privacy_requests FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_account_recovery_request(
  _login_email text,
  _contact_email text,
  _issue_type text,
  _details text,
  _request_ip_hash text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _protocol text;
  _count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'VENYX_SERVICE_ROLE_REQUIRED';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_request_ip_hash));
  SELECT count(*) INTO _count
  FROM public.account_recovery_requests
  WHERE request_ip_hash = _request_ip_hash
    AND created_at > now() - interval '1 hour';
  IF _count >= 5 THEN
    RAISE EXCEPTION 'VENYX_RECOVERY_RATE_LIMIT';
  END IF;

  INSERT INTO public.account_recovery_requests(
    login_email,
    contact_email,
    issue_type,
    details,
    request_ip_hash
  ) VALUES (
    lower(trim(_login_email)),
    lower(trim(_contact_email)),
    _issue_type,
    trim(_details),
    _request_ip_hash
  ) RETURNING protocol INTO _protocol;
  RETURN _protocol;
END;
$$;

REVOKE ALL ON FUNCTION public.create_account_recovery_request(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_account_recovery_request(text, text, text, text, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

CREATE TABLE public.admin_access_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  path TEXT,
  granted BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_access_audit_user ON public.admin_access_audit(user_id, created_at DESC);
CREATE INDEX idx_admin_access_audit_denied ON public.admin_access_audit(created_at DESC) WHERE granted = false;

ALTER TABLE public.admin_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem auditoria"
ON public.admin_access_audit
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

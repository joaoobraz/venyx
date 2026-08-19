-- Tabela de auditoria de ações admin
CREATE TABLE public.admin_action_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  target_user_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_action_audit_created_at ON public.admin_action_audit (created_at DESC);
CREATE INDEX idx_admin_action_audit_admin_id ON public.admin_action_audit (admin_id);
CREATE INDEX idx_admin_action_audit_action_type ON public.admin_action_audit (action_type);

ALTER TABLE public.admin_action_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem auditoria de ações"
ON public.admin_action_audit FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Sem políticas de INSERT/UPDATE/DELETE: só service-role escreve via server functions.

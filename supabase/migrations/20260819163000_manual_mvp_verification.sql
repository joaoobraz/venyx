-- Fanlira MVP: verificacao de idade manual, sem fornecedor pago.
-- Os documentos permanecem no bucket privado `kyc` e somente o dono e admins
-- autorizados conseguem acessa-los. Registros existentes continuam validos.

ALTER TABLE public.identity_verifications
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS document_front_url text,
  ADD COLUMN IF NOT EXISTS document_back_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_identity_verifications_manual_queue
  ON public.identity_verifications(status, created_at)
  WHERE method = 'manual_document_review';

-- O cliente nunca aprova a propria verificacao. Envio e decisoes passam por
-- server functions com service_role e toda aprovacao/rejeicao e auditada.
REVOKE INSERT, UPDATE, DELETE ON public.identity_verifications
  FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

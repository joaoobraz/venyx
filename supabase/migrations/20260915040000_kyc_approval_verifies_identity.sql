-- =====================================================================
-- 2026-09-15 — KYC de criadora aprovado também conclui a verificação de identidade
--
-- Cadastrar chave Pix (upsertPayoutKey) exige identity_verifications com
-- status 'verified'. O cadastro de criadora grava CPF, nome, telefone,
-- nascimento e os mesmos documentos nessa tabela com status 'pending', e o
-- admin aprova o KYC olhando exatamente esses documentos — mas a aprovação
-- só mudava kyc_requests. Resultado: criadora aprovada, mas sem conseguir
-- salvar a chave Pix nem publicar conteúdo pago.
--
-- Daqui em diante o servidor promove a identidade na própria aprovação do
-- KYC. Este bloco acerta quem já foi aprovado antes disso (fila manual com
-- documentos enviados), mantendo o registro de quem revisou.
-- =====================================================================

UPDATE public.identity_verifications iv
SET
  status = 'verified',
  verified_at = COALESCE(kyc.reviewed_at, now()),
  reviewed_by = kyc.reviewed_by,
  reviewed_at = COALESCE(kyc.reviewed_at, now()),
  rejection_reason = NULL,
  updated_at = now()
FROM public.kyc_requests kyc
WHERE kyc.user_id = iv.user_id
  AND kyc.status = 'approved'::public.kyc_status
  AND iv.status = 'pending'
  AND iv.method = 'manual_document_review'
  AND iv.document_front_url IS NOT NULL
  AND iv.selfie_url IS NOT NULL;

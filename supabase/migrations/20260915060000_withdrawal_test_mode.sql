-- =====================================================================
-- 2026-09-15 — MODO TESTE de saque (REVERTER antes do lançamento)
--
-- Para validar o saque Pix real de ponta a ponta:
--  - hold_days = 0        → saldo disponível na hora (sem retenção D+1)
--  - min_withdrawal_cents = 1 → sem valor mínimo (permite sacar R$ 0,01)
--  - chaves Pix já cadastradas ficam elegíveis agora (sem os 48h de carência)
--
-- REVERTER com o arquivo par 20260915060001_withdrawal_test_mode_revert.sql
-- (hold_days = 1, min_withdrawal_cents = 3000) antes de abrir ao público.
-- =====================================================================

UPDATE public.platform_settings
SET hold_days = 0,
    min_withdrawal_cents = 1,
    updated_at = now()
WHERE id = 1;

UPDATE public.creator_payout_keys
SET withdrawal_eligible_at = now();

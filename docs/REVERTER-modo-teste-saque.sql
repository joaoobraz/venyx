-- Rode isto (no SQL Editor do Supabase) para SAIR do modo teste de saque
-- e voltar às regras de produção. Não é uma migration para não conflitar
-- com o histórico; é um SQL avulso, seguro de rodar a qualquer momento.

UPDATE public.platform_settings
SET hold_days = 1,
    min_withdrawal_cents = 3000,
    updated_at = now()
WHERE id = 1;

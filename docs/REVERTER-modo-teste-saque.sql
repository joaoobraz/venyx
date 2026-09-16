-- Preferido: Administrador → Configurações da plataforma → desligar
-- "Modo teste de saque" (faz exatamente isto, com auditoria).
--
-- Alternativa manual (SQL Editor do Supabase), caso o painel esteja fora:

UPDATE public.platform_settings
SET hold_days = 1,
    min_withdrawal_cents = 3000,
    updated_at = now()
WHERE id = 1;

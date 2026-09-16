-- =====================================================================
-- 2026-09-15 — Novo segmento de mass DM: assinantes vencendo em até 3 dias
-- (ALTER TYPE ... ADD VALUE precisa ser aplicado sozinho, fora da transação
-- que usa o valor; por isso está em arquivo próprio.)
-- =====================================================================
ALTER TYPE public.mass_dm_segment ADD VALUE IF NOT EXISTS 'expiring_subscribers';

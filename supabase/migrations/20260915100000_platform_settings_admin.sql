-- =====================================================================
-- 2026-09-15 — Configurações da plataforma editáveis pelo admin
--
-- Centraliza as "chavinhas" operacionais em platform_settings e expõe uma
-- leitura pública (sem PII) para o app:
--   platform_fee_pct           taxa da plataforma (%)
--   hold_days                  retenção do saldo (D+N)
--   min_withdrawal_cents       saque mínimo
--   manual_moderation_enabled  moderação manual de posts/stories
--
-- Limites de sanidade impedem valores absurdos por engano no painel.
-- A escrita continua restrita ao servidor (service_role) via admin.functions.
-- =====================================================================

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_fee_range,
  ADD CONSTRAINT platform_settings_fee_range CHECK (platform_fee_pct BETWEEN 0 AND 50);

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_hold_range,
  ADD CONSTRAINT platform_settings_hold_range CHECK (hold_days BETWEEN 0 AND 30);

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_min_withdrawal_range,
  ADD CONSTRAINT platform_settings_min_withdrawal_range
    CHECK (min_withdrawal_cents BETWEEN 1 AND 100000000);

CREATE OR REPLACE FUNCTION public.get_public_platform_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'platform_fee_pct', COALESCE(s.platform_fee_pct, 15),
    'hold_days', COALESCE(s.hold_days, 1),
    'min_withdrawal_cents', COALESCE(s.min_withdrawal_cents, 3000),
    'manual_moderation_enabled', COALESCE(s.manual_moderation_enabled, false)
  )
  FROM (SELECT * FROM public.platform_settings WHERE id = 1) s;
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_settings() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

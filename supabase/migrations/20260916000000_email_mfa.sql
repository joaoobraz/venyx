-- =====================================================================
-- 2026-09-16 — 2FA por e-mail (pronto, mas DESLIGADO por padrão)
--
-- A pessoa pode escolher receber o código por e-mail em vez do app
-- autenticador. Usa o envio de OTP do próprio Supabase Auth (SMTP do
-- projeto); o servidor registra a sessão como verificada em
-- email_mfa_sessions e o gate de 2FA (requireSupabaseMfa) aceita aal2 OU
-- sessão verificada por e-mail. O flag platform_settings.email_mfa_enabled
-- (padrão false) esconde a opção até o dono ligar — sem custo de envio.
-- =====================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS email_mfa_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.security_settings
  ADD COLUMN IF NOT EXISTS mfa_method text NOT NULL DEFAULT 'totp';
ALTER TABLE public.security_settings DROP CONSTRAINT IF EXISTS security_settings_mfa_method_check;
ALTER TABLE public.security_settings
  ADD CONSTRAINT security_settings_mfa_method_check CHECK (mfa_method IN ('totp', 'email'));

-- mfa_method só muda pelo servidor (depois de um código validado).
REVOKE INSERT, UPDATE ON public.security_settings FROM anon, authenticated;
GRANT INSERT (user_id, mfa_enabled, mfa_required_for_withdraw) ON public.security_settings TO authenticated;
GRANT UPDATE (mfa_enabled, mfa_required_for_withdraw, updated_at) ON public.security_settings TO authenticated;

CREATE TABLE IF NOT EXISTS public.email_mfa_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS email_mfa_sessions_user_idx ON public.email_mfa_sessions (user_id);
ALTER TABLE public.email_mfa_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_mfa_sessions FROM anon, authenticated;

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
    'manual_moderation_enabled', COALESCE(s.manual_moderation_enabled, false),
    'email_mfa_enabled', COALESCE(s.email_mfa_enabled, false)
  )
  FROM (SELECT * FROM public.platform_settings WHERE id = 1) s;
$$;

NOTIFY pgrst, 'reload schema';

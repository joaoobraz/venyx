-- =========================================================
-- 1) chat-media INSERT: remover policy fraca (pasta arbitrária)
-- =========================================================
DROP POLICY IF EXISTS "Usuário envia chat media" ON storage.objects;
-- Mantém apenas "chat media: participants can upload" que exige thread_id válido
-- e participação do uploader na conversa.

-- =========================================================
-- 2) profiles_public: view de vitrine separada de dados internos
-- =========================================================
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT
  user_id,
  username,
  display_name,
  avatar_url,
  cover_url,
  bio,
  location,
  links,
  is_verified,
  subscription_price_cents,
  watermark_position,
  watermark_opacity,
  language,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- =========================================================
-- 3) Revogar de anon as colunas internas/sensíveis de profiles
--    (RLS continua permitindo a linha, mas PostgREST bloqueia
--     a coluna para visitantes não autenticados).
-- =========================================================
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  user_id, username, display_name, avatar_url, cover_url, bio,
  location, links, is_verified, subscription_price_cents,
  watermark_position, watermark_opacity, language, created_at
) ON public.profiles TO anon;
-- Colunas NÃO concedidas para anon: trial_days, trial_days_enabled, updated_at, id
-- authenticated continua com SELECT total via grant default.
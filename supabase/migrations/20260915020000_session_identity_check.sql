-- =====================================================================
-- 2026-09-15 — Como o banco enxerga quem está chamando
--
-- Depois de confirmar que a criadora tem o papel `creator`, que
-- `authenticated` tem INSERT em posts e UPDATE nas colunas do perfil, as
-- duas operações continuaram sendo recusadas. A única hipótese que explica
-- os dois erros ao mesmo tempo é o pedido chegar sem a identidade do
-- usuário (ou seja, como `anon`).
--
-- SECURITY INVOKER de propósito: a função precisa refletir quem chamou.
-- Só devolve a própria identidade — nenhum dado de terceiros.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.session_identity()
RETURNS TABLE (
  user_id uuid,
  db_role text,
  jwt_role text,
  is_creator boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    auth.uid(),
    current_user::text,
    auth.role()::text,
    public.has_role(auth.uid(), 'creator'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.session_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.session_identity() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

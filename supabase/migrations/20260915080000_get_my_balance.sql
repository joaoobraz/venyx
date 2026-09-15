-- =====================================================================
-- 2026-09-15 — Saldo próprio via função segura (fim da ambiguidade de RLS)
--
-- A carteira lia a view creator_balances direto do navegador (invoker), e
-- qualquer restrição de RLS nas tabelas de base zerava o saldo. Esta função
-- SECURITY DEFINER calcula a view como owner e devolve SÓ a linha do próprio
-- usuário (auth.uid()), então o saldo aparece corretamente sem abrir nada.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_my_balance()
RETURNS public.creator_balances
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.creator_balances WHERE creator_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_balance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_balance() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

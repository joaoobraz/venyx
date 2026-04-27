
-- Remover políticas que permitem admin escrever direto do cliente.
-- Toda ação admin agora passa por server functions com supabaseAdmin (service role),
-- que ignora RLS. Assim impedimos qualquer write direto via JWT do admin.

DROP POLICY IF EXISTS "Admins update KYC" ON public.kyc_requests;
DROP POLICY IF EXISTS "Admin atualiza reports" ON public.dmca_reports;

-- user_roles: garantir que ninguém (nem admin) possa inserir roles via cliente.
-- Apenas o trigger handle_new_user e funções server-side com service role criam roles.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'user_roles'
       AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;

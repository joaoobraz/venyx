-- Marca a conta do administrador (joaobrazofc) como verificada (+18) sem enviar
-- documento. Só esta conta; as próximas continuam passando pela verificação normal.
-- Como rodar: Supabase → SQL Editor → colar → Run.
insert into public.identity_verifications
  (user_id, country, cpf, full_name, birth_date, status, method, verified_at, document_type)
select u.user_id, 'BR', '00000000000', 'Conta do administrador (isenta)', '1990-01-01',
       'verified', 'owner_exempt', now(), 'ADMIN'
from public.user_roles u
where u.role = 'admin' and u.user_id::text like 'bd1bd6bb%'
on conflict (user_id) do nothing;

-- Conferência: deve devolver 1
select count(*) as admin_verificado
from public.identity_verifications
where user_id::text like 'bd1bd6bb%' and status = 'verified';

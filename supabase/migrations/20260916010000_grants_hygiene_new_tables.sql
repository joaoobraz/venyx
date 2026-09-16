-- =====================================================================
-- 2026-09-16 — Higiene de privilégios (pentest 2)
--
-- O Supabase concede ALL a anon/authenticated em toda tabela nova por
-- privilégio padrão. As tabelas criadas ontem herdaram TRUNCATE/TRIGGER/
-- REFERENCES (a API nunca usa e TRUNCATE ignora RLS). Revoga nelas e ajusta
-- o padrão para que tabelas futuras não nasçam com esses três.
-- =====================================================================
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.creator_request_settings FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.creator_welcome_messages FROM anon, authenticated;
REVOKE ALL ON public.creator_request_settings FROM anon;
REVOKE ALL ON public.creator_welcome_messages FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- get_hold_days não precisa ser executável por anônimos.
REVOKE EXECUTE ON FUNCTION public.get_hold_days() FROM anon;

NOTIFY pgrst, 'reload schema';

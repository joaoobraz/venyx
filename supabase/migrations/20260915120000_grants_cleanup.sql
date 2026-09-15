-- =====================================================================
-- 2026-09-15 — Limpeza de privilégios residuais (pós-hardening)
--
-- 1) anon tinha um grant antigo só na coluna posts.body (o DO block da
--    20260915110000 pulou anon porque ele não tinha SELECT de tabela).
-- 2) O GRANT ALL de migrations antigas deixou TRUNCATE/TRIGGER/REFERENCES
--    para anon/authenticated. A API (PostgREST) nunca usa esses privilégios
--    e TRUNCATE ignora RLS — não há motivo para mantê-los.
-- =====================================================================

REVOKE SELECT (body) ON public.posts FROM anon, authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

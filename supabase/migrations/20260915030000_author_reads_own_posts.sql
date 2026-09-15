-- =====================================================================
-- 2026-09-15 — A autora enxerga os próprios posts por comparação direta
--
-- A política de SELECT de posts dependia só de can_view_post_metadata(),
-- uma função STABLE que consulta public.posts de novo. Num
-- INSERT ... RETURNING, a função roda com a foto do início do comando, em
-- que o post recém-criado ainda não existe: EXISTS devolve falso e o
-- Postgres recusa a inserção inteira com "new row violates row-level
-- security policy". Confirmado em produção em 15/09/2026: o mesmo INSERT
-- sem RETURNING passa.
--
-- Com `creator_id = auth.uid()` avaliado direto na linha, a autora lê os
-- próprios posts (pendentes ou não) em qualquer situação, inclusive no
-- RETURNING. Para todo o resto continua valendo a função.
-- =====================================================================

DROP POLICY IF EXISTS "Posts visíveis para adultos conforme acesso" ON public.posts;
CREATE POLICY "Posts visíveis para adultos conforme acesso"
  ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR (
      public.can_view_post_metadata(id, auth.uid())
      AND NOT public.users_are_blocked(creator_id, auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';

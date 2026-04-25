-- Remover policies públicas/redundantes de follows
DROP POLICY IF EXISTS "Follows visíveis a todos" ON public.follows;
DROP POLICY IF EXISTS "Follows: autenticado lê" ON public.follows;
DROP POLICY IF EXISTS "follows_select_own" ON public.follows;

-- Apenas as partes envolvidas podem ler o relacionamento
CREATE POLICY "Follows: somente envolvidos leem"
ON public.follows
FOR SELECT
TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = followee_id);
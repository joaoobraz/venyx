-- 1) post_media: substitui SELECT permissivo por verificação de acesso real
DROP POLICY IF EXISTS "Mídia visível com acesso" ON public.post_media;

CREATE POLICY "Mídia visível conforme acesso ao post"
ON public.post_media
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id
      AND (
        p.visibility = 'public'
        OR auth.uid() = p.creator_id
        OR (p.visibility = 'subscribers' AND auth.uid() IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE s.creator_id = p.creator_id
            AND s.subscriber_id = auth.uid()
            AND s.status = 'active'
        ))
        OR (p.visibility = 'ppv' AND auth.uid() IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.ppv_unlocks u
          WHERE u.post_id = p.id AND u.user_id = auth.uid()
        ))
        OR (p.visibility = 'goal' AND (
          EXISTS (SELECT 1 FROM public.post_goals g WHERE g.post_id = p.id AND g.is_unlocked)
          OR (auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.post_goal_contributions c
            WHERE c.post_id = p.id AND c.user_id = auth.uid()
          ))
        ))
      )
  )
);

-- 2) Bucket "posts": remover policy permissiva e criar policies restritas
DROP POLICY IF EXISTS "Mídia de posts visível a autenticados" ON storage.objects;

-- Permite apenas a criadora dona do post ler suas próprias mídias diretamente.
-- Outros usuários acessam exclusivamente via URL assinada gerada pelo servidor.
-- (a policy "Posts: criadora dona lê" já existente cobre o caso da dona.)

-- 3) affiliate_codes: remover policy permissiva enganosa
DROP POLICY IF EXISTS "Códigos visíveis ao dono ou ao referido" ON public.affiliate_codes;

-- Permite consulta pública APENAS por código exato (lookup de checkout/referral),
-- sem expor enumeração: feita via RPC SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.lookup_affiliate_code(_code text)
RETURNS TABLE(user_id uuid, commission_pct integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id, a.commission_pct
  FROM public.affiliate_codes a
  WHERE a.code = _code
  LIMIT 1;
$$;

-- 4) subscription_coupons: remover policy permissiva duplicada
DROP POLICY IF EXISTS "Cupons visíveis a autenticados" ON public.subscription_coupons;

-- 5) Realtime: restringir broadcast a participantes
-- Remove policy permissiva (se existir) e adiciona scoping por tópico.
DO $realtime_policy$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "authenticated can receive realtime" ON realtime.messages';
      EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read realtime" ON realtime.messages';
      EXECUTE $policy$
        CREATE POLICY "Realtime: participantes do thread leem broadcasts"
        ON realtime.messages
        FOR SELECT
        TO authenticated
        USING (
          CASE
            WHEN realtime.topic() LIKE 'thread:%' THEN
              EXISTS (
                SELECT 1 FROM public.chat_threads t
                WHERE t.id::text = substring(realtime.topic() FROM 'thread:(.+)')
                  AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
              )
            ELSE auth.uid() IS NOT NULL
          END
        )
      $policy$;
    EXCEPTION
      WHEN insufficient_privilege OR undefined_function OR undefined_table THEN
        RAISE NOTICE 'Skipping realtime.messages policy: platform-managed or unavailable';
    END;
  END IF;
END
$realtime_policy$;

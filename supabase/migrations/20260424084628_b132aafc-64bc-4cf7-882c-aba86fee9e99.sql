
-- ============================================================
-- 1) STORIES: corrigir SELECT para respeitar visibility
-- ============================================================
DROP POLICY IF EXISTS "Stories visíveis enquanto não expiram" ON public.stories;

CREATE POLICY "Stories: pública ou assinante ou dono"
  ON public.stories FOR SELECT
  USING (
    expires_at > now()
    AND (
      visibility = 'public'
      OR creator_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR (
        visibility = 'subscribers'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE s.creator_id = stories.creator_id
            AND s.subscriber_id = auth.uid()
            AND s.status = 'active'
        )
      )
    )
  );

-- ============================================================
-- 2) BUCKET stories: tornar privado
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'stories';

-- Remove policies antigas amplas
DROP POLICY IF EXISTS "Stories são públicas para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Stories publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public can read stories" ON storage.objects;

-- ============================================================
-- 3) BUCKETS avatars/covers/posts: remover SELECT amplo (listagem)
--    Mantém leitura por path conhecido via service-role (URLs assinadas)
-- ============================================================
DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Covers publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Posts publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Avatars são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Covers são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Posts são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read covers" ON storage.objects;
DROP POLICY IF EXISTS "Public read posts" ON storage.objects;

-- avatars/covers continuam públicos (perfil), mas só leitura por path direto
UPDATE storage.buckets SET public = true WHERE id IN ('avatars', 'covers');

-- ============================================================
-- 4) REALTIME: trocar ELSE permissivo por WHEN explícito
-- ============================================================
DROP POLICY IF EXISTS "Realtime: participantes do thread leem broadcasts" ON realtime.messages;

CREATE POLICY "Realtime: somente participantes do thread"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'thread:%' THEN
        EXISTS (
          SELECT 1 FROM public.chat_threads t
          WHERE t.id::text = substring(realtime.topic() FROM 8)
            AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
        )
      ELSE false
    END
  );

-- ============================================================
-- 5) Restringir SELECT público amplo em tabelas com info sensível
-- ============================================================
DROP POLICY IF EXISTS "Affiliate codes públicos" ON public.affiliate_codes;
DROP POLICY IF EXISTS "Public can read affiliate codes" ON public.affiliate_codes;
CREATE POLICY "Affiliate codes: autenticado lê"
  ON public.affiliate_codes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Subscription coupons públicos" ON public.subscription_coupons;
DROP POLICY IF EXISTS "Public can read coupons" ON public.subscription_coupons;
CREATE POLICY "Coupons: autenticado lê"
  ON public.subscription_coupons FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Follows públicos" ON public.follows;
DROP POLICY IF EXISTS "Public can read follows" ON public.follows;
CREATE POLICY "Follows: autenticado lê"
  ON public.follows FOR SELECT
  TO authenticated
  USING (true);

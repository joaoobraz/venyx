
-- Reabrir colunas (REVOKE de coluna estava quebrando o cliente)
GRANT SELECT (body) ON public.posts TO anon, authenticated;
GRANT SELECT (storage_path) ON public.post_media TO anon, authenticated;

-- Substituir policy de SELECT em posts: agora restrita ao acesso real
DROP POLICY IF EXISTS "Posts linha visível" ON public.posts;
CREATE POLICY "Posts visíveis conforme acesso"
ON public.posts
FOR SELECT
TO public
USING (
  visibility = 'public'
  OR auth.uid() = creator_id
  OR (
    visibility = 'subscribers' AND auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.creator_id = posts.creator_id
         AND s.subscriber_id = auth.uid()
         AND s.status = 'active'
    )
  )
  OR (
    visibility = 'ppv' AND auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.ppv_unlocks u
       WHERE u.post_id = posts.id AND u.user_id = auth.uid()
    )
  )
  OR (
    visibility = 'goal' AND (
      EXISTS (SELECT 1 FROM public.post_goals g WHERE g.post_id = posts.id AND g.is_unlocked)
      OR (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.post_goal_contributions c
         WHERE c.post_id = posts.id AND c.user_id = auth.uid()
      ))
    )
  )
);

-- post_media segue a mesma regra: só quem pode ver o post pode ver a mídia
DROP POLICY IF EXISTS "Mídia linha visível" ON public.post_media;
CREATE POLICY "Mídia visível com acesso"
ON public.post_media
FOR SELECT
TO public
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_media.post_id)
);

-- Função SECURITY DEFINER que devolve a lista do feed COM prévia bloqueada
-- (sempre devolve a linha — body=null, media_path=null se sem acesso).
CREATE OR REPLACE FUNCTION public.list_feed_posts(
  _creator_id UUID DEFAULT NULL,
  _viewer_id UUID DEFAULT NULL,
  _limit INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  body TEXT,
  visibility post_visibility,
  price_cents INT,
  likes_count INT,
  comments_count INT,
  created_at TIMESTAMPTZ,
  has_access BOOLEAN,
  media_id UUID,
  media_path TEXT,
  media_mime TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.*
      FROM public.posts p
     WHERE (_creator_id IS NULL OR p.creator_id = _creator_id)
     ORDER BY p.created_at DESC
     LIMIT _limit
  ),
  acc AS (
    SELECT
      b.*,
      (
        b.visibility = 'public'
        OR _viewer_id = b.creator_id
        OR (b.visibility = 'subscribers' AND EXISTS (
          SELECT 1 FROM public.subscriptions s
           WHERE s.creator_id = b.creator_id AND s.subscriber_id = _viewer_id AND s.status = 'active'
        ))
        OR (b.visibility = 'ppv' AND EXISTS (
          SELECT 1 FROM public.ppv_unlocks u WHERE u.post_id = b.id AND u.user_id = _viewer_id
        ))
        OR (b.visibility = 'goal' AND (
          EXISTS (SELECT 1 FROM public.post_goals g WHERE g.post_id = b.id AND g.is_unlocked)
          OR EXISTS (SELECT 1 FROM public.post_goal_contributions c WHERE c.post_id = b.id AND c.user_id = _viewer_id)
        ))
      ) AS has_access
    FROM base b
  ),
  first_media AS (
    SELECT DISTINCT ON (m.post_id) m.post_id, m.id, m.storage_path, m.mime_type
      FROM public.post_media m
     ORDER BY m.post_id, m.position ASC
  )
  SELECT
    a.id,
    a.creator_id,
    CASE WHEN a.has_access THEN a.body ELSE NULL END AS body,
    a.visibility,
    a.price_cents,
    a.likes_count,
    a.comments_count,
    a.created_at,
    a.has_access,
    fm.id AS media_id,
    CASE WHEN a.has_access THEN fm.storage_path ELSE NULL END AS media_path,
    fm.mime_type AS media_mime
  FROM acc a
  LEFT JOIN first_media fm ON fm.post_id = a.id
  ORDER BY a.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_feed_posts(UUID, UUID, INT) TO anon, authenticated;

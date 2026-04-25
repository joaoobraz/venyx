-- =========================================================================
-- HARDENING PRÉ-LANÇAMENTO: paywall, privilege escalation, storage
-- =========================================================================

-- ---------- 1) PRIVILEGE ESCALATION em user_roles ----------
-- Garante que NINGUÉM (nem authenticated, nem anon) pode inserir/atualizar/
-- deletar linhas em user_roles a não ser via has_role(admin) ou service-role.
-- A policy "Admins can manage roles" cobre admin via has_role; aqui criamos
-- DENY explícito para non-admin (defense-in-depth) e bloqueamos qualquer
-- INSERT/UPDATE/DELETE que não seja admin.

-- Remove policies existentes que possam ser permissivas demais
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_self" ON public.user_roles;

-- Garante policy explícita: só admin pode INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));


-- ---------- 2) PAYWALL — post_media metadata e storage ----------
-- A policy SELECT atual de post_media já chama logica equivalente a can_view_post,
-- mas vamos consolidá-la usando a função canônica para evitar drift.

DROP POLICY IF EXISTS "Mídia visível conforme acesso ao post" ON public.post_media;
CREATE POLICY "Mídia visível conforme acesso ao post"
  ON public.post_media
  FOR SELECT
  TO public
  USING (public.can_view_post(post_id, auth.uid()));


-- ---------- 3) STORAGE — bucket 'posts' com paywall ----------
-- Hoje só o dono lê. Adiciona acesso a:
--   - assinantes ativos (visibility=subscribers)
--   - quem desbloqueou PPV
--   - meta atingida (visibility=goal)
-- Layout: storage_path no formato '<creator_id>/<post_id>/<file>'

-- Helper: dada uma pasta de storage, descobre o post_id correspondente
CREATE OR REPLACE FUNCTION public.storage_path_to_post_id(_path text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pm.post_id
  FROM public.post_media pm
  WHERE pm.storage_path = _path
  LIMIT 1
$$;

-- Remove policies antigas que pudessem permitir acesso indevido
DROP POLICY IF EXISTS "Posts: criadora dona lê" ON storage.objects;
DROP POLICY IF EXISTS "Posts media: paywall" ON storage.objects;

CREATE POLICY "Posts media: paywall"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'posts'
    AND (
      -- dono (folder = creator_id)
      (auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1])
      -- ou tem acesso ao post associado
      OR public.can_view_post(public.storage_path_to_post_id(name), auth.uid())
    )
  );

-- INSERT continua permitido só para o dono (folder = creator_id)
DROP POLICY IF EXISTS "Posts: criadora envia" ON storage.objects;
CREATE POLICY "Posts: criadora envia"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'creator'::app_role)
  );

DROP POLICY IF EXISTS "Posts: criadora apaga" ON storage.objects;
CREATE POLICY "Posts: criadora apaga"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ---------- 4) STORAGE — bucket 'stories' com paywall ----------
-- Adiciona policies espelhando a RLS de stories (público OR assinante OR dono OR admin).

CREATE OR REPLACE FUNCTION public.can_view_story_path(_path text, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.media_path = _path
      AND s.expires_at > now()
      AND (
        s.visibility = 'public'::story_visibility
        OR s.creator_id = _viewer
        OR public.has_role(_viewer, 'admin'::app_role)
        OR (
          s.visibility = 'subscribers'::story_visibility
          AND _viewer IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.subscriptions sub
            WHERE sub.creator_id = s.creator_id
              AND sub.subscriber_id = _viewer
              AND sub.status = 'active'::subscription_status
          )
        )
      )
  )
$$;

DROP POLICY IF EXISTS "Stories: criadora dona lê" ON storage.objects;
DROP POLICY IF EXISTS "Stories media: paywall" ON storage.objects;

CREATE POLICY "Stories media: paywall"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'stories'
    AND (
      (auth.uid() IS NOT NULL AND auth.uid()::text = (storage.foldername(name))[1])
      OR public.can_view_story_path(name, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Stories: criadora envia" ON storage.objects;
CREATE POLICY "Stories: criadora envia"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'stories'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'creator'::app_role)
  );

DROP POLICY IF EXISTS "Stories: criadora apaga" ON storage.objects;
CREATE POLICY "Stories: criadora apaga"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'stories'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
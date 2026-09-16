-- =====================================================================
-- 2026-09-15 — Hardening de segurança (pentest interno autorizado)
--
-- Fecha as falhas confirmadas na auditoria do banco. Cada bloco cita o item
-- do relatório (docs/PENTEST-2026-09-15.md). Princípio: o cliente (anon /
-- authenticated) só escreve o estritamente necessário; o resto é service_role.
--
-- ATENÇÃO: a migration 20260915010000 tem um DO block que regrava GRANTs de
-- tabela inteira a partir das policies. Se ela for reaplicada, este arquivo
-- precisa rodar DEPOIS dela (é o que a ordem cronológica já garante).
-- =====================================================================

-- ---------------------------------------------------------------------
-- C1 — chat_messages: destinatário só pode marcar como lida (read_at).
-- Antes: UPDATE na tabela inteira → zerar ppv_price_cents e ver mídia paga,
-- reescrever body/sender_id (adulterar evidência).
-- ---------------------------------------------------------------------
REVOKE UPDATE ON public.chat_messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.chat_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_chat_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Compara a linha inteira menos os campos que o cliente pode tocar.
  IF (to_jsonb(NEW) - 'read_at' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(OLD) - 'read_at' - 'updated_at') THEN
    RAISE EXCEPTION 'FANLIRA_CHAT_MESSAGE_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_chat_message_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_chat_message_update ON public.chat_messages;
CREATE TRIGGER protect_chat_message_update
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.protect_chat_message_update();

-- ---------------------------------------------------------------------
-- A1 — affiliate_codes: embaixadora não altera a própria comissão.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Embaixadora atualiza seu código" ON public.affiliate_codes;
REVOKE UPDATE ON public.affiliate_codes FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- A2 — upsell_offers: a oferta só pode liberar post da própria criadora.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_upsell_media_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.media_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = NEW.media_post_id AND p.creator_id = NEW.creator_id
  ) THEN
    RAISE EXCEPTION 'FANLIRA_UPSELL_MEDIA_NOT_OWNED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_upsell_media_owner() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_upsell_media_owner ON public.upsell_offers;
CREATE TRIGGER enforce_upsell_media_owner
  BEFORE INSERT OR UPDATE OF media_post_id, creator_id ON public.upsell_offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_upsell_media_owner();

-- ---------------------------------------------------------------------
-- A3 — mass_dm_jobs: criadora só cancela job pendente (não redireciona
-- destinatário nem reenvia). Threads nunca são criadas entre bloqueados,
-- por qualquer caminho (RLS ou cron).
-- ---------------------------------------------------------------------
REVOKE UPDATE ON public.mass_dm_jobs FROM anon, authenticated;
GRANT UPDATE (status, processed_at, error_reason) ON public.mass_dm_jobs TO authenticated;
DROP POLICY IF EXISTS "Criadora cancela jobs" ON public.mass_dm_jobs;
CREATE POLICY "Criadora cancela jobs" ON public.mass_dm_jobs
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id AND status = 'pending')
  WITH CHECK (auth.uid() = creator_id AND status = 'cancelled');

CREATE OR REPLACE FUNCTION public.enforce_thread_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(public.users_are_blocked(NEW.user_a, NEW.user_b), false) THEN
    RAISE EXCEPTION 'FANLIRA_THREAD_BLOCKED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_thread_not_blocked() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_thread_not_blocked ON public.chat_threads;
CREATE TRIGGER enforce_thread_not_blocked
  BEFORE INSERT ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_thread_not_blocked();

-- ---------------------------------------------------------------------
-- M7 — chat_threads: uma única policy de INSERT (idade E sem bloqueio).
-- Antes eram duas permissivas (OR): uma sem idade, outra sem bloqueio.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Adulto cria thread da qual participa" ON public.chat_threads;
DROP POLICY IF EXISTS "Users create unblocked threads" ON public.chat_threads;
CREATE POLICY "Adulto cria thread sem bloqueio" ON public.chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_age_verified(auth.uid())
    AND auth.uid() IN (user_a, user_b)
    AND NOT COALESCE(public.users_are_blocked(user_a, user_b), false)
  );

-- ---------------------------------------------------------------------
-- M1 — user_roles: escrita só pelo servidor (a policy FOR ALL sobreviveu
-- à limpeza anterior). Admin continua lendo todos os papéis.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins read roles" ON public.user_roles;
CREATE POLICY "Admins read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- M2 — post_comments: criadora modera, mas não reescreve texto/autoria.
-- ---------------------------------------------------------------------
REVOKE UPDATE ON public.post_comments FROM anon, authenticated;
GRANT UPDATE (moderation_status, moderated_at, moderated_by, hidden_reason)
  ON public.post_comments TO authenticated;

-- ---------------------------------------------------------------------
-- M3 — kyc_requests: só via submit_creator_kyc_with_consent (servidor).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users insert own KYC" ON public.kyc_requests;
REVOKE INSERT ON public.kyc_requests FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- M5 — Remove a promoção automática a admin por e-mail no signup.
-- O bootstrap já foi feito; manter isso era superfície de ataque + PII.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS promote_platform_owner_after_signup ON auth.users;
DROP FUNCTION IF EXISTS public.promote_platform_owner();

-- ---------------------------------------------------------------------
-- A3 (cliente) — texto de posts pagos não chega ao navegador sem acesso.
-- 1) RPC que mascara body conforme can_view_post (autor sempre vê o seu).
-- 2) Cliente perde SELECT em posts.body (todas as outras colunas seguem).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_feed_posts_v2(
  _creator_id uuid DEFAULT NULL,
  _post_id uuid DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  body text,
  visibility public.post_visibility,
  price_cents integer,
  likes_count integer,
  comments_count integer,
  created_at timestamptz,
  is_pinned boolean,
  has_access boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH visible AS (
    SELECT
      post.*,
      (post.creator_id = auth.uid() OR public.can_view_post(post.id, auth.uid())) AS has_access
    FROM public.posts post
    WHERE post.archived_at IS NULL
      AND (_post_id IS NULL OR post.id = _post_id)
      AND (_creator_id IS NULL OR post.creator_id = _creator_id)
      AND (
        post.creator_id = auth.uid()
        OR (
          public.can_view_post_metadata(post.id, auth.uid())
          AND NOT COALESCE(public.users_are_blocked(post.creator_id, auth.uid()), false)
        )
      )
    ORDER BY post.is_pinned DESC, post.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 30), 1), 100)
  )
  SELECT
    v.id,
    v.creator_id,
    CASE WHEN v.has_access THEN v.body ELSE NULL END,
    v.visibility,
    v.price_cents,
    v.likes_count,
    v.comments_count,
    v.created_at,
    v.is_pinned,
    v.has_access
  FROM visible v
  ORDER BY v.is_pinned DESC, v.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_feed_posts_v2(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_feed_posts_v2(uuid, uuid, integer) TO anon, authenticated, service_role;

DO $$
DECLARE
  role_name text;
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'posts' AND column_name <> 'body';

  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(role_name, 'public.posts', 'SELECT') THEN
      EXECUTE format('REVOKE SELECT ON public.posts FROM %I', role_name);
      EXECUTE format('GRANT SELECT (%s) ON public.posts TO %I', cols, role_name);
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- Integridade de dados (B6/B8/M6): preços e URLs válidos. NOT VALID para
-- não travar em linhas antigas; vale para tudo que entrar daqui em diante.
-- ---------------------------------------------------------------------
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_price_nonnegative;
ALTER TABLE public.posts ADD CONSTRAINT posts_price_nonnegative
  CHECK (price_cents >= 0) NOT VALID;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_ppv_min_price;
ALTER TABLE public.posts ADD CONSTRAINT posts_ppv_min_price
  CHECK (visibility <> 'ppv' OR price_cents >= 100) NOT VALID;

ALTER TABLE public.creator_links DROP CONSTRAINT IF EXISTS creator_links_url_http;
ALTER TABLE public.creator_links ADD CONSTRAINT creator_links_url_http
  CHECK (url ~* '^https?://') NOT VALID;

-- ---------------------------------------------------------------------
-- Funcional: get_platform_fee_pct voltou a INVOKER numa migration antiga e a
-- view creator_balances (lida pela criadora) recebia NULL. Volta a DEFINER.
-- ---------------------------------------------------------------------
ALTER FUNCTION public.get_platform_fee_pct() SECURITY DEFINER;
ALTER FUNCTION public.get_platform_fee_pct() SET search_path = '';

NOTIFY pgrst, 'reload schema';

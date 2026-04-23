-- =========================================
-- POSTS
-- =========================================
CREATE TYPE public.post_visibility AS ENUM ('public', 'subscribers', 'ppv');

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  body TEXT,
  visibility public.post_visibility NOT NULL DEFAULT 'public',
  price_cents INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  unlocks_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_creator ON public.posts(creator_id, created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts são visíveis a todos"
  ON public.posts FOR SELECT USING (true);

CREATE POLICY "Criadora pode criar próprios posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));

CREATE POLICY "Criadora atualiza próprios posts"
  ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Criadora apaga próprios posts"
  ON public.posts FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

CREATE TRIGGER trg_posts_updated
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- POST MEDIA
-- =========================================
CREATE TABLE public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_media_post ON public.post_media(post_id, position);

ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mídia visível a todos"
  ON public.post_media FOR SELECT USING (true);

CREATE POLICY "Criadora insere mídia em seus posts"
  ON public.post_media FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND p.creator_id = auth.uid()
  ));

CREATE POLICY "Criadora apaga mídia de seus posts"
  ON public.post_media FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND p.creator_id = auth.uid()
  ));

-- =========================================
-- PPV UNLOCKS
-- =========================================
CREATE TABLE public.ppv_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE public.ppv_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus desbloqueios"
  ON public.ppv_unlocks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Criadora vê desbloqueios de seus posts"
  ON public.ppv_unlocks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND p.creator_id = auth.uid()
  ));

CREATE POLICY "Usuário cria seu desbloqueio"
  ON public.ppv_unlocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =========================================
-- SUBSCRIPTIONS
-- =========================================
CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'expired');

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  price_cents INTEGER NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, creator_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas assinaturas"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_id OR auth.uid() = creator_id);

CREATE POLICY "Usuário cria sua assinatura"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Usuário cancela sua assinatura"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = subscriber_id);

CREATE TRIGGER trg_subs_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- TRANSACTIONS
-- =========================================
CREATE TYPE public.tx_type AS ENUM ('ppv', 'subscription', 'tip', 'withdrawal');
CREATE TYPE public.tx_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id UUID,
  payee_id UUID,
  type public.tx_type NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  reference_id UUID,
  gateway TEXT,
  gateway_ref TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_payer ON public.transactions(payer_id, created_at DESC);
CREATE INDEX idx_tx_payee ON public.transactions(payee_id, created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas transações"
  ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = payer_id OR auth.uid() = payee_id);

CREATE POLICY "Admin vê tudo"
  ON public.transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuário registra sua transação"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = payer_id);

CREATE TRIGGER trg_tx_updated
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- FOLLOWS
-- =========================================
CREATE TABLE public.follows (
  follower_id UUID NOT NULL,
  followee_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows visíveis a todos"
  ON public.follows FOR SELECT USING (true);

CREATE POLICY "Usuário cria seu follow"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Usuário remove seu follow"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- =========================================
-- STORAGE: posts bucket
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Mídia de posts pública"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

CREATE POLICY "Criadora envia mídia em sua pasta"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Criadora apaga sua mídia"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =========================================
-- AUTO-PROMOÇÃO DO PRIMEIRO USUÁRIO PARA ADMIN
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
  is_first BOOLEAN;
BEGIN
  base_username := lower(regexp_replace(
    coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'
  ));
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'user' || substr(NEW.id::text, 1, 8);
  END IF;
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    coalesce(NEW.raw_user_meta_data->>'display_name', final_username)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'subscriber');

  -- Primeiro usuário da plataforma vira admin automaticamente
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  ) INTO is_first;

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
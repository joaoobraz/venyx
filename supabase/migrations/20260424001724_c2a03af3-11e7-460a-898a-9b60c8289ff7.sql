-- =========================================================================
-- STORIES 24H
-- =========================================================================
CREATE TYPE public.story_visibility AS ENUM ('public', 'subscribers');

CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  media_path text NOT NULL,
  mime_type text NOT NULL,
  visibility public.story_visibility NOT NULL DEFAULT 'public',
  views_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stories_creator ON public.stories(creator_id);
CREATE INDEX idx_stories_expires ON public.stories(expires_at);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stories visíveis enquanto não expiram" ON public.stories
  FOR SELECT USING (expires_at > now());
CREATE POLICY "Criadora cria seus stories" ON public.stories
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));
CREATE POLICY "Criadora apaga seus stories" ON public.stories
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewer vê suas views" ON public.story_views
  FOR SELECT TO authenticated USING (auth.uid() = viewer_id);
CREATE POLICY "Criadora vê views dos seus stories" ON public.story_views
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.creator_id = auth.uid()));
CREATE POLICY "Viewer registra sua view" ON public.story_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- =========================================================================
-- AFILIADOS
-- =========================================================================
CREATE TABLE public.affiliate_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  commission_pct integer NOT NULL DEFAULT 10 CHECK (commission_pct BETWEEN 1 AND 50),
  total_clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_affiliate_codes_code ON public.affiliate_codes(code);
ALTER TABLE public.affiliate_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Códigos visíveis a todos" ON public.affiliate_codes FOR SELECT USING (true);
CREATE POLICY "Embaixadora cria seu código" ON public.affiliate_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_role(auth.uid(), 'creator')
    AND public.has_role(auth.uid(), 'ambassador')
  );
CREATE POLICY "Embaixadora atualiza seu código" ON public.affiliate_codes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  ambassador_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  converted_at timestamptz,
  commission_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_ambassador ON public.affiliate_referrals(ambassador_id);
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Embaixadora vê suas referências" ON public.affiliate_referrals
  FOR SELECT TO authenticated USING (auth.uid() = ambassador_id);
CREATE POLICY "Referido vê seu registro" ON public.affiliate_referrals
  FOR SELECT TO authenticated USING (auth.uid() = referred_user_id);
CREATE POLICY "Usuário registra sua referência" ON public.affiliate_referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = referred_user_id);

CREATE OR REPLACE FUNCTION public.handle_affiliate_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref RECORD; pct integer; comm_cents integer;
BEGIN
  IF NEW.type <> 'subscription' OR NEW.status <> 'paid' THEN RETURN NEW; END IF;
  SELECT r.* INTO ref FROM public.affiliate_referrals r
   WHERE r.referred_user_id = NEW.payer_id AND r.converted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT commission_pct INTO pct FROM public.affiliate_codes WHERE user_id = ref.ambassador_id;
  IF pct IS NULL THEN pct := 10; END IF;
  comm_cents := (NEW.amount_cents * pct) / 100;
  UPDATE public.affiliate_referrals
    SET converted_at = now(), commission_cents = comm_cents WHERE id = ref.id;
  INSERT INTO public.transactions (payer_id, payee_id, type, status, amount_cents, reference_id, gateway, metadata)
  VALUES (NULL, ref.ambassador_id, 'affiliate_commission', 'paid', comm_cents, NEW.id, 'mock',
          jsonb_build_object('referral_id', ref.id, 'subscription_tx', NEW.id));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_affiliate_commission
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_affiliate_commission();

-- =========================================================================
-- CUPONS
-- =========================================================================
CREATE TABLE public.subscription_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  trial_days integer CHECK (trial_days BETWEEN 1 AND 30),
  discount_pct integer CHECK (discount_pct BETWEEN 5 AND 90),
  duration_months integer NOT NULL DEFAULT 1 CHECK (duration_months BETWEEN 1 AND 12),
  max_uses integer NOT NULL DEFAULT 100,
  uses_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (trial_days IS NOT NULL OR discount_pct IS NOT NULL)
);
CREATE INDEX idx_coupons_creator ON public.subscription_coupons(creator_id);
CREATE INDEX idx_coupons_code ON public.subscription_coupons(code);
ALTER TABLE public.subscription_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cupons visíveis a todos" ON public.subscription_coupons FOR SELECT USING (true);
CREATE POLICY "Criadora cria seus cupons" ON public.subscription_coupons
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));
CREATE POLICY "Criadora atualiza seus cupons" ON public.subscription_coupons
  FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora apaga seus cupons" ON public.subscription_coupons
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.subscription_coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seus resgates" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Criadora vê resgates dos seus cupons" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subscription_coupons c WHERE c.id = coupon_id AND c.creator_id = auth.uid()));
CREATE POLICY "Usuário registra seu resgate" ON public.coupon_redemptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- PLANOS DE ASSINATURA
-- =========================================================================
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  months integer NOT NULL CHECK (months IN (1, 3, 6, 12)),
  price_cents integer NOT NULL CHECK (price_cents >= 100),
  discount_pct integer NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 90),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, months)
);
CREATE INDEX idx_plans_creator ON public.subscription_plans(creator_id);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Planos visíveis a todos" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Criadora cria seus planos" ON public.subscription_plans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));
CREATE POLICY "Criadora atualiza seus planos" ON public.subscription_plans
  FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Criadora apaga seus planos" ON public.subscription_plans
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- CHAT
-- =========================================================================
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX idx_threads_user_a ON public.chat_threads(user_a);
CREATE INDEX idx_threads_user_b ON public.chat_threads(user_b);
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participantes veem thread" ON public.chat_threads
  FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));
CREATE POLICY "Usuário cria thread da qual participa" ON public.chat_threads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (user_a, user_b));

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text,
  media_path text,
  mime_type text,
  ppv_price_cents integer NOT NULL DEFAULT 0 CHECK (ppv_price_cents >= 0),
  subscribers_only boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participantes leem mensagens" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_threads t
    WHERE t.id = thread_id AND auth.uid() IN (t.user_a, t.user_b)));
CREATE POLICY "Participantes enviam mensagens" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = thread_id AND auth.uid() IN (t.user_a, t.user_b)));
CREATE POLICY "Destinatário marca como lida" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_threads t
    WHERE t.id = thread_id AND auth.uid() IN (t.user_a, t.user_b) AND auth.uid() <> sender_id));

CREATE TABLE public.chat_ppv_unlocks (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
ALTER TABLE public.chat_ppv_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seus desbloqueios chat" ON public.chat_ppv_unlocks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuário cria seu desbloqueio chat" ON public.chat_ppv_unlocks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_thread_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_threads SET last_message_at = NEW.created_at WHERE id = NEW.thread_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_touch_thread
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_thread_last_message();

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;

-- =========================================================================
-- DMCA
-- =========================================================================
CREATE TYPE public.dmca_status AS ENUM ('pending', 'notified', 'resolved', 'rejected');

CREATE TABLE public.dmca_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  leaked_url text NOT NULL,
  description text,
  evidence_path text,
  status public.dmca_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dmca_creator ON public.dmca_reports(creator_id);
CREATE INDEX idx_dmca_status ON public.dmca_reports(status);
ALTER TABLE public.dmca_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Criadora vê seus reports" ON public.dmca_reports
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Admin vê todos reports" ON public.dmca_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Criadora cria seu report" ON public.dmca_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));
CREATE POLICY "Admin atualiza reports" ON public.dmca_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_dmca_updated_at
BEFORE UPDATE ON public.dmca_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 2FA
-- =========================================================================
CREATE TABLE public.security_settings (
  user_id uuid PRIMARY KEY,
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_required_for_withdraw boolean NOT NULL DEFAULT true,
  backup_codes_hash text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê suas config" ON public.security_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuário insere suas config" ON public.security_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuário atualiza suas config" ON public.security_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_security_updated_at
BEFORE UPDATE ON public.security_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- STORAGE BUCKETS
-- =========================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('dmca-evidence', 'dmca-evidence', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Stories público lê" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Criadora envia story" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Criadora apaga seu story" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuário envia chat media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Sender lê seu chat media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Criadora envia evidência DMCA" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dmca-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Criadora lê sua evidência DMCA" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dmca-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admin lê toda evidência DMCA" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dmca-evidence' AND public.has_role(auth.uid(), 'admin'));
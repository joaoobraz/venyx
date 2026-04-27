
-- ============================================================
-- 1. WISHLIST
-- ============================================================
CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('creator', 'post')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX idx_wishlists_user ON public.wishlists(user_id, created_at DESC);
CREATE INDEX idx_wishlists_target ON public.wishlists(target_type, target_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wishlist: dono lê seus itens"
  ON public.wishlists FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Wishlist: criadora vê quem favoritou ela"
  ON public.wishlists FOR SELECT TO authenticated
  USING (
    (target_type = 'creator' AND target_id = auth.uid())
    OR (target_type = 'post' AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = wishlists.target_id AND p.creator_id = auth.uid()
    ))
  );

CREATE POLICY "Wishlist: dono cria"
  ON public.wishlists FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Wishlist: dono apaga"
  ON public.wishlists FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. TRIAL (período grátis nativo)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_days_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 3;

ALTER TABLE public.profiles
  ADD CONSTRAINT trial_days_range CHECK (trial_days BETWEEN 1 AND 14);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS months integer;

CREATE TABLE public.subscription_trials_used (
  user_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creator_id)
);

ALTER TABLE public.subscription_trials_used ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trial usado: usuário vê o seu"
  ON public.subscription_trials_used FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- Função para iniciar trial (security definer pra contornar RLS de subscriptions)
CREATE OR REPLACE FUNCTION public.start_creator_trial(_creator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _trial_enabled boolean;
  _trial_days int;
  _already_used boolean;
  _has_active boolean;
  _new_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF _user_id = _creator_id THEN
    RETURN jsonb_build_object('error', 'cannot_subscribe_self');
  END IF;

  SELECT trial_days_enabled, trial_days INTO _trial_enabled, _trial_days
  FROM profiles WHERE user_id = _creator_id;

  IF NOT COALESCE(_trial_enabled, false) THEN
    RETURN jsonb_build_object('error', 'trial_not_offered');
  END IF;

  SELECT EXISTS(SELECT 1 FROM subscription_trials_used
                WHERE user_id = _user_id AND creator_id = _creator_id)
    INTO _already_used;
  IF _already_used THEN
    RETURN jsonb_build_object('error', 'trial_already_used');
  END IF;

  SELECT EXISTS(SELECT 1 FROM subscriptions
                WHERE subscriber_id = _user_id AND creator_id = _creator_id
                  AND status = 'active')
    INTO _has_active;
  IF _has_active THEN
    RETURN jsonb_build_object('error', 'already_subscribed');
  END IF;

  INSERT INTO subscriptions (subscriber_id, creator_id, status, current_period_start, current_period_end, is_trial, months)
  VALUES (_user_id, _creator_id, 'active', now(), now() + (_trial_days || ' days')::interval, true, 0)
  RETURNING id INTO _new_id;

  INSERT INTO subscription_trials_used (user_id, creator_id) VALUES (_user_id, _creator_id);

  RETURN jsonb_build_object('subscription_id', _new_id, 'trial_days', _trial_days);
END;
$$;

-- ============================================================
-- 3. LOYALTY / FIDELIDADE
-- ============================================================
CREATE TABLE public.loyalty_points (
  user_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','diamond')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creator_id)
);

CREATE INDEX idx_loyalty_creator_points ON public.loyalty_points(creator_id, points DESC);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Loyalty: usuário vê seus pontos"
  ON public.loyalty_points FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Loyalty: criadora vê seus fãs"
  ON public.loyalty_points FOR SELECT TO authenticated
  USING (auth.uid() = creator_id);

CREATE TABLE public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  points_delta integer NOT NULL,
  reason text NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_ledger_user ON public.loyalty_ledger(user_id, creator_id, created_at DESC);

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ledger: usuário vê seu histórico"
  ON public.loyalty_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Ledger: criadora vê seu histórico"
  ON public.loyalty_ledger FOR SELECT TO authenticated
  USING (auth.uid() = creator_id);

-- Função pra calcular tier
CREATE OR REPLACE FUNCTION public.calc_loyalty_tier(_points int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _points >= 5000 THEN 'diamond'
    WHEN _points >= 2000 THEN 'gold'
    WHEN _points >= 500  THEN 'silver'
    ELSE 'bronze'
  END;
$$;

-- Função pra creditar pontos (security definer, idempotente por ref_id+reason)
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  _user_id uuid, _creator_id uuid, _delta int, _reason text, _ref_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exists boolean;
  _new_total int;
BEGIN
  IF _user_id IS NULL OR _creator_id IS NULL OR _user_id = _creator_id OR _delta = 0 THEN
    RETURN;
  END IF;

  -- Idempotência: se já existe lançamento com mesma reason+ref_id, não duplica
  IF _ref_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM loyalty_ledger
      WHERE user_id = _user_id AND creator_id = _creator_id
        AND reason = _reason AND ref_id = _ref_id
    ) INTO _exists;
    IF _exists THEN RETURN; END IF;
  END IF;

  INSERT INTO loyalty_ledger (user_id, creator_id, points_delta, reason, ref_id)
  VALUES (_user_id, _creator_id, _delta, _reason, _ref_id);

  INSERT INTO loyalty_points (user_id, creator_id, points, tier)
  VALUES (_user_id, _creator_id, GREATEST(_delta, 0), calc_loyalty_tier(GREATEST(_delta, 0)))
  ON CONFLICT (user_id, creator_id) DO UPDATE
    SET points = GREATEST(loyalty_points.points + _delta, 0),
        tier = calc_loyalty_tier(GREATEST(loyalty_points.points + _delta, 0)),
        updated_at = now();
END;
$$;

-- Triggers de pontuação automática (1 ponto por R$1 = 100 cents)

-- PPV de post
CREATE OR REPLACE FUNCTION public.trg_ppv_unlock_award_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _creator uuid;
BEGIN
  SELECT creator_id INTO _creator FROM posts WHERE id = NEW.post_id;
  IF _creator IS NOT NULL THEN
    PERFORM award_loyalty_points(NEW.user_id, _creator, NEW.amount_cents / 100, 'ppv_post', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_points_on_ppv_unlock ON public.ppv_unlocks;
CREATE TRIGGER award_points_on_ppv_unlock
  AFTER INSERT ON public.ppv_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.trg_ppv_unlock_award_points();

-- PPV de chat
CREATE OR REPLACE FUNCTION public.trg_chat_ppv_unlock_award_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _creator uuid;
BEGIN
  SELECT sender_id INTO _creator FROM chat_messages WHERE id = NEW.message_id;
  IF _creator IS NOT NULL THEN
    PERFORM award_loyalty_points(NEW.user_id, _creator, NEW.amount_cents / 100, 'ppv_chat', NEW.message_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_points_on_chat_ppv ON public.chat_ppv_unlocks;
CREATE TRIGGER award_points_on_chat_ppv
  AFTER INSERT ON public.chat_ppv_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.trg_chat_ppv_unlock_award_points();

-- Pagamentos PIX (assinatura, gorjeta) - quando muda pra paid
CREATE OR REPLACE FUNCTION public.trg_pix_paid_award_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    IF NEW.purpose IN ('subscription', 'tip', 'ppv_post', 'ppv_chat') AND NEW.payee_id IS NOT NULL THEN
      PERFORM award_loyalty_points(NEW.payer_id, NEW.payee_id, NEW.amount_cents / 100, 'pix_' || NEW.purpose::text, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_points_on_pix_paid ON public.pix_charges;
CREATE TRIGGER award_points_on_pix_paid
  AFTER UPDATE ON public.pix_charges
  FOR EACH ROW EXECUTE FUNCTION public.trg_pix_paid_award_points();

-- ============================================================
-- 4. MASS DM PAID — receita por campanha
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_campaign ON public.chat_messages(campaign_id) WHERE campaign_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mass_dm_campaign_revenue(_creator_id uuid)
RETURNS TABLE(campaign_id uuid, unlocks_count bigint, revenue_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.campaign_id,
    COUNT(u.message_id)::bigint AS unlocks_count,
    COALESCE(SUM(u.amount_cents), 0)::bigint AS revenue_cents
  FROM chat_messages m
  LEFT JOIN chat_ppv_unlocks u ON u.message_id = m.id
  WHERE m.campaign_id IS NOT NULL
    AND m.sender_id = _creator_id
    AND auth.uid() = _creator_id
  GROUP BY m.campaign_id;
$$;

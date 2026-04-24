-- ============ affiliate_codes ============
DROP POLICY IF EXISTS "affiliate_codes_select_all" ON public.affiliate_codes;
DROP POLICY IF EXISTS "affiliate codes are viewable by everyone" ON public.affiliate_codes;
DROP POLICY IF EXISTS "Anyone can view affiliate codes" ON public.affiliate_codes;
DROP POLICY IF EXISTS "affiliate_codes_select_own" ON public.affiliate_codes;

CREATE POLICY "affiliate_codes_select_own"
ON public.affiliate_codes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============ subscription_coupons ============
DROP POLICY IF EXISTS "subscription_coupons_select_all" ON public.subscription_coupons;
DROP POLICY IF EXISTS "Anyone can view coupons" ON public.subscription_coupons;
DROP POLICY IF EXISTS "subscription_coupons_select_own" ON public.subscription_coupons;

CREATE POLICY "subscription_coupons_select_own"
ON public.subscription_coupons
FOR SELECT
TO authenticated
USING (creator_id = auth.uid());

-- (a validação de cupom no checkout deve ser feita server-side via function definer)
CREATE OR REPLACE FUNCTION public.validate_coupon(_creator_id uuid, _code text)
RETURNS TABLE(id uuid, discount_pct integer, trial_days integer, duration_months integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.discount_pct, c.trial_days, c.duration_months
  FROM public.subscription_coupons c
  WHERE c.creator_id = _creator_id
    AND c.code = _code
    AND c.is_active = true
    AND (c.max_uses = 0 OR c.uses_count < c.max_uses)
  LIMIT 1;
$$;

-- ============ follows ============
DROP POLICY IF EXISTS "follows_select_all" ON public.follows;
DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;
DROP POLICY IF EXISTS "follows_select_own" ON public.follows;

CREATE POLICY "follows_select_own"
ON public.follows
FOR SELECT
TO authenticated
USING (follower_id = auth.uid() OR followee_id = auth.uid());

-- ============ KYC obrigatório para saque ============
CREATE OR REPLACE FUNCTION public.enforce_kyc_for_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'withdrawal' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.kyc_requests
      WHERE user_id = NEW.payee_id
        AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'KYC aprovado é obrigatório para realizar saques';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kyc_withdrawal ON public.transactions;
CREATE TRIGGER trg_enforce_kyc_withdrawal
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_kyc_for_withdrawal();
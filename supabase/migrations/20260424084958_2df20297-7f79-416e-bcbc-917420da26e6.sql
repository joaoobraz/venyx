
DROP POLICY IF EXISTS "Affiliate codes: autenticado lê" ON public.affiliate_codes;
CREATE POLICY "Affiliate: dono lê próprio código"
  ON public.affiliate_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Coupons: autenticado lê" ON public.subscription_coupons;
CREATE POLICY "Coupons: criadora lê seus cupons"
  ON public.subscription_coupons FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

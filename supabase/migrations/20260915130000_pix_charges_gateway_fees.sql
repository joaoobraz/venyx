-- =====================================================================
-- 2026-09-15 — Guardar a taxa cobrada pela Impulse Pay em cada cobrança
--
-- A adquirente devolve fee/net_amount em cada transação, mas só os saques
-- registravam isso. Com as colunas abaixo o admin enxerga quanto a Impulse
-- Pay cobra de verdade (por cobrança e acumulado) sem entrar no painel dela.
-- =====================================================================

ALTER TABLE public.pix_charges
  ADD COLUMN IF NOT EXISTS gateway_fee_cents integer,
  ADD COLUMN IF NOT EXISTS gateway_net_amount_cents integer;

COMMENT ON COLUMN public.pix_charges.gateway_fee_cents IS 'Taxa cobrada pela adquirente nesta cobrança (centavos), conforme a API.';
COMMENT ON COLUMN public.pix_charges.gateway_net_amount_cents IS 'Valor líquido creditado pela adquirente (centavos), conforme a API.';

NOTIFY pgrst, 'reload schema';

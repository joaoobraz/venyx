-- =====================================================================
-- 2026-09-15 — Corrige saldo sempre "pendente" para a criadora
--
-- creator_balances é security_invoker, mas platform_settings só é legível por
-- admin. Ao consultar o saldo, a criadora não lia hold_days/platform_fee_pct,
-- que viravam NULL: is_available = NULL → tudo pendente, saldo disponível 0.
-- Isso bloqueava TODO saque (não só o modo teste), inclusive a checagem de
-- saldo dentro de create_withdrawal_request (que lê esta view).
--
-- Correção: expor só os dois valores globais por funções SECURITY DEFINER e
-- a view passa a usá-las, mantendo o RLS por linha das transações intacto.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_hold_days()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT hold_days FROM public.platform_settings WHERE id = 1), 1);
$$;

REVOKE ALL ON FUNCTION public.get_hold_days() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hold_days() TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.creator_balances
WITH (security_invoker = true)
AS
WITH earnings AS (
  SELECT
    t.payee_id AS creator_id,
    t.amount_cents,
    t.created_at,
    (t.amount_cents * (100 - public.get_platform_fee_pct()) / 100) AS net_cents,
    (t.created_at <= now() - make_interval(days => public.get_hold_days())) AS is_available
  FROM public.transactions t
  WHERE t.status = 'paid'
    AND t.payee_id IS NOT NULL
    AND t.type IN ('subscription', 'ppv', 'tip', 'chat_ppv', 'affiliate_commission')
),
agg AS (
  SELECT
    creator_id,
    COALESCE(SUM(amount_cents), 0) AS gross_lifetime_cents,
    COALESCE(SUM(net_cents), 0) AS net_lifetime_cents,
    COALESCE(SUM(CASE WHEN is_available THEN net_cents ELSE 0 END), 0) AS available_gross_cents,
    COALESCE(SUM(CASE WHEN NOT is_available THEN net_cents ELSE 0 END), 0) AS pending_cents
  FROM earnings
  GROUP BY creator_id
),
withdrawn AS (
  SELECT
    creator_id,
    COALESCE(SUM(
      CASE WHEN status = 'paid' THEN
        COALESCE(gateway_net_amount_cents, amount_cents) + fanlira_withdrawal_fee_cents
      ELSE 0 END
    ), 0) AS total_paid_cents,
    COALESCE(SUM(
      CASE WHEN status IN ('pending', 'approved', 'processing') THEN
        COALESCE(gateway_net_amount_cents, amount_cents) + fanlira_withdrawal_fee_cents
      ELSE 0 END
    ), 0) AS in_flight_cents
  FROM public.withdrawal_requests
  GROUP BY creator_id
)
SELECT
  a.creator_id,
  a.gross_lifetime_cents,
  a.net_lifetime_cents,
  a.pending_cents,
  COALESCE(w.total_paid_cents, 0) AS total_withdrawn_cents,
  COALESCE(w.in_flight_cents, 0) AS in_flight_cents,
  GREATEST(
    a.available_gross_cents - COALESCE(w.total_paid_cents, 0) - COALESCE(w.in_flight_cents, 0),
    0
  ) AS available_cents
FROM agg a
LEFT JOIN withdrawn w ON w.creator_id = a.creator_id;

GRANT SELECT ON public.creator_balances TO authenticated;

NOTIFY pgrst, 'reload schema';

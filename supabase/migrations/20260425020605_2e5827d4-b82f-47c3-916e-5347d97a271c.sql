-- ============ Configurações globais da plataforma ============
CREATE TABLE public.platform_settings (
  id INT PRIMARY KEY DEFAULT 1,
  platform_fee_pct INT NOT NULL DEFAULT 15,
  hold_days INT NOT NULL DEFAULT 1,
  min_withdrawal_cents INT NOT NULL DEFAULT 3000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT only_one_row CHECK (id = 1)
);

INSERT INTO public.platform_settings (id) VALUES (1);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos leem settings" ON public.platform_settings
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admin atualiza settings" ON public.platform_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ Tipo de chave PIX ============
CREATE TYPE public.pix_key_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');

-- ============ Chave PIX da criadora ============
CREATE TABLE public.creator_payout_keys (
  user_id UUID PRIMARY KEY,
  pix_key TEXT NOT NULL,
  pix_key_type public.pix_key_type NOT NULL,
  holder_name TEXT NOT NULL,
  holder_document TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_payout_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criadora vê sua chave" ON public.creator_payout_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admin vê todas as chaves" ON public.creator_payout_keys
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Criadora cria sua chave" ON public.creator_payout_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Criadora atualiza sua chave" ON public.creator_payout_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_payout_keys_updated
  BEFORE UPDATE ON public.creator_payout_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Status do saque ============
CREATE TYPE public.withdrawal_status AS ENUM (
  'pending',     -- criadora pediu, aguardando admin
  'approved',    -- admin aprovou, vai pagar
  'processing',  -- pagamento em curso
  'paid',        -- pago
  'rejected',    -- recusado pelo admin
  'canceled'     -- criadora cancelou antes de aprovar
);

-- ============ Pedidos de saque ============
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  amount_cents INT NOT NULL,
  pix_key TEXT NOT NULL,
  pix_key_type public.pix_key_type NOT NULL,
  holder_name TEXT NOT NULL,
  holder_document TEXT NOT NULL,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  receipt_url TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_withdrawals_creator ON public.withdrawal_requests(creator_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON public.withdrawal_requests(status, created_at);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criadora vê seus saques" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);

CREATE POLICY "Admin vê todos saques" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT/UPDATE somente via server functions (service role) — sem policy

CREATE TRIGGER trg_withdrawals_updated
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ View de saldo da criadora ============
CREATE OR REPLACE VIEW public.creator_balances
WITH (security_invoker = true)
AS
WITH s AS (
  SELECT platform_fee_pct, hold_days, min_withdrawal_cents
    FROM public.platform_settings WHERE id = 1
),
earnings AS (
  -- Tudo que a criadora "ganhou" (recebeu como payee em tx pagas)
  SELECT
    t.payee_id AS creator_id,
    t.amount_cents,
    t.created_at,
    -- Líquido após fee da plataforma
    (t.amount_cents * (100 - (SELECT platform_fee_pct FROM s)) / 100) AS net_cents,
    -- Disponível se passou o hold
    (t.created_at <= now() - make_interval(days => (SELECT hold_days FROM s))) AS is_available
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
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END), 0) AS total_paid_cents,
    COALESCE(SUM(CASE WHEN status IN ('pending','approved','processing') THEN amount_cents ELSE 0 END), 0) AS in_flight_cents
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

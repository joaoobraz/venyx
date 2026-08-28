-- ===== Tabela de notificações in-app =====
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User vê suas notificações"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "User marca suas notificações como lidas"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===== Tabela genérica de cobranças PIX =====
-- Persiste cada cobrança gerada para que o webhook possa creditar a venda correta
CREATE TYPE public.pix_charge_purpose AS ENUM ('subscription', 'ppv', 'tip', 'goal', 'chat_ppv');
CREATE TYPE public.pix_charge_status AS ENUM ('pending', 'paid', 'expired', 'cancelled', 'refunded');

CREATE TABLE public.pix_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  gateway_transaction_id TEXT,
  payer_id UUID NOT NULL,                -- usuário que está pagando
  payee_id UUID NOT NULL,                -- criadora que vai receber crédito virtual
  purpose public.pix_charge_purpose NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status public.pix_charge_status NOT NULL DEFAULT 'pending',
  -- Contexto do que comprar quando confirmar:
  reference_id UUID,                     -- post_id (ppv/goal), creator_id (sub/tip), message_id (chat_ppv)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Flags de cobrança
  qr_code TEXT,
  qr_code_base64 TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pix_charges_payer ON public.pix_charges(payer_id, created_at DESC);
CREATE INDEX idx_pix_charges_status ON public.pix_charges(status);
CREATE INDEX idx_pix_charges_gateway_tx ON public.pix_charges(gateway_transaction_id);

ALTER TABLE public.pix_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pagador vê suas cobranças"
  ON public.pix_charges FOR SELECT TO authenticated
  USING (auth.uid() = payer_id);

CREATE POLICY "Recebedor vê cobranças destinadas a ele"
  ON public.pix_charges FOR SELECT TO authenticated
  USING (auth.uid() = payee_id);

CREATE POLICY "Admin vê todas as cobranças"
  ON public.pix_charges FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_pix_charges_updated_at
  BEFORE UPDATE ON public.pix_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

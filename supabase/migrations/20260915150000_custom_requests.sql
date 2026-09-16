-- =====================================================================
-- 2026-09-15 — Pedidos personalizados (conteúdo sob encomenda)
--
-- Fluxo: fã descreve o pedido e oferece um valor (≥ mínimo da criadora) →
-- criadora aceita (podendo ajustar o valor) ou recusa → fã paga via Pix
-- (cobrança com purpose 'tip' + metadata.kind = 'custom_request', assim o
-- valor entra no saldo como qualquer mimo) → criadora entrega no chat e
-- marca como entregue. Toda escrita é feita pelo servidor; o cliente só lê.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.creator_request_settings (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  min_price_cents integer NOT NULL DEFAULT 5000 CHECK (min_price_cents BETWEEN 100 AND 1000000),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 600),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_request_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos leem configurações de pedidos" ON public.creator_request_settings;
CREATE POLICY "Todos leem configurações de pedidos" ON public.creator_request_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Criadora gerencia configurações de pedidos" ON public.creator_request_settings;
CREATE POLICY "Criadora gerencia configurações de pedidos" ON public.creator_request_settings
  FOR ALL TO authenticated
  USING (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'::public.app_role))
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'::public.app_role));
GRANT SELECT, INSERT, UPDATE ON public.creator_request_settings TO authenticated;

CREATE TABLE IF NOT EXISTS public.custom_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 100 AND 1000000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'paid', 'delivered', 'declined', 'cancelled')),
  creator_note text CHECK (creator_note IS NULL OR char_length(creator_note) <= 500),
  charge_id uuid REFERENCES public.pix_charges(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  CONSTRAINT custom_requests_not_self CHECK (creator_id <> fan_id)
);
CREATE INDEX IF NOT EXISTS custom_requests_creator_idx ON public.custom_requests (creator_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS custom_requests_fan_idx ON public.custom_requests (fan_id, created_at DESC);
ALTER TABLE public.custom_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partes leem o pedido" ON public.custom_requests;
CREATE POLICY "Partes leem o pedido" ON public.custom_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = fan_id OR auth.uid() = creator_id);
-- Escrita só pelo servidor (service_role); nenhuma policy de INSERT/UPDATE.
REVOKE ALL ON public.custom_requests FROM anon, authenticated;
GRANT SELECT ON public.custom_requests TO authenticated;

NOTIFY pgrst, 'reload schema';

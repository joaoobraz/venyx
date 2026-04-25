-- Enum: tipo de oferta
CREATE TYPE public.upsell_offer_kind AS ENUM ('order_bump', 'post_purchase_upsell');

-- Estende o enum de propósito de cobrança Pix
ALTER TYPE public.pix_charge_purpose ADD VALUE IF NOT EXISTS 'upsell';

-- Tabela de ofertas
CREATE TABLE public.upsell_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  kind public.upsell_offer_kind NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  description TEXT CHECK (description IS NULL OR length(description) <= 280),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 100 AND price_cents <= 1000000),
  media_post_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_upsell_offers_creator_kind ON public.upsell_offers(creator_id, kind, is_active, position);

ALTER TABLE public.upsell_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ofertas ativas visíveis a todos"
  ON public.upsell_offers FOR SELECT
  USING (is_active = true OR creator_id = auth.uid());

CREATE POLICY "Criadora cria suas ofertas"
  ON public.upsell_offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'::app_role));

CREATE POLICY "Criadora atualiza suas ofertas"
  ON public.upsell_offers FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Criadora apaga suas ofertas"
  ON public.upsell_offers FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

CREATE TRIGGER trg_upsell_offers_updated
  BEFORE UPDATE ON public.upsell_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de compras
CREATE TABLE public.upsell_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.upsell_offers(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  pix_charge_id UUID NULL,
  parent_charge_id UUID NULL,
  amount_cents INTEGER NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('bump','upsell')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_upsell_purchases_buyer ON public.upsell_purchases(buyer_id, created_at DESC);
CREATE INDEX idx_upsell_purchases_creator ON public.upsell_purchases(creator_id, created_at DESC);

ALTER TABLE public.upsell_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comprador vê suas compras"
  ON public.upsell_purchases FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Criadora vê compras dos seus upsells"
  ON public.upsell_purchases FOR SELECT TO authenticated
  USING (auth.uid() = creator_id);

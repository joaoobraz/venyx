-- Venyx Links: URLs seguras e métricas públicas deduplicadas.
-- Lista de Mimos: catálogo simbólico cuja liquidação credita a carteira da criadora.

UPDATE public.creator_links
SET url = 'https://' || btrim(url)
WHERE url !~* '^https?://' AND btrim(url) ~* '^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$';

UPDATE public.creator_links
SET url = 'https://fanlira.com.br', is_active = false
WHERE url !~* '^https?://' OR char_length(url) NOT BETWEEN 8 AND 2048;

UPDATE public.creator_links
SET title = COALESCE(NULLIF(left(btrim(title), 80), ''), 'Link')
WHERE char_length(btrim(title)) NOT BETWEEN 1 AND 80;

ALTER TABLE public.creator_links
  DROP CONSTRAINT IF EXISTS creator_links_safe_url,
  DROP CONSTRAINT IF EXISTS creator_links_title_length;

ALTER TABLE public.creator_links
  ADD CONSTRAINT creator_links_safe_url
    CHECK (char_length(url) BETWEEN 8 AND 2048 AND url ~* '^https?://'),
  ADD CONSTRAINT creator_links_title_length
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 80);

CREATE TABLE IF NOT EXISTS public.creator_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_owner_id uuid NOT NULL,
  link_id uuid REFERENCES public.creator_links(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'click')),
  visitor_hash text NOT NULL CHECK (char_length(visitor_hash) = 64),
  event_day date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_link_event_shape CHECK (
    (event_type = 'view' AND link_id IS NULL) OR
    (event_type = 'click' AND link_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_link_events_unique_view
  ON public.creator_link_events(page_owner_id, event_type, visitor_hash, event_day)
  WHERE link_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS creator_link_events_unique_click
  ON public.creator_link_events(link_id, event_type, visitor_hash, event_day)
  WHERE link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creator_link_events_owner_created
  ON public.creator_link_events(page_owner_id, created_at DESC);

ALTER TABLE public.creator_link_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creator_link_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.creator_link_events TO service_role;

CREATE OR REPLACE FUNCTION public.apply_creator_link_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.event_type = 'view' THEN
    UPDATE public.creator_link_pages
      SET views_count = views_count + 1
      WHERE user_id = NEW.page_owner_id;
  ELSE
    UPDATE public.creator_links
      SET clicks_count = clicks_count + 1
      WHERE id = NEW.link_id AND user_id = NEW.page_owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_creator_link_event ON public.creator_link_events;
CREATE TRIGGER trg_apply_creator_link_event
AFTER INSERT ON public.creator_link_events
FOR EACH ROW EXECUTE FUNCTION public.apply_creator_link_event();

-- Configuração pública da lista de mimos.
CREATE TABLE IF NOT EXISTS public.creator_gift_settings (
  creator_id uuid PRIMARY KEY,
  title text NOT NULL DEFAULT 'Minha Lista de Mimos'
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  intro text NOT NULL DEFAULT 'Escolha um mimo simbólico para apoiar meu trabalho.'
    CHECK (char_length(intro) <= 300),
  thank_you_message text NOT NULL DEFAULT 'Obrigada por fazer parte disso! 💝'
    CHECK (char_length(thank_you_message) <= 200),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_gift_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  category text NOT NULL CHECK (
    category IN ('lingerie', 'adult_wellness', 'equipment', 'beauty', 'experience', 'custom')
  ),
  emoji text NOT NULL DEFAULT '🎁' CHECK (char_length(emoji) BETWEEN 1 AND 16),
  value_cents integer NOT NULL CHECK (value_cents BETWEEN 100 AND 1000000),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_active boolean NOT NULL DEFAULT true,
  received_count integer NOT NULL DEFAULT 0 CHECK (received_count >= 0),
  received_cents bigint NOT NULL DEFAULT 0 CHECK (received_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_gift_items_owner_position
  ON public.creator_gift_items(creator_id, position);

CREATE TABLE IF NOT EXISTS public.creator_gift_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.creator_gift_items(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL,
  supporter_id uuid NOT NULL,
  pix_charge_id uuid NOT NULL REFERENCES public.pix_charges(id) ON DELETE RESTRICT UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 100 AND 1000000),
  message text CHECK (message IS NULL OR char_length(message) <= 200),
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_gift_contributions_creator_paid
  ON public.creator_gift_contributions(creator_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS creator_gift_contributions_supporter_paid
  ON public.creator_gift_contributions(supporter_id, paid_at DESC);

ALTER TABLE public.creator_gift_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_gift_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_gift_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lista de mimos pública ou da criadora" ON public.creator_gift_settings;
CREATE POLICY "Lista de mimos pública ou da criadora"
  ON public.creator_gift_settings FOR SELECT TO public
  USING (is_published OR auth.uid() = creator_id);
DROP POLICY IF EXISTS "Criadora cria lista de mimos" ON public.creator_gift_settings;
CREATE POLICY "Criadora cria lista de mimos"
  ON public.creator_gift_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));
DROP POLICY IF EXISTS "Criadora edita lista de mimos" ON public.creator_gift_settings;
CREATE POLICY "Criadora edita lista de mimos"
  ON public.creator_gift_settings FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'))
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));

DROP POLICY IF EXISTS "Mimos ativos públicos ou da criadora" ON public.creator_gift_items;
CREATE POLICY "Mimos ativos públicos ou da criadora"
  ON public.creator_gift_items FOR SELECT TO public
  USING (
    auth.uid() = creator_id OR
    (is_active AND EXISTS (
      SELECT 1 FROM public.creator_gift_settings s
      WHERE s.creator_id = creator_gift_items.creator_id AND s.is_published
    ))
  );
DROP POLICY IF EXISTS "Criadora cria mimos" ON public.creator_gift_items;
CREATE POLICY "Criadora cria mimos"
  ON public.creator_gift_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));
DROP POLICY IF EXISTS "Criadora edita mimos" ON public.creator_gift_items;
CREATE POLICY "Criadora edita mimos"
  ON public.creator_gift_items FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'))
  WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));
DROP POLICY IF EXISTS "Criadora apaga mimos" ON public.creator_gift_items;
CREATE POLICY "Criadora apaga mimos"
  ON public.creator_gift_items FOR DELETE TO authenticated
  USING (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'));

DROP POLICY IF EXISTS "Participantes veem contribuições de mimos" ON public.creator_gift_contributions;
CREATE POLICY "Participantes veem contribuições de mimos"
  ON public.creator_gift_contributions FOR SELECT TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = supporter_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.assert_gift_list_publishable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.is_published, false)) THEN
    PERFORM public.assert_creator_monetization_ready(NEW.creator_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_gift_list_publishable ON public.creator_gift_settings;
CREATE TRIGGER trg_assert_gift_list_publishable
BEFORE INSERT OR UPDATE OF is_published ON public.creator_gift_settings
FOR EACH ROW EXECUTE FUNCTION public.assert_gift_list_publishable();

DROP TRIGGER IF EXISTS trg_gift_settings_updated ON public.creator_gift_settings;
CREATE TRIGGER trg_gift_settings_updated
BEFORE UPDATE ON public.creator_gift_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_gift_items_updated ON public.creator_gift_items;
CREATE TRIGGER trg_gift_items_updated
BEFORE UPDATE ON public.creator_gift_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Liquidação idempotente: uma cobrança gera uma única contribuição e um único incremento.
CREATE OR REPLACE FUNCTION public.fulfill_symbolic_gift(
  _charge_id uuid,
  _item_id uuid,
  _creator_id uuid,
  _supporter_id uuid,
  _amount_cents integer,
  _message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  _item public.creator_gift_items%ROWTYPE;
  _inserted integer := 0;
BEGIN
  SELECT * INTO _item
  FROM public.creator_gift_items
  WHERE id = _item_id
  FOR UPDATE;

  IF NOT FOUND OR _item.creator_id <> _creator_id OR NOT _item.is_active THEN
    RAISE EXCEPTION 'VENYX_GIFT_UNAVAILABLE';
  END IF;
  IF _item.value_cents <> _amount_cents THEN
    RAISE EXCEPTION 'VENYX_GIFT_AMOUNT_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pix_charges c
    WHERE c.id = _charge_id
      AND c.purpose = 'tip'::public.pix_charge_purpose
      AND c.payer_id = _supporter_id
      AND c.payee_id = _creator_id
      AND c.amount_cents = _amount_cents
      AND c.status IN ('processing'::public.pix_charge_status, 'paid'::public.pix_charge_status)
  ) THEN
    RAISE EXCEPTION 'VENYX_GIFT_CHARGE_INVALID';
  END IF;

  INSERT INTO public.creator_gift_contributions (
    item_id, creator_id, supporter_id, pix_charge_id, amount_cents, message
  ) VALUES (
    _item_id, _creator_id, _supporter_id, _charge_id, _amount_cents, NULLIF(btrim(_message), '')
  )
  ON CONFLICT (pix_charge_id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted = 1 THEN
    UPDATE public.creator_gift_items
      SET received_count = received_count + 1,
          received_cents = received_cents + _amount_cents
      WHERE id = _item_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_symbolic_gift(uuid, uuid, uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_symbolic_gift(uuid, uuid, uuid, uuid, integer, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';

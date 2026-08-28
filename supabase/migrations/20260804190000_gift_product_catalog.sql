-- Evolui a Lista de Mimos para um catálogo de produtos configurável.

ALTER TABLE public.creator_gift_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_quantity integer;

ALTER TABLE public.creator_gift_items
  ALTER COLUMN category SET DEFAULT 'custom';

ALTER TABLE public.creator_gift_items
  DROP CONSTRAINT IF EXISTS creator_gift_items_image_url_check,
  DROP CONSTRAINT IF EXISTS creator_gift_items_availability_check,
  DROP CONSTRAINT IF EXISTS creator_gift_items_stock_check;

ALTER TABLE public.creator_gift_items
  ADD CONSTRAINT creator_gift_items_image_url_check
    CHECK (image_url IS NULL OR char_length(image_url) BETWEEN 8 AND 2048),
  ADD CONSTRAINT creator_gift_items_availability_check
    CHECK (availability IN ('available', 'on_request')),
  ADD CONSTRAINT creator_gift_items_stock_check
    CHECK (
      (NOT track_stock AND stock_quantity IS NULL)
      OR (track_stock AND stock_quantity IS NOT NULL AND stock_quantity >= 0)
    );

ALTER TABLE public.creator_gift_settings
  ALTER COLUMN intro SET DEFAULT
    'Escolha um produto da minha lista para tornar minhas próximas ideias realidade.';

UPDATE public.creator_gift_settings
SET intro = 'Escolha um produto da minha lista para tornar minhas próximas ideias realidade.'
WHERE lower(intro) LIKE '%simbólic%';

UPDATE public.creator_gift_items
SET description = replace(description, 'Um mimo simbólico', 'Um produto escolhido')
WHERE description ILIKE '%mimo simbólico%';

DROP POLICY IF EXISTS "Mimos ativos públicos ou da criadora" ON public.creator_gift_items;
CREATE POLICY "Produtos ativos públicos ou da criadora"
  ON public.creator_gift_items FOR SELECT TO public
  USING (
    auth.uid() = creator_id OR
    (
      is_active
      AND (NOT track_stock OR stock_quantity > 0)
      AND EXISTS (
        SELECT 1 FROM public.creator_gift_settings s
        WHERE s.creator_id = creator_gift_items.creator_id AND s.is_published
      )
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gift-products',
  'gift-products',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Imagens de produtos públicas" ON storage.objects;
CREATE POLICY "Imagens de produtos públicas"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'gift-products');

DROP POLICY IF EXISTS "Criadora envia imagens de produtos" ON storage.objects;
CREATE POLICY "Criadora envia imagens de produtos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gift-products'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'creator')
  );

DROP POLICY IF EXISTS "Criadora atualiza imagens de produtos" ON storage.objects;
CREATE POLICY "Criadora atualiza imagens de produtos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gift-products'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'creator')
  )
  WITH CHECK (
    bucket_id = 'gift-products'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'creator')
  );

DROP POLICY IF EXISTS "Criadora remove imagens de produtos" ON storage.objects;
CREATE POLICY "Criadora remove imagens de produtos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gift-products'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'creator')
  );

-- Mantém o nome da função por compatibilidade com cobranças antigas, mas passa
-- a validar preço, ativação e estoque atuais de forma atômica.
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

  IF NOT FOUND
     OR _item.creator_id <> _creator_id
     OR NOT _item.is_active
     OR (_item.track_stock AND COALESCE(_item.stock_quantity, 0) <= 0) THEN
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
        received_cents = received_cents + _amount_cents,
        stock_quantity = CASE
          WHEN track_stock THEN GREATEST(stock_quantity - 1, 0)
          ELSE stock_quantity
        END
    WHERE id = _item_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

NOTIFY pgrst, 'reload schema';

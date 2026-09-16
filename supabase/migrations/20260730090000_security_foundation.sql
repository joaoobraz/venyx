-- =====================================================================
-- Venyx: base de segurança para autenticação, pagamentos e arquivos.
-- =====================================================================

-- Um pagamento pode ser reivindicado por apenas um worker por vez.
ALTER TYPE public.pix_charge_status
  ADD VALUE IF NOT EXISTS 'processing' BEFORE 'paid';

-- Idempotência financeira: repetir um webhook não pode repetir o crédito.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_key
  ON public.transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Uma pessoa pode contribuir mais de uma vez para a mesma meta, mas a mesma
-- cobrança PIX só pode gerar uma contribuição.
ALTER TABLE public.post_goal_contributions
  ADD COLUMN IF NOT EXISTS pix_charge_id uuid
  REFERENCES public.pix_charges(id) ON DELETE RESTRICT;

ALTER TABLE public.post_goal_contributions
  DROP CONSTRAINT IF EXISTS post_goal_contributions_post_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_contributions_pix_charge
  ON public.post_goal_contributions (pix_charge_id)
  WHERE pix_charge_id IS NOT NULL;

-- Usuários não podem criar um segundo perfil nem transformar o próprio perfil
-- em verificado. A criação normal continua sendo feita por handle_new_user.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.protect_profile_trusted_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.user_id := OLD.user_id;
    NEW.is_verified := OLD.is_verified;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_trusted_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_trusted_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_trusted_fields();

-- Uma solicitação KYC criada pelo cliente sempre começa pendente. Apenas o
-- servidor ou um administrador podem preencher campos de revisão.
CREATE OR REPLACE FUNCTION public.protect_kyc_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending'::public.kyc_status;
      NEW.rejection_reason := NULL;
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    ELSE
      NEW.user_id := OLD.user_id;
      NEW.status := OLD.status;
      NEW.rejection_reason := OLD.rejection_reason;
      NEW.reviewed_by := OLD.reviewed_by;
      NEW.reviewed_at := OLD.reviewed_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_kyc_review_fields ON public.kyc_requests;
CREATE TRIGGER trg_protect_kyc_review_fields
BEFORE INSERT OR UPDATE ON public.kyc_requests
FOR EACH ROW
EXECUTE FUNCTION public.protect_kyc_review_fields();

-- Maioridade: assinantes usam a verificação de identidade e criadoras usam o
-- KYC aprovado. Fora do service_role, o parâmetro nunca pode consultar outra
-- pessoa.
CREATE OR REPLACE FUNCTION public.is_age_verified(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.identity_verifications
    WHERE user_id = CASE
      WHEN auth.role() = 'service_role' THEN _user_id
      ELSE auth.uid()
    END
      AND status = 'verified'
  )
  OR EXISTS (
    SELECT 1
    FROM public.kyc_requests
    WHERE user_id = CASE
      WHEN auth.role() = 'service_role' THEN _user_id
      ELSE auth.uid()
    END
      AND status = 'approved'::public.kyc_status
  );
$$;

REVOKE ALL ON FUNCTION public.is_age_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_age_verified(uuid)
  TO anon, authenticated, service_role;

-- Corrige a RPC antiga do feed, que confiava em um viewer_id enviado pelo
-- cliente. O parâmetro é mantido apenas por compatibilidade e nunca é usado
-- para conceder acesso.
CREATE OR REPLACE FUNCTION public.list_feed_posts(
  _creator_id uuid DEFAULT NULL,
  _viewer_id uuid DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  body text,
  visibility public.post_visibility,
  price_cents integer,
  likes_count integer,
  comments_count integer,
  created_at timestamptz,
  has_access boolean,
  media_id uuid,
  media_path text,
  media_mime text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH base AS (
    SELECT p.*
    FROM public.posts p
    WHERE (_creator_id IS NULL OR p.creator_id = _creator_id)
    ORDER BY p.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 30), 1), 50)
  ),
  access_control AS (
    SELECT
      p.*,
      (
        public.is_age_verified(auth.uid())
        AND (
          p.visibility = 'public'::public.post_visibility
          OR auth.uid() = p.creator_id
          OR (
            p.visibility = 'subscribers'::public.post_visibility
            AND EXISTS (
              SELECT 1
              FROM public.subscriptions s
              WHERE s.creator_id = p.creator_id
                AND s.subscriber_id = auth.uid()
                AND s.status = 'active'::public.subscription_status
            )
          )
          OR (
            p.visibility = 'ppv'::public.post_visibility
            AND EXISTS (
              SELECT 1
              FROM public.ppv_unlocks u
              WHERE u.post_id = p.id
                AND u.user_id = auth.uid()
            )
          )
          OR (
            p.visibility = 'goal'::public.post_visibility
            AND (
              EXISTS (
                SELECT 1
                FROM public.post_goals g
                WHERE g.post_id = p.id
                  AND g.is_unlocked
              )
              OR EXISTS (
                SELECT 1
                FROM public.post_goal_contributions c
                WHERE c.post_id = p.id
                  AND c.user_id = auth.uid()
              )
            )
          )
        )
      ) AS has_access
    FROM base p
  ),
  first_media AS (
    SELECT DISTINCT ON (m.post_id)
      m.post_id,
      m.id,
      m.storage_path,
      m.mime_type
    FROM public.post_media m
    ORDER BY m.post_id, m.position ASC
  )
  SELECT
    p.id,
    p.creator_id,
    CASE WHEN p.has_access THEN p.body ELSE NULL END,
    p.visibility,
    p.price_cents,
    p.likes_count,
    p.comments_count,
    p.created_at,
    p.has_access,
    m.id,
    CASE WHEN p.has_access THEN m.storage_path ELSE NULL END,
    m.mime_type
  FROM access_control p
  LEFT JOIN first_media m ON m.post_id = p.id
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_feed_posts(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_feed_posts(uuid, uuid, integer)
  TO authenticated;

-- Wrapper adulto para a RPC de mensagens. A função original continua sendo a
-- implementação interna e perde acesso direto pelo cliente.
CREATE OR REPLACE FUNCTION public.list_thread_messages_verified(_thread_id uuid)
RETURNS TABLE (
  id uuid,
  thread_id uuid,
  sender_id uuid,
  body text,
  media_path text,
  mime_type text,
  ppv_price_cents integer,
  subscribers_only boolean,
  campaign_id uuid,
  created_at timestamptz,
  read_at timestamptz,
  unlocked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_age_verified(auth.uid()) THEN
    RAISE EXCEPTION 'VENYX_ADULT_VERIFICATION_REQUIRED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.list_thread_messages(_thread_id);
END;
$$;

REVOKE ALL ON FUNCTION public.list_thread_messages(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_thread_messages_verified(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_thread_messages_verified(uuid)
  TO authenticated;

-- RLS de chat e stories também exige verificação adulta. Sem isso, chamadas
-- diretas ao Supabase contornariam as telas do aplicativo.
DROP POLICY IF EXISTS "Stories visíveis enquanto não expiram"
  ON public.stories;
CREATE POLICY "Stories visíveis para adultos"
  ON public.stories
  FOR SELECT
  TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND expires_at > pg_catalog.now()
  );

DROP POLICY IF EXISTS "Participantes veem thread"
  ON public.chat_threads;
CREATE POLICY "Participantes adultos veem thread"
  ON public.chat_threads
  FOR SELECT
  TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND auth.uid() IN (user_a, user_b)
  );

DROP POLICY IF EXISTS "Usuário cria thread da qual participa"
  ON public.chat_threads;
CREATE POLICY "Adulto cria thread da qual participa"
  ON public.chat_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_age_verified(auth.uid())
    AND auth.uid() IN (user_a, user_b)
  );

DROP POLICY IF EXISTS "Participantes leem mensagens"
  ON public.chat_messages;
CREATE POLICY "Participantes adultos leem mensagens"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND auth.uid() IN (t.user_a, t.user_b)
    )
  );

DROP POLICY IF EXISTS "Participantes enviam mensagens"
  ON public.chat_messages;
CREATE POLICY "Participantes adultos enviam mensagens"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_age_verified(auth.uid())
    AND auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND auth.uid() IN (t.user_a, t.user_b)
    )
  );

DROP POLICY IF EXISTS "Destinatário marca como lida"
  ON public.chat_messages;
CREATE POLICY "Destinatário adulto marca como lida"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (
    public.is_age_verified(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND auth.uid() IN (t.user_a, t.user_b)
        AND auth.uid() <> sender_id
    )
  )
  WITH CHECK (
    public.is_age_verified(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND auth.uid() IN (t.user_a, t.user_b)
        AND auth.uid() <> sender_id
    )
  );

-- Políticas de storage antigas e permissivas deixavam os arquivos acessíveis
-- mesmo com os buckets privados.
DROP POLICY IF EXISTS "Mídia de posts pública" ON storage.objects;
DROP POLICY IF EXISTS "Posts media public read" ON storage.objects;
DROP POLICY IF EXISTS "Posts public read" ON storage.objects;
DROP POLICY IF EXISTS "Posts media: paywall" ON storage.objects;
CREATE POLICY "Posts media: paywall adulto"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'posts'
    AND public.is_age_verified(auth.uid())
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.can_view_post(
        public.storage_path_to_post_id(name),
        auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Stories público lê" ON storage.objects;
DROP POLICY IF EXISTS "Stories media: paywall" ON storage.objects;
CREATE POLICY "Stories media: paywall adulto"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'stories'
    AND public.is_age_verified(auth.uid())
    AND public.can_view_story_path(name, auth.uid())
  );

DROP POLICY IF EXISTS "Sender lê seu chat media" ON storage.objects;
DROP POLICY IF EXISTS "chat media: participants can read" ON storage.objects;

DROP POLICY IF EXISTS "Usuário envia chat media" ON storage.objects;
DROP POLICY IF EXISTS "chat media: participants can upload" ON storage.objects;
CREATE POLICY "Participante adulto envia chat media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND public.is_age_verified(auth.uid())
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id::text = (storage.foldername(name))[2]
        AND auth.uid() IN (t.user_a, t.user_b)
    )
  );

DROP POLICY IF EXISTS "Criadora envia mídia" ON storage.objects;
DROP POLICY IF EXISTS "Posts: criadora envia" ON storage.objects;
CREATE POLICY "Criadora adulta envia mídia"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'posts'
    AND public.is_age_verified(auth.uid())
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  );

DROP POLICY IF EXISTS "Criadora envia story" ON storage.objects;
DROP POLICY IF EXISTS "Stories: criadora envia" ON storage.objects;
CREATE POLICY "Criadora adulta envia story"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'stories'
    AND public.is_age_verified(auth.uid())
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_role(auth.uid(), 'creator'::public.app_role)
  );

-- Registros que concedem saldo ou acesso pago são escritos somente pelo
-- backend, depois da confirmação do gateway.
DROP POLICY IF EXISTS "Criadora cria seu saque"
  ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Criadora cancela seu saque"
  ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admin atualiza saques"
  ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admin atualiza settings"
  ON public.platform_settings;
DROP POLICY IF EXISTS "Admin grava decisões"
  ON public.moderation_decisions;
DROP POLICY IF EXISTS "Admin atualiza decisões"
  ON public.moderation_decisions;
DROP POLICY IF EXISTS "Usuário registra seu resgate"
  ON public.coupon_redemptions;
DROP POLICY IF EXISTS "Usuario registra seu resgate"
  ON public.coupon_redemptions;

REVOKE INSERT ON public.withdrawal_requests FROM authenticated;
REVOKE UPDATE ON public.withdrawal_requests FROM authenticated;
REVOKE UPDATE ON public.platform_settings FROM authenticated;
REVOKE INSERT, UPDATE ON public.moderation_decisions FROM authenticated;
REVOKE INSERT ON public.coupon_redemptions FROM authenticated;
DROP POLICY IF EXISTS "Criadora cria sua chave"
  ON public.creator_payout_keys;
DROP POLICY IF EXISTS "Criadora atualiza sua chave"
  ON public.creator_payout_keys;
REVOKE INSERT, UPDATE ON public.creator_payout_keys FROM authenticated;

-- Pontos só podem ser creditados por triggers do banco. A função antiga
-- aceitava um valor arbitrário de qualquer usuário autenticado.
REVOKE ALL ON FUNCTION public.award_loyalty_points(
  uuid, uuid, integer, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(
  uuid, uuid, integer, text, uuid
) TO service_role;

-- Corrige os nomes das finalidades usados pelo trigger antigo e evita pontuar
-- PPV duas vezes (o desbloqueio já possui trigger próprio).
CREATE OR REPLACE FUNCTION public.trg_pix_paid_award_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'paid'::public.pix_charge_status
     AND OLD.status IS DISTINCT FROM 'paid'::public.pix_charge_status
     AND NEW.purpose IN (
       'subscription'::public.pix_charge_purpose,
       'tip'::public.pix_charge_purpose,
       'goal'::public.pix_charge_purpose
     ) THEN
    PERFORM public.award_loyalty_points(
      NEW.payer_id,
      NEW.payee_id,
      NEW.amount_cents / 100,
      'pix_' || NEW.purpose::text,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_affiliate_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _ref public.affiliate_referrals%ROWTYPE;
  _commission_pct integer;
  _commission_cents integer;
BEGIN
  IF NEW.type <> 'subscription'::public.tx_type
     OR NEW.status <> 'paid'::public.tx_status
     OR NEW.amount_cents <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO _ref
  FROM public.affiliate_referrals
  WHERE referred_user_id = NEW.payer_id
    AND converted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT commission_pct
  INTO _commission_pct
  FROM public.affiliate_codes
  WHERE user_id = _ref.ambassador_id;

  _commission_pct := COALESCE(_commission_pct, 10);
  _commission_cents := NEW.amount_cents * _commission_pct / 100;

  UPDATE public.affiliate_referrals
  SET
    converted_at = pg_catalog.now(),
    commission_cents = _commission_cents
  WHERE id = _ref.id;

  INSERT INTO public.transactions (
    payer_id,
    payee_id,
    type,
    status,
    amount_cents,
    reference_id,
    gateway,
    metadata
  )
  VALUES (
    NULL,
    _ref.ambassador_id,
    'affiliate_commission'::public.tx_type,
    'paid'::public.tx_status,
    _commission_cents,
    NEW.id,
    'internal',
    pg_catalog.jsonb_build_object(
      'referral_id', _ref.id,
      'subscription_tx', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

-- O trigger antigo barrava até o backend service_role. Mantemos a defesa para
-- clientes e liberamos explicitamente as atualizações do servidor.
CREATE OR REPLACE FUNCTION public.protect_withdrawal_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.creator_id
     AND OLD.status = 'pending'::public.withdrawal_status
     AND NEW.status = 'canceled'::public.withdrawal_status
     AND NEW.amount_cents IS NOT DISTINCT FROM OLD.amount_cents
     AND NEW.pix_key IS NOT DISTINCT FROM OLD.pix_key
     AND NEW.pix_key_type IS NOT DISTINCT FROM OLD.pix_key_type
     AND NEW.holder_name IS NOT DISTINCT FROM OLD.holder_name
     AND NEW.holder_document IS NOT DISTINCT FROM OLD.holder_document
     AND NEW.creator_id IS NOT DISTINCT FROM OLD.creator_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'VENYX_WITHDRAWAL_UPDATE_FORBIDDEN'
    USING ERRCODE = 'P0001';
END;
$$;

-- Criação de saque serializada por criadora. O saldo, o KYC e a chave PIX são
-- validados e o pedido é criado na mesma transação.
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  _creator_id uuid,
  _amount_cents integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _payout_key public.creator_payout_keys%ROWTYPE;
  _min_withdrawal_cents integer;
  _available_cents bigint := 0;
  _withdrawal_id uuid;
BEGIN
  IF _creator_id IS NULL
     OR NOT public.has_role(_creator_id, 'creator'::public.app_role) THEN
    RAISE EXCEPTION 'VENYX_NOT_CREATOR' USING ERRCODE = 'P0001';
  END IF;

  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'VENYX_INVALID_AMOUNT' USING ERRCODE = 'P0001';
  END IF;

  -- Bloqueia pedidos paralelos para o mesmo saldo.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_creator_id::text, 8675309)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.kyc_requests
    WHERE user_id = _creator_id
      AND status = 'approved'::public.kyc_status
  ) THEN
    RAISE EXCEPTION 'VENYX_KYC_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT min_withdrawal_cents
  INTO _min_withdrawal_cents
  FROM public.platform_settings
  WHERE id = 1;

  IF _amount_cents < COALESCE(_min_withdrawal_cents, 3000) THEN
    RAISE EXCEPTION 'VENYX_MIN_WITHDRAWAL' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO _payout_key
  FROM public.creator_payout_keys
  WHERE user_id = _creator_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENYX_PIX_KEY_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(available_cents, 0)
  INTO _available_cents
  FROM public.creator_balances
  WHERE creator_id = _creator_id;

  IF _amount_cents > COALESCE(_available_cents, 0) THEN
    RAISE EXCEPTION 'VENYX_INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.withdrawal_requests (
    creator_id,
    amount_cents,
    pix_key,
    pix_key_type,
    holder_name,
    holder_document,
    status
  )
  VALUES (
    _creator_id,
    _amount_cents,
    _payout_key.pix_key,
    _payout_key.pix_key_type,
    _payout_key.holder_name,
    _payout_key.holder_document,
    'pending'::public.withdrawal_status
  )
  RETURNING id INTO _withdrawal_id;

  RETURN _withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal_request(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(uuid, integer)
  TO service_role;

-- Renovação de assinatura e lançamento financeiro acontecem na mesma
-- transação. Assim, uma reentrega do webhook nunca adiciona meses duas vezes.
CREATE OR REPLACE FUNCTION public.fulfill_subscription_payment(
  _charge_id uuid,
  _subscriber_id uuid,
  _creator_id uuid,
  _amount_cents integer,
  _months integer,
  _is_trial boolean,
  _trial_days integer,
  _gateway_ref text,
  _coupon_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _subscription_id uuid;
  _current_period_end timestamptz;
  _base_date timestamptz;
  _new_period_end timestamptz;
  _idempotency_key text := _charge_id::text || ':subscription';
  _redemption_inserted integer := 0;
BEGIN
  IF _charge_id IS NULL
     OR _subscriber_id IS NULL
     OR _creator_id IS NULL
     OR _amount_cents IS NULL
     OR _amount_cents < 0
     OR _months IS NULL
     OR _months NOT BETWEEN 1 AND 24
     OR _is_trial IS NULL
     OR _trial_days IS NULL
     OR _trial_days NOT BETWEEN 0 AND 30 THEN
    RAISE EXCEPTION 'VENYX_INVALID_SUBSCRIPTION_PAYMENT'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _subscriber_id::text || ':' || _creator_id::text,
      5150
    )
  );

  SELECT reference_id
  INTO _subscription_id
  FROM public.transactions
  WHERE idempotency_key = _idempotency_key;

  IF FOUND THEN
    RETURN _subscription_id;
  END IF;

  SELECT id, current_period_end
  INTO _subscription_id, _current_period_end
  FROM public.subscriptions
  WHERE subscriber_id = _subscriber_id
    AND creator_id = _creator_id
  FOR UPDATE;

  _base_date := CASE
    WHEN _current_period_end IS NOT NULL
      AND _current_period_end > pg_catalog.now()
    THEN _current_period_end
    ELSE pg_catalog.now()
  END;

  IF _is_trial AND _trial_days > 0 THEN
    _new_period_end := _base_date + pg_catalog.make_interval(days => _trial_days);
  ELSE
    _new_period_end := _base_date + pg_catalog.make_interval(months => _months);
  END IF;

  IF FOUND THEN
    UPDATE public.subscriptions
    SET
      price_cents = pg_catalog.round(_amount_cents::numeric / _months)::integer,
      status = 'active'::public.subscription_status,
      current_period_start = pg_catalog.now(),
      current_period_end = _new_period_end,
      is_trial = _is_trial,
      months = _months
    WHERE id = _subscription_id;
  ELSE
    INSERT INTO public.subscriptions (
      subscriber_id,
      creator_id,
      price_cents,
      status,
      current_period_start,
      current_period_end,
      is_trial,
      months
    )
    VALUES (
      _subscriber_id,
      _creator_id,
      pg_catalog.round(_amount_cents::numeric / _months)::integer,
      'active'::public.subscription_status,
      pg_catalog.now(),
      _new_period_end,
      _is_trial,
      _months
    )
    RETURNING id INTO _subscription_id;
  END IF;

  INSERT INTO public.transactions (
    payer_id,
    payee_id,
    type,
    status,
    amount_cents,
    reference_id,
    gateway,
    gateway_ref,
    idempotency_key,
    metadata
  )
  VALUES (
    _subscriber_id,
    _creator_id,
    'subscription'::public.tx_type,
    'paid'::public.tx_status,
    _amount_cents,
    _subscription_id,
    'impulsepay',
    _gateway_ref,
    _idempotency_key,
    pg_catalog.jsonb_build_object(
      'charge_id', _charge_id,
      'months', _months,
      'coupon', _coupon_id
    )
  );

  IF _coupon_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.subscription_coupons
    WHERE id = _coupon_id
      AND creator_id = _creator_id
  ) THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id)
    VALUES (_coupon_id, _subscriber_id)
    ON CONFLICT (coupon_id, user_id) DO NOTHING;

    GET DIAGNOSTICS _redemption_inserted = ROW_COUNT;
    IF _redemption_inserted = 1 THEN
      UPDATE public.subscription_coupons
      SET uses_count = uses_count + 1
      WHERE id = _coupon_id
        AND creator_id = _creator_id;
    END IF;
  END IF;

  RETURN _subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_subscription_payment(
  uuid, uuid, uuid, integer, integer, boolean, integer, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_subscription_payment(
  uuid, uuid, uuid, integer, integer, boolean, integer, text, uuid
) TO service_role;

-- Trial originado por cupom: consumo do cupom e ativação da assinatura são
-- atômicos, inclusive sob cliques simultâneos.
CREATE OR REPLACE FUNCTION public.activate_coupon_trial(
  _creator_id uuid,
  _subscriber_id uuid,
  _coupon_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _coupon public.subscription_coupons%ROWTYPE;
  _subscription_id uuid;
  _period_end timestamptz;
BEGIN
  IF _creator_id IS NULL OR _subscriber_id IS NULL OR _coupon_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('error', 'invalid_coupon');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _subscriber_id::text || ':' || _creator_id::text,
      6161
    )
  );

  SELECT *
  INTO _coupon
  FROM public.subscription_coupons
  WHERE id = _coupon_id
    AND creator_id = _creator_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT _coupon.is_active
     OR _coupon.trial_days IS NULL
     OR (_coupon.max_uses <> 0 AND _coupon.uses_count >= _coupon.max_uses) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'invalid_coupon');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.coupon_redemptions
    WHERE coupon_id = _coupon_id
      AND user_id = _subscriber_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'coupon_already_used');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE subscriber_id = _subscriber_id
      AND creator_id = _creator_id
      AND status = 'active'::public.subscription_status
  ) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'already_subscribed');
  END IF;

  _period_end := pg_catalog.now()
    + pg_catalog.make_interval(days => _coupon.trial_days);

  INSERT INTO public.subscriptions (
    subscriber_id,
    creator_id,
    price_cents,
    status,
    current_period_start,
    current_period_end,
    is_trial,
    months
  )
  VALUES (
    _subscriber_id,
    _creator_id,
    0,
    'active'::public.subscription_status,
    pg_catalog.now(),
    _period_end,
    true,
    0
  )
  ON CONFLICT (subscriber_id, creator_id) DO UPDATE
  SET
    price_cents = EXCLUDED.price_cents,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    is_trial = EXCLUDED.is_trial,
    months = EXCLUDED.months
  RETURNING id INTO _subscription_id;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id)
  VALUES (_coupon_id, _subscriber_id);

  UPDATE public.subscription_coupons
  SET uses_count = uses_count + 1
  WHERE id = _coupon_id;

  RETURN pg_catalog.jsonb_build_object(
    'subscription_id', _subscription_id,
    'trial_days', _coupon.trial_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_coupon_trial(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_coupon_trial(uuid, uuid, uuid)
  TO service_role;

-- O trial gratuito passa pelo backend, que já confirmou login e maioridade.
-- A função antiga usava auth.uid() e podia ser chamada diretamente pelo cliente.
REVOKE ALL ON FUNCTION public.start_creator_trial(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_creator_trial(
  _creator_id uuid,
  _subscriber_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _trial_enabled boolean;
  _trial_days integer;
  _new_id uuid;
BEGIN
  IF _subscriber_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF _subscriber_id = _creator_id THEN
    RETURN pg_catalog.jsonb_build_object('error', 'cannot_subscribe_self');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _subscriber_id::text || ':' || _creator_id::text,
      4242
    )
  );

  SELECT trial_days_enabled, trial_days
  INTO _trial_enabled, _trial_days
  FROM public.profiles
  WHERE user_id = _creator_id;

  IF NOT COALESCE(_trial_enabled, false) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'trial_not_offered');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscription_trials_used
    WHERE user_id = _subscriber_id
      AND creator_id = _creator_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'trial_already_used');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE subscriber_id = _subscriber_id
      AND creator_id = _creator_id
      AND status = 'active'::public.subscription_status
  ) THEN
    RETURN pg_catalog.jsonb_build_object('error', 'already_subscribed');
  END IF;

  INSERT INTO public.subscriptions (
    subscriber_id,
    creator_id,
    status,
    current_period_start,
    current_period_end,
    is_trial,
    months
  )
  VALUES (
    _subscriber_id,
    _creator_id,
    'active'::public.subscription_status,
    pg_catalog.now(),
    pg_catalog.now() + (_trial_days || ' days')::interval,
    true,
    0
  )
  RETURNING id INTO _new_id;

  INSERT INTO public.subscription_trials_used (user_id, creator_id)
  VALUES (_subscriber_id, _creator_id);

  RETURN pg_catalog.jsonb_build_object(
    'subscription_id', _new_id,
    'trial_days', _trial_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_creator_trial(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_creator_trial(uuid, uuid)
  TO service_role;

-- Limites de tamanho e tipo reduzem abuso de armazenamento.
UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'avatars';

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'covers';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm'
  ]
WHERE id = 'posts';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm'
  ]
WHERE id IN ('stories', 'chat-media');

UPDATE storage.buckets
SET
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
  ]
WHERE id IN ('kyc', 'dmca-evidence');

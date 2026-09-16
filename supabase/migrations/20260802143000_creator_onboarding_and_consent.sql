-- Creator onboarding evidence and database-level monetization gates.

CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type IN (
    'terms',
    'privacy',
    'adult_creator',
    'content_rights'
  )),
  document_version text NOT NULL CHECK (char_length(document_version) BETWEEN 1 AND 64),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent_hash text CHECK (user_agent_hash IS NULL OR char_length(user_agent_hash) = 64),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_type, document_version)
);

CREATE INDEX IF NOT EXISTS user_consents_user_type_idx
  ON public.user_consents(user_id, consent_type, accepted_at DESC);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own consent evidence" ON public.user_consents;
CREATE POLICY "Users read own consent evidence"
  ON public.user_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.user_consents FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_creator_consents(
  _user_id uuid,
  _terms_version text,
  _privacy_version text,
  _creator_policy_version text,
  _ip_address text DEFAULT NULL,
  _user_agent_hash text DEFAULT NULL,
  _source text DEFAULT 'creator_onboarding'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _count integer := 0;
  _type text;
  _version text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'VENYX_SERVICE_ROLE_REQUIRED';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'VENYX_USER_REQUIRED';
  END IF;

  FOREACH _type IN ARRAY ARRAY['terms', 'privacy', 'adult_creator', 'content_rights']
  LOOP
    _version := CASE
      WHEN _type = 'terms' THEN _terms_version
      WHEN _type = 'privacy' THEN _privacy_version
      ELSE _creator_policy_version
    END;

    INSERT INTO public.user_consents(
      user_id,
      consent_type,
      document_version,
      ip_address,
      user_agent_hash,
      evidence
    ) VALUES (
      _user_id,
      _type,
      _version,
      CASE
        WHEN NULLIF(_ip_address, '') IS NULL THEN NULL
        ELSE _ip_address::inet
      END,
      NULLIF(_user_agent_hash, ''),
      jsonb_build_object('source', LEFT(COALESCE(_source, 'creator_onboarding'), 64))
    )
    ON CONFLICT (user_id, consent_type, document_version) DO NOTHING;

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_creator_kyc_with_consent(
  _user_id uuid,
  _document_type text,
  _document_front_url text,
  _document_back_url text,
  _selfie_url text,
  _terms_version text,
  _privacy_version text,
  _creator_policy_version text,
  _ip_address text DEFAULT NULL,
  _user_agent_hash text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _kyc_id uuid;
  _prefix text := _user_id::text || '/';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'VENYX_SERVICE_ROLE_REQUIRED';
  END IF;
  IF _document_type NOT IN ('RG', 'CNH', 'Passport') THEN
    RAISE EXCEPTION 'VENYX_DOCUMENT_TYPE_INVALID';
  END IF;
  IF _document_front_url NOT LIKE _prefix || '%'
     OR _selfie_url NOT LIKE _prefix || '%'
     OR (_document_back_url IS NOT NULL AND _document_back_url NOT LIKE _prefix || '%') THEN
    RAISE EXCEPTION 'VENYX_KYC_PATH_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kyc_requests
     WHERE user_id = _user_id
       AND status IN ('pending'::public.kyc_status, 'approved'::public.kyc_status)
  ) THEN
    RAISE EXCEPTION 'VENYX_KYC_ALREADY_ACTIVE';
  END IF;

  PERFORM public.record_creator_consents(
    _user_id,
    _terms_version,
    _privacy_version,
    _creator_policy_version,
    _ip_address,
    _user_agent_hash,
    'kyc_submission'
  );

  INSERT INTO public.kyc_requests(
    user_id,
    document_type,
    document_front_url,
    document_back_url,
    selfie_url,
    status
  ) VALUES (
    _user_id,
    _document_type,
    _document_front_url,
    _document_back_url,
    _selfie_url,
    'pending'::public.kyc_status
  )
  RETURNING id INTO _kyc_id;

  RETURN _kyc_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.creator_onboarding_status(_user_id uuid)
RETURNS TABLE (
  kyc_approved boolean,
  consent_complete boolean,
  profile_complete boolean,
  price_configured boolean,
  payout_key_configured boolean,
  first_post_created boolean,
  monetization_ready boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH target AS (
    SELECT CASE
      WHEN auth.role() = 'service_role' THEN _user_id
      ELSE auth.uid()
    END AS user_id
  ), checks AS (
    SELECT
      EXISTS (
        SELECT 1 FROM public.kyc_requests k, target t
        WHERE k.user_id = t.user_id AND k.status = 'approved'::public.kyc_status
      ) AS kyc_ok,
      (
        SELECT count(DISTINCT c.consent_type) = 4
        FROM public.user_consents c, target t
        WHERE c.user_id = t.user_id
          AND c.consent_type IN ('terms', 'privacy', 'adult_creator', 'content_rights')
      ) AS consent_ok,
      EXISTS (
        SELECT 1 FROM public.profiles p, target t
        WHERE p.user_id = t.user_id
          AND char_length(trim(COALESCE(p.display_name, ''))) >= 2
          AND char_length(trim(COALESCE(p.bio, ''))) >= 20
          AND char_length(trim(COALESCE(p.avatar_url, ''))) > 0
      ) AS profile_ok,
      EXISTS (
        SELECT 1 FROM public.profiles p, target t
        WHERE p.user_id = t.user_id AND COALESCE(p.subscription_price_cents, 0) >= 100
      ) AS price_ok,
      EXISTS (
        SELECT 1 FROM public.creator_payout_keys pk, target t
        WHERE pk.user_id = t.user_id
          AND char_length(trim(pk.pix_key)) >= 3
          AND char_length(regexp_replace(pk.holder_document, '[^0-9]', '', 'g')) >= 11
      ) AS payout_ok,
      EXISTS (
        SELECT 1 FROM public.posts p, target t WHERE p.creator_id = t.user_id
      ) AS first_post_ok
  )
  SELECT
    kyc_ok,
    consent_ok,
    profile_ok,
    price_ok,
    payout_ok,
    first_post_ok,
    (kyc_ok AND consent_ok AND profile_ok AND payout_ok)
  FROM checks;
$$;

CREATE OR REPLACE FUNCTION public.assert_creator_monetization_ready(_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _status record;
BEGIN
  SELECT * INTO _status FROM public.creator_onboarding_status(_creator_id);
  IF NOT COALESCE(_status.kyc_approved, false) THEN
    RAISE EXCEPTION 'VENYX_KYC_REQUIRED';
  END IF;
  IF NOT COALESCE(_status.consent_complete, false) THEN
    RAISE EXCEPTION 'VENYX_CREATOR_CONSENT_REQUIRED';
  END IF;
  IF NOT COALESCE(_status.profile_complete, false) THEN
    RAISE EXCEPTION 'VENYX_CREATOR_PROFILE_REQUIRED';
  END IF;
  IF NOT COALESCE(_status.payout_key_configured, false) THEN
    RAISE EXCEPTION 'VENYX_PIX_KEY_REQUIRED';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_post_monetization_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.visibility <> 'public'::public.post_visibility THEN
    PERFORM public.assert_creator_monetization_ready(NEW.creator_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_monetization_readiness ON public.posts;
CREATE TRIGGER trg_posts_monetization_readiness
  BEFORE INSERT OR UPDATE OF visibility, price_cents ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_monetization_readiness();

CREATE OR REPLACE FUNCTION public.enforce_story_monetization_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.visibility <> 'public'::public.story_visibility THEN
    PERFORM public.assert_creator_monetization_ready(NEW.creator_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stories_monetization_readiness ON public.stories;
CREATE TRIGGER trg_stories_monetization_readiness
  BEFORE INSERT OR UPDATE OF visibility ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_story_monetization_readiness();

CREATE OR REPLACE FUNCTION public.enforce_chat_monetization_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(NEW.ppv_price_cents, 0) > 0 OR COALESCE(NEW.subscribers_only, false) THEN
    PERFORM public.assert_creator_monetization_ready(NEW.sender_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_monetization_readiness ON public.chat_messages;
CREATE TRIGGER trg_chat_monetization_readiness
  BEFORE INSERT OR UPDATE OF ppv_price_cents, subscribers_only ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_monetization_readiness();

CREATE OR REPLACE FUNCTION public.enforce_upsell_monetization_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(NEW.is_active, false) THEN
    PERFORM public.assert_creator_monetization_ready(NEW.creator_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_upsell_monetization_readiness ON public.upsell_offers;
CREATE TRIGGER trg_upsell_monetization_readiness
  BEFORE INSERT OR UPDATE OF is_active, price_cents ON public.upsell_offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_upsell_monetization_readiness();

CREATE OR REPLACE FUNCTION public.enforce_campaign_monetization_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(NEW.ppv_price_cents, 0) > 0 THEN
    PERFORM public.assert_creator_monetization_ready(NEW.creator_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_monetization_readiness ON public.mass_dm_campaigns;
CREATE TRIGGER trg_campaign_monetization_readiness
  BEFORE INSERT OR UPDATE OF ppv_price_cents ON public.mass_dm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_monetization_readiness();

REVOKE ALL ON FUNCTION public.record_creator_consents(uuid, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_creator_consents(uuid, text, text, text, text, text, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.submit_creator_kyc_with_consent(uuid, text, text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_creator_kyc_with_consent(uuid, text, text, text, text, text, text, text, text, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.creator_onboarding_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creator_onboarding_status(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.assert_creator_monetization_ready(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_creator_monetization_ready(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

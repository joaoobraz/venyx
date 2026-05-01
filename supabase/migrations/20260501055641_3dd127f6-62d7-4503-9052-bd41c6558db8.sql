
-- C1: bucket posts — remover policies redundantes
DROP POLICY IF EXISTS "Posts: criadora upload"            ON storage.objects;
DROP POLICY IF EXISTS "Criadora envia mídia em sua pasta" ON storage.objects;
DROP POLICY IF EXISTS "Posts: criadora delete"            ON storage.objects;
DROP POLICY IF EXISTS "Criadora apaga sua mídia"          ON storage.objects;

CREATE POLICY "Posts: criadora upload (INSERT)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND public.has_role(auth.uid(), 'creator'::app_role)
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Posts: criadora update (UPDATE)"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'posts'
  AND public.has_role(auth.uid(), 'creator'::app_role)
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Posts: criadora delete (DELETE)"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'posts'
  AND public.has_role(auth.uid(), 'creator'::app_role)
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- C2: bucket chat-media — paywall real
DROP POLICY IF EXISTS "chat media: participants can read" ON storage.objects;
DROP POLICY IF EXISTS "Chat: participante lê"             ON storage.objects;
DROP POLICY IF EXISTS "Sender lê seu chat media"          ON storage.objects;

CREATE POLICY "Chat media: paywall (SELECT)"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.chat_messages m
      JOIN public.chat_threads  t ON t.id = m.thread_id
      WHERE m.media_path = storage.objects.name
        AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
        AND (
          m.ppv_price_cents = 0
          OR EXISTS (SELECT 1 FROM public.chat_ppv_unlocks u
                      WHERE u.message_id = m.id AND u.user_id = auth.uid())
        )
        AND (
          NOT m.subscribers_only
          OR EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.status = 'active'
              AND ((s.creator_id = m.sender_id AND s.subscriber_id = auth.uid())
                OR (s.creator_id = auth.uid()  AND s.subscriber_id = m.sender_id))
          )
        )
    )
  )
);

-- C3: handle_new_user sem auto-admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE base_username TEXT; final_username TEXT; suffix INT := 0;
BEGIN
  base_username := lower(regexp_replace(
    coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'));
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'user' || substr(NEW.id::text, 1, 8);
  END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, final_username,
          coalesce(NEW.raw_user_meta_data->>'display_name', final_username));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'subscriber');
  RETURN NEW;
END; $$;

-- A1 parcial
REVOKE SELECT (trial_days, trial_days_enabled) ON public.profiles FROM anon;
GRANT  SELECT (trial_days, trial_days_enabled) ON public.profiles TO authenticated;

-- M3
REVOKE EXECUTE ON FUNCTION public.start_creator_trial(uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(uuid, text)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.mass_dm_campaign_revenue(uuid)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscriptions_expiring_in(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_thread_messages(uuid)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_due_subscriptions()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_stories()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_mass_dm_batch(integer)     FROM anon, authenticated;

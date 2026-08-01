-- User safety controls: report, block and mute across posts, profiles and chat.

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON public.user_blocks (blocked_id, blocker_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own blocks"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

CREATE POLICY "Users create their own blocks"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND blocker_id <> blocked_id);

CREATE POLICY "Users remove their own blocks"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_mutes (
  user_id uuid NOT NULL,
  muted_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, muted_user_id),
  CONSTRAINT user_mutes_no_self CHECK (user_id <> muted_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mutes_muted
  ON public.user_mutes (muted_user_id, user_id);

ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own mutes"
  ON public.user_mutes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create their own mutes"
  ON public.user_mutes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND user_id <> muted_user_id);

CREATE POLICY "Users remove their own mutes"
  ON public.user_mutes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL
    CHECK (target_type IN ('post', 'profile', 'message', 'conversation')),
  target_id uuid NOT NULL,
  reported_user_id uuid,
  reason text NOT NULL
    CHECK (reason IN ('spam', 'harassment', 'impersonation', 'underage', 'illegal', 'other')),
  details text CHECK (char_length(details) <= 2000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

CREATE INDEX IF NOT EXISTS idx_content_reports_queue
  ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter
  ON public.content_reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON public.content_reports (target_type, target_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create their own reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND (reported_user_id IS NULL OR reported_user_id <> auth.uid())
  );

CREATE POLICY "Users read their own reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins update reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.users_are_blocked(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks b
    WHERE (b.blocker_id = _user_a AND b.blocked_id = _user_b)
       OR (b.blocker_id = _user_b AND b.blocked_id = _user_a)
  );
$$;

REVOKE ALL ON FUNCTION public.users_are_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.users_are_blocked(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Usuário cria thread da qual participa" ON public.chat_threads;
CREATE POLICY "Users create unblocked threads"
  ON public.chat_threads FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (user_a, user_b)
    AND NOT public.users_are_blocked(user_a, user_b)
  );

DROP POLICY IF EXISTS "Participantes enviam mensagens" ON public.chat_messages;
CREATE POLICY "Unblocked participants send messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = thread_id
        AND auth.uid() IN (t.user_a, t.user_b)
        AND NOT public.users_are_blocked(t.user_a, t.user_b)
    )
  );

REVOKE ALL ON TABLE public.user_blocks FROM anon;
REVOKE ALL ON TABLE public.user_mutes FROM anon;
REVOKE ALL ON TABLE public.content_reports FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_blocks TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_mutes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.content_reports TO authenticated;


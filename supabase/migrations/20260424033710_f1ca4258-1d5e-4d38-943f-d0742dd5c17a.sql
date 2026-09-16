-- =========================================
-- 1) Realtime RLS: somente participantes da thread recebem eventos
-- =========================================

-- Garante que a publicação realtime existe para chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;
END $$;

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Realtime internals vary between Supabase platform versions and may not be
-- owned by the migration role. The source table RLS remains authoritative.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    BEGIN
      EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
      EXECUTE 'DROP POLICY IF EXISTS "authenticated can receive realtime" ON realtime.messages';
      EXECUTE 'CREATE POLICY "authenticated can receive realtime" ON realtime.messages FOR SELECT TO authenticated USING (true)';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping realtime.messages policy: platform-managed table';
    END;
  END IF;
END
$$;

-- =========================================
-- 2) Storage: chat-media — destinatário também pode baixar
-- =========================================
-- Convenção: arquivos do chat são salvos em <thread_id>/...
-- Liberamos SELECT para qualquer participante (user_a/user_b) da thread.

DROP POLICY IF EXISTS "chat media: participants can read" ON storage.objects;
CREATE POLICY "chat media: participants can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
  )
);

DROP POLICY IF EXISTS "chat media: participants can upload" ON storage.objects;
CREATE POLICY "chat media: participants can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
  )
);

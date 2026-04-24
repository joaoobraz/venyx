
DROP POLICY IF EXISTS "Avatars visíveis a autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Covers visíveis a autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Stories público lê" ON storage.objects;

-- avatars/covers: leitura por path (sem listagem) — buckets públicos por URL direta
-- Como não há SELECT policy ampla, listagem fica bloqueada. URLs diretas funcionam pois bucket está public=true.

-- stories: bucket privado. Acesso via URL assinada gerada pelo servidor (getStoryMediaUrl).
-- Owner ainda lê seu próprio path para tooling/preview:
CREATE POLICY "Stories: owner lê próprio arquivo"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'stories'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

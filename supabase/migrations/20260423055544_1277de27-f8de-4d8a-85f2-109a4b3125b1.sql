DROP POLICY IF EXISTS "Avatars públicos" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Covers públicas" ON storage.objects;
DROP POLICY IF EXISTS "Covers are publicly accessible" ON storage.objects;

CREATE POLICY "Avatars visíveis a autenticados"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Covers visíveis a autenticados"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'covers');

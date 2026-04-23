-- Restringe SELECT público no bucket 'posts' (URLs diretas continuam servindo via CDN)
DROP POLICY IF EXISTS "Mídia de posts pública" ON storage.objects;

CREATE POLICY "Mídia de posts visível a autenticados"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'posts');
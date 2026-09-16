-- Remove broad SELECT and replace with no-list (still public via signed/direct URLs)
-- Public buckets serve files via direct URL; we just block listing operations.
DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Covers publicly readable" ON storage.objects;

-- Re-create as restricted: anon/auth can SELECT individual objects only when
-- name is provided (Supabase storage public URLs work without listing).
-- Practical fix: keep buckets public=true (URL works) but no SELECT policy needed
-- because public buckets bypass RLS for direct file fetches.
-- We add SELECT only for owners so they can list their own files.
CREATE POLICY "Owners list own avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners list own covers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

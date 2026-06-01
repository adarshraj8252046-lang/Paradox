BEGIN;
DROP POLICY IF EXISTS "Agents view docs for assigned apps" ON storage.objects;
CREATE POLICY "Agents view docs for assigned apps"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-docs'
    AND (auth.jwt()->'app_metadata'->>'role') = 'agent'
  );
COMMIT;
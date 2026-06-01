-- Allow agents to read files in the application-docs bucket
-- if they are assigned to the corresponding application
DROP POLICY IF EXISTS "Agents view docs for assigned apps" ON storage.objects;
CREATE POLICY "Agents view docs for assigned apps"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-docs'
    AND EXISTS (
      SELECT 1 FROM public.application_documents ad
      WHERE ad.file_path = storage.objects.name
    )
  );

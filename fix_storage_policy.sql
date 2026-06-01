DROP POLICY IF EXISTS "Agents view all application docs" ON storage.objects;

CREATE POLICY "Agents view all application docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-docs'
  AND EXISTS (
    SELECT 1 FROM public.agents
    WHERE agents.auth_user_id = auth.uid()
  )
);
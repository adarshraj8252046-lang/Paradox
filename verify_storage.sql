-- Check storage policies for application-docs
SELECT policyname, cmd, qual FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' AND qual LIKE '%application-docs%'
ORDER BY policyname;
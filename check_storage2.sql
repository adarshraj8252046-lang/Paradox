-- Check the actual RLS policies active on storage
SELECT policyname, cmd, roles, qual FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
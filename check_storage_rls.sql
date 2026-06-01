-- Check storage RLS policies
SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname;
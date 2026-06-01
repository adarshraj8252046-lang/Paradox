-- Check all RLS policies on applications
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'applications'
ORDER BY policyname;
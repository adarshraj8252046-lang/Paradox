-- Check agents RLS policies 
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'agents' ORDER BY policyname;
-- Fix 1: Reassign the test application to Indranil's agent ID
UPDATE public.applications
SET assigned_agent_id = '3bdaea5a-9d4c-4ccc-bf8d-fee81b942a33',
    status = 'Under Review'
WHERE id = 'aff3273e-a4f5-40de-9711-3ff43cf26f4a';

-- Fix 2: Drop all conflicting storage SELECT policies and replace with clean ones
DROP POLICY IF EXISTS "Users view own files" ON storage.objects;
DROP POLICY IF EXISTS "Agents view docs for assigned apps" ON storage.objects;

-- Citizens can view their OWN files (folder starts with their user_id)
CREATE POLICY "Citizens view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-docs'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Agents can view ALL files in application-docs bucket
CREATE POLICY "Agents view all application docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-docs'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'agent'
  );

-- Fix 3: Clean up the applications RLS - the current "Agents read assigned applications"
-- policy allows NULL assigned_agent_id which is good for the pending pool.
-- But we need to make sure agents can also read their OWN assigned apps.
-- The current policy is already correct - NULL or matching agent_id.
-- Let's verify by ensuring the SELECT policy covers both pending and assigned.
DROP POLICY IF EXISTS "Agents read assigned applications" ON public.applications;

CREATE POLICY "Agents read applications"
  ON public.applications FOR SELECT
  TO authenticated
  USING (
    -- Must be an agent
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'agent'
    AND (
      -- Either unassigned (pending pool)
      assigned_agent_id IS NULL
      OR
      -- Or assigned to this agent
      (assigned_agent_id)::text = (auth.jwt() -> 'app_metadata' ->> 'agent_id')
    )
  );

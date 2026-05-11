-- ============================================================================
-- Agent Registration Migration
-- ============================================================================
-- Adds fields to public.agents and creates the agent-documents bucket.
-- ============================================================================

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS qualification TEXT,
  ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivation TEXT,
  ADD COLUMN IF NOT EXISTS id_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Create storage bucket for agent ID proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('agent-documents', 'agent-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for the agent-documents bucket
-- Note: storage.objects already has RLS enabled by default in Supabase.

-- 1. Admins can do everything with agent documents
--    (Assuming role is admin via JWT app_metadata)
DROP POLICY IF EXISTS "Admins can manage agent documents" ON storage.objects;
CREATE POLICY "Admins can manage agent documents" 
  ON storage.objects FOR ALL 
  TO authenticated
  USING (
    bucket_id = 'agent-documents' AND 
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- 2. Service role can do everything (for our Edge Function)
-- No policy needed explicitly for service_role, it bypasses RLS by default.

-- 3. Agents can read their own documents
DROP POLICY IF EXISTS "Agents can view their own documents" ON storage.objects;
CREATE POLICY "Agents can view their own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'agent-documents' AND
    (
      -- Agent's folder is usually their ID or email. Let's assume the path is 'agent_id/filename'
      -- Or we just check if they are the owner of the object
      owner = auth.uid()
    )
  );

-- 4. Agents can upload their own documents
DROP POLICY IF EXISTS "Agents can upload their own documents" ON storage.objects;
CREATE POLICY "Agents can upload their own documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agent-documents' AND
    owner = auth.uid()
  );

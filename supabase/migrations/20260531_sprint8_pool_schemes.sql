-- ============================================================================
-- WelfareConnect Migration — Sprint 8
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. APPLICATIONS — add missing columns + expand status check constraint
-- ────────────────────────────────────────────────────────────────────────────

-- Add agent_note if missing (referenced in code already)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS agent_note TEXT;

-- Add status_updated_at if missing (referenced in code already)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- Add cancelled_reason (agent's explanation shown to the customer)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Expand the status check constraint to include 'Cancelled' and other
-- statuses used by the frontend.
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN (
    'Draft',
    'Submitted',
    'Under Review',
    'Documents Required',
    'Submitted to Govt Portal',
    'Approved',
    'Rejected',
    'Cancelled'
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. APPLICATION_STATUS_AUDIT — create if it doesn't exist
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.application_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.application_status_audit ENABLE ROW LEVEL SECURITY;

-- Citizens can read their own application's audit log
DROP POLICY IF EXISTS "Citizens read own audit" ON public.application_status_audit;
CREATE POLICY "Citizens read own audit"
  ON public.application_status_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

-- Agents can read audit for assigned applications
DROP POLICY IF EXISTS "Agents read audit for assigned apps" ON public.application_status_audit;
CREATE POLICY "Agents read audit for assigned apps"
  ON public.application_status_audit FOR SELECT
  USING (agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

-- Agents can insert audit rows for assigned applications
DROP POLICY IF EXISTS "Agents insert audit rows" ON public.application_status_audit;
CREATE POLICY "Agents insert audit rows"
  ON public.application_status_audit FOR INSERT
  WITH CHECK (agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

CREATE INDEX IF NOT EXISTS idx_audit_application
  ON public.application_status_audit(application_id, changed_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RLS — Allow ALL agents to see unassigned (pending pool) applications
-- ────────────────────────────────────────────────────────────────────────────

-- Agents can now see applications where assigned_agent_id IS NULL (pool)
-- AND applications where they are the assigned agent.
DROP POLICY IF EXISTS "Agents read assigned applications" ON public.applications;
CREATE POLICY "Agents read assigned applications"
  ON public.applications FOR SELECT
  USING (
    assigned_agent_id IS NULL
    OR assigned_agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id')
  );

-- Agents can claim/update unassigned apps OR update their own assigned apps
DROP POLICY IF EXISTS "Agents update assigned applications" ON public.applications;
CREATE POLICY "Agents update assigned applications"
  ON public.applications FOR UPDATE
  USING (
    assigned_agent_id IS NULL
    OR assigned_agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id')
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 4. NOTIFICATIONS — add columns used by agent notifications
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'citizen',
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL;

-- Allow agents to insert notifications for citizens
DROP POLICY IF EXISTS "Agents insert citizen notifications" ON public.notifications;
CREATE POLICY "Agents insert citizen notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'agent'
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 5. AGENTS — add is_approved column if missing
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. SCHEME DATA — add/update real government scheme names + Annapurna Bhandar
-- ────────────────────────────────────────────────────────────────────────────

-- Update dummy-named schemes to real government scheme names
UPDATE public.schemes
  SET name = 'Pradhan Mantri Jan Arogya Yojana (PM-JAY)',
      description = 'Health coverage of ₹5 lakh per family per year for secondary and tertiary hospitalisation. Covers over 1,900 medical procedures for BPL and low-income families across India.',
      official_portal_url = 'https://pmjay.gov.in'
  WHERE name = 'Swasthya Raksha Yojana';

UPDATE public.schemes
  SET name = 'National Scholarship Portal (NSP) — Merit-cum-Means',
      description = 'Merit-cum-means scholarship for school and college students from economically weaker sections. Covers tuition, books, and educational materials. Applications via the National Scholarship Portal.',
      official_portal_url = 'https://scholarships.gov.in'
  WHERE name = 'Vidyarthi Vikas Scholarship';

UPDATE public.schemes
  SET name = 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
      description = 'Direct income support of ₹6,000 per year to small and marginal farmer families, paid in three equal instalments of ₹2,000 directly to bank accounts via DBT.',
      official_portal_url = 'https://pmkisan.gov.in'
  WHERE name = 'Kisan Sahay';

UPDATE public.schemes
  SET name = 'West Bengal Lakshmir Bhandar Scheme',
      description = 'Monthly financial assistance of ₹500–₹1,000 for women heads of household in West Bengal, with priority for SC/ST families. Promotes economic independence of women.',
      official_portal_url = NULL,
      allowed_states = ARRAY['West Bengal']
  WHERE name = 'Bengal Women Empowerment';

UPDATE public.schemes
  SET name = 'National Disability Pension (NSAP — INDPS)',
      description = 'Monthly pension and assistive-device subsidy for persons with 80%+ disability from BPL households. Part of the National Social Assistance Programme.',
      official_portal_url = 'https://nsap.nic.in'
  WHERE name = 'Aparajita Disability Support';

UPDATE public.schemes
  SET name = 'Pradhan Mantri Kaushal Vikas Yojana 4.0 (PMKVY)',
      description = 'Free vocational training in industry-relevant skills for unemployed youth, with placement assistance and stipend during training. Includes Recognition of Prior Learning (RPL).',
      official_portal_url = 'https://www.pmkvyofficial.org'
  WHERE name = 'Skill India Yuva';

UPDATE public.schemes
  SET name = 'PM Garib Kalyan Ann Yojana (PMGKAY) / NFSA',
      description = 'Free food grains (5 kg rice/wheat per person per month) for National Food Security Act beneficiaries. BPL families receive grains at ₹1–₹3/kg from fair-price shops under state PDS.',
      official_portal_url = 'https://nfsa.gov.in'
  WHERE name = 'Annapurna Food Security';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. ADD ANNAPURNA BHANDAR (West Bengal, launching June 1, 2026)
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.schemes (
  name, category, description, benefit_amount,
  eligibility_criteria, required_documents,
  official_portal_url, allowed_states, target_area, requires_bpl,
  launch_date, ministry, tags, is_verified
)
SELECT
  'Annapurna Bhandar',
  'Food Security',
  'West Bengal state scheme providing subsidised food grains (rice at ₹2/kg, atta at ₹2/kg, and dal at ₹2/kg) for ration-card holders. Eligible families receive up to 5 kg grains per person per month from designated Annapurna Bhandar outlets. Launching across the state from June 1, 2026.',
  'Rice & atta at ₹2/kg · Dal at ₹2/kg',
  '{"min_age":0,"max_age":120,"max_income":150000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb,
  ARRAY['Ration Card','Aadhar Card','Address Proof'],
  NULL,                    -- No official portal URL yet (state-level announcement)
  ARRAY['West Bengal'],
  'Any',
  false,
  '2026-06-01'::date,
  'West Bengal Food & Supplies Department',
  ARRAY['food','ration','subsidised','west bengal','annapurna','bhandar'],
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.schemes WHERE name = 'Annapurna Bhandar'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. ENABLE REALTIME on applications table
-- (Run this to allow the frontend Realtime subscription to work)
-- ────────────────────────────────────────────────────────────────────────────
-- Go to Supabase Dashboard → Database → Replication → Enable for 'applications'
-- OR uncomment and run the line below if using supabase_realtime publication:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;

-- ────────────────────────────────────────────────────────────────────────────
-- Verification queries (optional — run to confirm changes)
-- ────────────────────────────────────────────────────────────────────────────
-- SELECT name, official_portal_url, allowed_states FROM public.schemes ORDER BY name;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'applications';
-- SELECT name FROM public.schemes WHERE name LIKE '%Annapurna%';

-- ============================================================================
-- COMBINED PENDING MIGRATIONS — WelfareConnect
-- Run ALL of this in Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (all ops are idempotent)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- MIGRATION 1: Fix profiles foreign key on applications table
-- File: 20260531_fix_profiles_fkey.sql
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_user_id_fkey;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- MIGRATION 2: Sprint 8 — Pool, Schemes, RLS, Notifications, Audit
-- File: 20260531_sprint8_pool_schemes.sql
-- ────────────────────────────────────────────────────────────────────────────

-- 1. APPLICATIONS — add missing columns + expand status check constraint
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS agent_note TEXT;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

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

-- 2. APPLICATION_STATUS_AUDIT — create if it doesn't exist
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

DROP POLICY IF EXISTS "Citizens read own audit" ON public.application_status_audit;
CREATE POLICY "Citizens read own audit"
  ON public.application_status_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Agents read audit for assigned apps" ON public.application_status_audit;
CREATE POLICY "Agents read audit for assigned apps"
  ON public.application_status_audit FOR SELECT
  USING (agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

DROP POLICY IF EXISTS "Agents insert audit rows" ON public.application_status_audit;
CREATE POLICY "Agents insert audit rows"
  ON public.application_status_audit FOR INSERT
  WITH CHECK (agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id'));

CREATE INDEX IF NOT EXISTS idx_audit_application
  ON public.application_status_audit(application_id, changed_at DESC);

-- 3. RLS — Allow ALL agents to see unassigned (pending pool) applications
DROP POLICY IF EXISTS "Agents read assigned applications" ON public.applications;
CREATE POLICY "Agents read assigned applications"
  ON public.applications FOR SELECT
  USING (
    assigned_agent_id IS NULL
    OR assigned_agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id')
  );

DROP POLICY IF EXISTS "Agents update assigned applications" ON public.applications;
CREATE POLICY "Agents update assigned applications"
  ON public.applications FOR UPDATE
  USING (
    assigned_agent_id IS NULL
    OR assigned_agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id')
  );

-- 4. NOTIFICATIONS — add columns used by agent notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'citizen',
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Agents insert citizen notifications" ON public.notifications;
CREATE POLICY "Agents insert citizen notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'agent'
  );

-- 5. AGENTS — add is_approved column if missing
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true;

-- 6. SCHEME DATA — update scheme names to real government schemes
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

-- 7. ADD ANNAPURNA BHANDAR (if not already exists)
INSERT INTO public.schemes (
  name, category, description, benefit_amount,
  eligibility_criteria, required_documents,
  official_portal_url, allowed_states, target_area, requires_bpl,
  launch_date, ministry, tags, is_verified
)
SELECT
  'Annapurna Bhandar',
  'Food Security',
  'West Bengal state scheme providing subsidised food grains (rice at ₹2/kg, atta at ₹2/kg, and dal at ₹2/kg) for ration-card holders.',
  'Rice & atta at ₹2/kg · Dal at ₹2/kg',
  '{"min_age":0,"max_age":120,"max_income":150000,"categories":["General","OBC","SC","ST"],"occupations":[],"disability_required":false}'::jsonb,
  ARRAY['Ration Card','Aadhar Card','Address Proof'],
  NULL,
  ARRAY['West Bengal'],
  'Any',
  false,
  '2026-06-01'::date,
  'West Bengal Food & Supplies Department',
  ARRAY['food','ration','subsidised','west bengal','annapurna','bhandar'],
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.schemes WHERE name IN ('Annapurna Bhandar', 'Annapurna Yojana Scheme')
);

-- ────────────────────────────────────────────────────────────────────────────
-- MIGRATION 3: Sprint 9 — Rename Annapurna Bhandar → Annapurna Yojana Scheme
-- File: 20260531_sprint9_annapurna_yojana.sql
-- ────────────────────────────────────────────────────────────────────────────

UPDATE public.schemes
SET
  name = 'Annapurna Yojana Scheme',
  description = 'Comprehensive family-level social protection scheme by the Government of West Bengal requiring detailed family data collection including demographics, assets, occupation, education, and bank details for Direct Benefit Transfer (DBT).',
  category = 'Food Security & Social Welfare',
  benefit_amount = 'DBT Cash Transfers & Food Subsidies',
  required_documents = ARRAY[
    'Aadhaar Card (of Head of Family & all members)',
    'Digital Ration Card (AAY, PHH, SPHH, RKSY1/2)',
    'EPIC (Voter ID) with AC & Part No. (for all adults)',
    'Bank Account Details (Account No. & IFSC for DBT)',
    'Caste/EWS/Creamy Layer Certificate (if applicable)',
    'PAN Card (if available)',
    'Land/Vehicle Registration Records (if applicable)',
    'Pension Slip / Disability Certificate (if applicable)'
  ],
  ministry = 'Government of West Bengal',
  tags = ARRAY['food','ration','dbt','west bengal','annapurna','yojana']
WHERE name = 'Annapurna Bhandar';

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFICATION (review the results after running)
-- ────────────────────────────────────────────────────────────────────────────
-- Check RLS policies exist on applications:
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'applications' ORDER BY policyname;

-- Check columns exist on applications:
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'applications'
ORDER BY column_name;

-- Check scheme names:
SELECT name, category FROM public.schemes ORDER BY name;

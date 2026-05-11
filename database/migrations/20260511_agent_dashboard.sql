-- ============================================================================
-- Agent Dashboard Migration
-- WelfareConnect — Sprint 7
-- ============================================================================
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- ============================================================================

-- 1. Audit log for application status changes
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_status_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status      TEXT NOT NULL,
  note            TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.application_status_audit ENABLE ROW LEVEL SECURITY;

-- Citizens can read the audit trail for their own applications
DROP POLICY IF EXISTS "Citizens read own audit log" ON public.application_status_audit;
CREATE POLICY "Citizens read own audit log"
  ON public.application_status_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id
        AND a.user_id = auth.uid()
    )
  );

-- Agents can insert audit rows for their assigned applications
DROP POLICY IF EXISTS "Agents insert audit" ON public.application_status_audit;
CREATE POLICY "Agents insert audit"
  ON public.application_status_audit FOR INSERT
  WITH CHECK (
    agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id')
  );

-- Agents can read audit rows they created
DROP POLICY IF EXISTS "Agents read audit" ON public.application_status_audit;
CREATE POLICY "Agents read audit"
  ON public.application_status_audit FOR SELECT
  USING (
    agent_id::text = (auth.jwt()->'app_metadata'->>'agent_id')
  );

CREATE INDEX IF NOT EXISTS idx_audit_application
  ON public.application_status_audit(application_id, changed_at DESC);


-- 2. Extend the notifications table for agent-targeted notifications
-- -----------------------------------------------------------------------
-- Add a discriminator column so we can tell citizen vs agent notifications apart.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT 'citizen'
    CHECK (target_role IN ('citizen', 'agent')),
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE;

-- Allow agents to SELECT notifications that are targeted at them
-- (keyed by auth.uid() so each agent only sees their own rows)
DROP POLICY IF EXISTS "Agents read own notifs" ON public.notifications;
CREATE POLICY "Agents read own notifs"
  ON public.notifications FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Allow agents to mark notifications as read
DROP POLICY IF EXISTS "Agents update own notifs" ON public.notifications;
CREATE POLICY "Agents update own notifs"
  ON public.notifications FOR UPDATE
  USING (
    auth.uid() = user_id
  );

-- Allow system (SECURITY DEFINER trigger below) to INSERT agent notifications.
-- The trigger runs as the function owner (service role) so no extra policy needed
-- for INSERT from the trigger. But we DO need the frontend to be able to insert
-- citizen-side notifications when the agent updates a status:
DROP POLICY IF EXISTS "Agents insert citizen notif" ON public.notifications;
CREATE POLICY "Agents insert citizen notif"
  ON public.notifications FOR INSERT
  WITH CHECK (
    -- Agent inserting a notification targeted at a citizen
    (auth.jwt()->'app_metadata'->>'role') = 'agent'
    AND target_role = 'citizen'
  );


-- 3. Postgres trigger: notify all active agents when a new application is submitted
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_agents_on_new_application()
RETURNS TRIGGER AS $$
DECLARE
  v_citizen_name TEXT;
  v_scheme_name  TEXT;
BEGIN
  -- Resolve human-readable names from the new row
  SELECT full_name INTO v_citizen_name
    FROM public.profiles WHERE id = NEW.user_id;

  SELECT name INTO v_scheme_name
    FROM public.schemes WHERE id = NEW.scheme_id;

  -- Insert one notification row per active agent that has a linked auth user
  INSERT INTO public.notifications (user_id, title, body, target_role, application_id)
  SELECT
    a.auth_user_id,
    'New Application: ' || COALESCE(v_scheme_name, 'Unknown Scheme'),
    COALESCE(v_citizen_name, 'A citizen') ||
      ' submitted a new application.' ||
      CASE WHEN NEW.applied_via = 'saathi_plus_annual'
           THEN ' (Saathi Plus ₹999)'
           ELSE ' (Scheme Pack ₹199)'
      END,
    'agent',
    NEW.id
  FROM public.agents a
  WHERE a.auth_user_id IS NOT NULL
    AND a.is_active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach the trigger to applications (fires only on INSERT, i.e. new submissions)
DROP TRIGGER IF EXISTS trg_notify_agents_new_app ON public.applications;
CREATE TRIGGER trg_notify_agents_new_app
  AFTER INSERT ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_agents_on_new_application();


-- 4. Extend applications table: add agent note visible to citizen
-- -----------------------------------------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS agent_note TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- Allow agents to update agent_note and status on assigned applications
-- (policy already exists: "Agents update assigned applications")
-- But extend the status check constraint to include new statuses
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN (
    'Draft', 'Submitted', 'Under Review',
    'Documents Required', 'Submitted to Govt Portal',
    'Approved', 'Rejected'
  ));

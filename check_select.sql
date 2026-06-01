BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "c43db97b-8bf5-4c5d-a468-c6302f419545", "app_metadata": {"role": "agent", "agent_id": "3bdaea5a-9d4c-4ccc-bf8d-fee81b942a33"}}';

SELECT 
  id, user_id, status, consultation_status, consultation_date,
  consultation_time_slot, visit_requested, applied_at, support_expires_at,
  applied_via, message, aadhar, assigned_agent_id, agent_note
FROM public.applications
WHERE id = 'e49c20ee-eeb4-4827-9909-987bbf36a2de';
ROLLBACK;
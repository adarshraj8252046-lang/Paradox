BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "c43db97b-8bf5-4c5d-a468-c6302f419545", "app_metadata": {"role": "agent", "agent_id": "3bdaea5a-9d4c-4ccc-bf8d-fee81b942a33"}}';

UPDATE public.applications
SET assigned_agent_id = '3bdaea5a-9d4c-4ccc-bf8d-fee81b942a33',
    agent_assigned_at = now(),
    status = 'Under Review'
WHERE id = 'e49c20ee-eeb4-4827-9909-987bbf36a2de'
RETURNING id;
ROLLBACK;
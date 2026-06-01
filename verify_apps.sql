-- Check applications state after fix
SELECT id, status, assigned_agent_id FROM public.applications ORDER BY applied_at DESC;
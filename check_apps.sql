-- Check applications with their assigned_agent_id
SELECT id, status, assigned_agent_id, user_id FROM public.applications ORDER BY applied_at DESC LIMIT 10;
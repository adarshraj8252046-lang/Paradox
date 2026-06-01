BEGIN;
SELECT column_name FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'agent_assigned_at';
ROLLBACK;
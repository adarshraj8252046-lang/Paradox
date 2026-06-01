const fs = require('fs');
const { execSync } = require('child_process');

const sql = 
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "c43db97b-8bf5-4c5d-a468-c6302f419545", "app_metadata": {"role": "agent", "agent_id": "3bdaea5a-9d4c-4ccc-bf8d-fee81b942a33"}}';

SELECT a.id, a.assigned_agent_id, p.full_name 
FROM public.applications a 
LEFT JOIN public.profiles p ON p.id = a.user_id 
WHERE a.assigned_agent_id IS NULL
LIMIT 1;

ROLLBACK;
;

fs.writeFileSync('temp.sql', sql, 'utf8');

try {
  const result = execSync('npx supabase db query --linked -f temp.sql', { stdio: 'pipe' });
  console.log(result.toString());
} catch (e) {
  console.error(e.stderr.toString());
}

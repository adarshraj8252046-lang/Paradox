-- Check what's in the application form data for the citizen
SELECT id, user_id, aadhar, message, applied_via 
FROM public.applications 
ORDER BY applied_at DESC;
-- Add applicant_name and applicant_phone to applications table
ALTER TABLE public.applications
ADD COLUMN applicant_name text,
ADD COLUMN applicant_phone text;

-- Populate existing applications with profile data as a fallback
UPDATE public.applications
SET applicant_name = profiles.full_name,
    applicant_phone = profiles.phone
FROM public.profiles
WHERE applications.user_id = profiles.id
  AND applications.applicant_name IS NULL;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_user_id_fkey;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';

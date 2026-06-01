BEGIN;
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger AS 
BEGIN
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
 LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();
COMMIT;
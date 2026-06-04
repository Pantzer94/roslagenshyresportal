
-- Sync auth.users.email to tenants.email when user updates login email
CREATE OR REPLACE FUNCTION public.sync_tenant_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.tenants
       SET email = NEW.email
     WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_email_from_auth();

-- Idempotent self-link: link current auth user to a tenant row by email if not linked yet
CREATE OR REPLACE FUNCTION public.link_self_to_tenant()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  tid uuid;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO tid FROM public.tenants WHERE user_id = uid LIMIT 1;
  IF tid IS NOT NULL THEN RETURN tid; END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  IF uemail IS NULL THEN RETURN NULL; END IF;
  UPDATE public.tenants
     SET user_id = uid
   WHERE user_id IS NULL AND lower(email) = lower(uemail)
   RETURNING id INTO tid;
  RETURN tid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_self_to_tenant() TO authenticated;


-- 1) Replace messages UPDATE policy with a narrow RPC for marking read
DROP POLICY IF EXISTS "Update read_at on accessible messages" ON public.messages;

CREATE OR REPLACE FUNCTION public.mark_messages_read(p_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.messages m
  SET read_at = now()
  WHERE m.id = ANY(p_ids)
    AND m.read_at IS NULL
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = m.tenant_id AND t.user_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid[]) TO authenticated;

-- 2) Lock down user_roles writes — only admins
CREATE POLICY "Admin manage roles - insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin manage roles - update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin manage roles - delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Revoke executable SECURITY DEFINER helpers from anon; restrict where appropriate
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.link_self_to_tenant() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_self_to_tenant() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_tenant_email_from_auth() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

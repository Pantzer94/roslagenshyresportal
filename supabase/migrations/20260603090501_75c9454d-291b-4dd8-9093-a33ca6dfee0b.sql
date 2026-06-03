
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_note text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='rent_invoices_tenant_id_fkey') THEN
    ALTER TABLE public.rent_invoices ADD CONSTRAINT rent_invoices_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='maintenance_tickets_tenant_id_fkey') THEN
    ALTER TABLE public.maintenance_tickets ADD CONSTRAINT maintenance_tickets_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ticket_comments_ticket_id_fkey') THEN
    ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  sender_is_admin boolean NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created ON public.messages (tenant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View messages: admin or own tenant" ON public.messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = messages.tenant_id AND t.user_id = auth.uid()));

CREATE POLICY "Insert message: admin or own tenant, as self" ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_user_id = auth.uid() AND sender_is_admin = public.has_role(auth.uid(), 'admin')
  AND (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = messages.tenant_id AND t.user_id = auth.uid())));

CREATE POLICY "Update read_at on accessible messages" ON public.messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = messages.tenant_id AND t.user_id = auth.uid()));

CREATE POLICY "Admin delete messages" ON public.messages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  description text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON public.documents (tenant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View documents: admin or own tenant" ON public.documents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = documents.tenant_id AND t.user_id = auth.uid()));

CREATE POLICY "Admin insert documents" ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND uploaded_by = auth.uid());

CREATE POLICY "Admin update documents" ON public.documents FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete documents" ON public.documents FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON public.ticket_attachments (ticket_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attachments on accessible tickets" ON public.ticket_attachments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
  SELECT 1 FROM public.maintenance_tickets mt JOIN public.tenants t ON t.id = mt.tenant_id
  WHERE mt.id = ticket_attachments.ticket_id AND t.user_id = auth.uid()));

CREATE POLICY "Insert attachment: admin or ticket owner" ON public.ticket_attachments FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() AND (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.maintenance_tickets mt JOIN public.tenants t ON t.id = mt.tenant_id
    WHERE mt.id = ticket_attachments.ticket_id AND t.user_id = auth.uid())));

CREATE POLICY "Admin delete attachments" ON public.ticket_attachments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE is_first boolean; allowed boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF NOT is_first THEN
    SELECT EXISTS (SELECT 1 FROM public.tenants WHERE lower(email) = lower(NEW.email)) INTO allowed;
    IF NOT allowed THEN
      RAISE EXCEPTION 'Registrering ej tillåten: e-postadressen är inte upplagd av hyresvärden.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tenant');
  END IF;
  UPDATE public.tenants SET user_id = NEW.id
   WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;
  RETURN NEW;
END;
$function$;

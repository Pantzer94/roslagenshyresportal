
-- Areas
CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read areas" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage areas" ON public.areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert/update via Data API
GRANT INSERT, UPDATE, DELETE ON public.areas TO authenticated;

-- Seed
INSERT INTO public.areas (name) VALUES ('Stava'), ('Norrtälje'), ('Lervik');

-- Tenants: address split + area + notify
ALTER TABLE public.tenants
  ADD COLUMN street text,
  ADD COLUMN postal_code text,
  ADD COLUMN city text,
  ADD COLUMN area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  ADD COLUMN notify_email boolean NOT NULL DEFAULT true;

UPDATE public.tenants SET street = address WHERE address IS NOT NULL;

CREATE INDEX idx_tenants_area_id ON public.tenants(area_id);

-- Rent invoices: track email send
ALTER TABLE public.rent_invoices
  ADD COLUMN email_sent_at timestamptz;

-- Maintenance tickets: internal admin notes
ALTER TABLE public.maintenance_tickets
  ADD COLUMN admin_notes text;

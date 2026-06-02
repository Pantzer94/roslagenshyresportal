
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'tenant');
CREATE TYPE public.rent_status AS ENUM ('unpaid', 'paid', 'overdue');
CREATE TYPE public.ticket_status AS ENUM ('new', 'in_progress', 'awaiting_tenant', 'done');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.ticket_category AS ENUM ('damage', 'maintenance', 'report', 'other');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  apartment_number TEXT,
  monthly_rent NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Rent invoices
CREATE TABLE public.rent_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_month DATE NOT NULL, -- first day of month
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status rent_status NOT NULL DEFAULT 'unpaid',
  paid_date DATE,
  payment_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_invoices TO authenticated;
GRANT ALL ON public.rent_invoices TO service_role;
ALTER TABLE public.rent_invoices ENABLE ROW LEVEL SECURITY;

-- Tickets
CREATE TABLE public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category ticket_category NOT NULL DEFAULT 'other',
  priority ticket_priority NOT NULL DEFAULT 'normal',
  description TEXT,
  status ticket_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tickets TO authenticated;
GRANT ALL ON public.maintenance_tickets TO service_role;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

-- Ticket comments
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rent_updated BEFORE UPDATE ON public.rent_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  -- Default role: tenant (admin must be promoted manually)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tenant');
  -- Link tenant record if invitation matches email
  UPDATE public.tenants SET user_id = NEW.id
   WHERE email = NEW.email AND user_id IS NULL;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- Profiles: user reads/updates own; admin sees all
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles: user reads own roles; admin reads all
CREATE POLICY "Read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Tenants: tenant sees own row, admin sees all; only admin writes
CREATE POLICY "Tenant view own, admin all" ON public.tenants
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert tenants" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update tenants" ON public.tenants
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete tenants" ON public.tenants
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Rent invoices: tenant reads own; admin all writes
CREATE POLICY "Tenant view own rent, admin all" ON public.rent_invoices
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admin insert rent" ON public.rent_invoices
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update rent" ON public.rent_invoices
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete rent" ON public.rent_invoices
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tickets: tenant sees+creates own; admin all
CREATE POLICY "Tenant view own tickets, admin all" ON public.maintenance_tickets
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Tenant create own tickets, admin any" ON public.maintenance_tickets
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admin update tickets" ON public.maintenance_tickets
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete tickets" ON public.maintenance_tickets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Ticket comments: visible to ticket owner + admin; authored by self
CREATE POLICY "View comments on accessible tickets" ON public.ticket_comments
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.maintenance_tickets mt
      JOIN public.tenants t ON t.id = mt.tenant_id
      WHERE mt.id = ticket_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Insert comment as self on accessible ticket" ON public.ticket_comments
  FOR INSERT TO authenticated WITH CHECK (
    author_user_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin') OR
      EXISTS (
        SELECT 1 FROM public.maintenance_tickets mt
        JOIN public.tenants t ON t.id = mt.tenant_id
        WHERE mt.id = ticket_id AND t.user_id = auth.uid()
      )
    )
  );

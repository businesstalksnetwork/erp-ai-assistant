
-- ============================================================
-- ERP-AI Phase 1: Foundation Database Schema
-- ============================================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM (
  'super_admin', 'admin', 'manager', 'accountant', 'sales', 'hr', 'user'
);

CREATE TYPE public.tenant_status AS ENUM (
  'active', 'suspended', 'trial'
);

CREATE TYPE public.membership_status AS ENUM (
  'active', 'invited', 'disabled'
);

-- 2. TENANTS
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'trial',
  status public.tenant_status NOT NULL DEFAULT 'trial',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PROFILES (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. USER ROLES (separate table, prevents privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- 5. TENANT MEMBERS (links users to tenants)
CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 6. LEGAL ENTITIES
CREATE TABLE public.legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pib TEXT,
  maticni_broj TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'RS',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. LOCATIONS
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'office',
  address TEXT,
  city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. WAREHOUSES
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  zones JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. SALES CHANNELS
CREATE TABLE public.sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'retail',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. COST CENTERS
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. BANK ACCOUNTS
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RSD',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. MODULE DEFINITIONS (master list)
CREATE TABLE public.module_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- 13. TENANT MODULES (which modules are enabled per tenant)
CREATE TABLE public.tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.module_definitions(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, module_id)
);

-- 14. AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================

-- has_role: check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- is_super_admin: convenience check
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;

-- get_user_tenant_ids: get all tenant IDs a user belongs to
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = _user_id AND status = 'active'
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- TENANTS
CREATE POLICY "Members can view their tenants" ON public.tenants
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins can manage all tenants" ON public.tenants
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- TENANT MEMBERS
CREATE POLICY "Members can view co-members" ON public.tenant_members
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins can manage all members" ON public.tenant_members
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins can manage their members" ON public.tenant_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
        AND tm.status = 'active'
    )
  );

-- TENANT-SCOPED TABLES (legal_entities, locations, warehouses, sales_channels, cost_centers, bank_accounts)
-- Pattern: members can view, super admins full access, tenant admins can manage

-- Legal Entities
CREATE POLICY "Members can view legal entities" ON public.legal_entities
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins manage legal entities" ON public.legal_entities
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage legal entities" ON public.legal_entities
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- Locations
CREATE POLICY "Members can view locations" ON public.locations
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins manage locations" ON public.locations
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage locations" ON public.locations
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- Warehouses
CREATE POLICY "Members can view warehouses" ON public.warehouses
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins manage warehouses" ON public.warehouses
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage warehouses" ON public.warehouses
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- Sales Channels
CREATE POLICY "Members can view sales channels" ON public.sales_channels
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins manage sales channels" ON public.sales_channels
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage sales channels" ON public.sales_channels
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- Cost Centers
CREATE POLICY "Members can view cost centers" ON public.cost_centers
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins manage cost centers" ON public.cost_centers
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage cost centers" ON public.cost_centers
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- Bank Accounts
CREATE POLICY "Members can view bank accounts" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins manage bank accounts" ON public.bank_accounts
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admins manage bank accounts" ON public.bank_accounts
  FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- MODULE DEFINITIONS (readable by all authenticated)
CREATE POLICY "Anyone can view module definitions" ON public.module_definitions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage module definitions" ON public.module_definitions
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- TENANT MODULES
CREATE POLICY "Members can view tenant modules" ON public.tenant_modules
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins manage tenant modules" ON public.tenant_modules
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- AUDIT LOG
CREATE POLICY "Members can view own tenant audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins can view all audit logs" ON public.audit_log
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Authenticated can insert audit log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_legal_entities_updated_at BEFORE UPDATE ON public.legal_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  -- Default role: user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED MODULE DEFINITIONS
-- ============================================================
INSERT INTO public.module_definitions (key, name, description, icon, sort_order) VALUES
  ('accounting', 'Accounting', 'General ledger, chart of accounts, journal entries', 'BookOpen', 1),
  ('sales', 'Sales & Invoicing', 'Quotations, sales orders, invoices, SEF', 'ShoppingCart', 2),
  ('inventory', 'Inventory', 'Stock management, warehouses, products', 'Package', 3),
  ('hr', 'HR & Payroll', 'Employees, payroll, leave management', 'Users', 4),
  ('crm', 'CRM', 'Leads, opportunities, pipeline management', 'Target', 5),
  ('pos', 'Point of Sale', 'POS terminals, fiscal receipts', 'Monitor', 6),
  ('dms', 'Document Management', 'Document archive, OCR, versioning', 'FileText', 7),
  ('production', 'Production', 'BOM, work orders, quality control', 'Factory', 8);

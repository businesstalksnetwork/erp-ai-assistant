
-- =====================================================
-- DMS OVERHAUL: Complete Schema Migration
-- =====================================================

-- 1. Document Categories
CREATE TABLE public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  group_name_sr text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  name_sr text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for document_categories" ON public.document_categories FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 2. Confidentiality Levels
CREATE TABLE public.confidentiality_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_sr text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);
ALTER TABLE public.confidentiality_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for confidentiality_levels" ON public.confidentiality_levels FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 3. Role Confidentiality Access Matrix
CREATE TABLE public.role_confidentiality_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL,
  confidentiality_level_id uuid NOT NULL REFERENCES public.confidentiality_levels(id) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, role, confidentiality_level_id)
);
ALTER TABLE public.role_confidentiality_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for role_confidentiality_access" ON public.role_confidentiality_access FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 4. Alter existing documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS protocol_number text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS sender text,
  ADD COLUMN IF NOT EXISTS recipient text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.document_categories(id),
  ADD COLUMN IF NOT EXISTS confidentiality_level_id uuid REFERENCES public.confidentiality_levels(id),
  ADD COLUMN IF NOT EXISTS date_received date,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aktivan',
  ADD COLUMN IF NOT EXISTS current_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS seq_number int;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_protocol_tenant ON public.documents(tenant_id, protocol_number) WHERE protocol_number IS NOT NULL;

-- 5. Document Access
CREATE TABLE public.document_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, user_id)
);
ALTER TABLE public.document_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for document_access" ON public.document_access FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 6. Document Versions
CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  subject text,
  sender text,
  recipient text,
  category_id uuid REFERENCES public.document_categories(id),
  confidentiality_level_id uuid REFERENCES public.confidentiality_levels(id),
  date_received date,
  valid_until date,
  status text,
  notes text,
  tags text[],
  file_path text,
  file_type text,
  file_size bigint,
  change_summary text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for document_versions" ON public.document_versions FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 7. Archive Book
CREATE TABLE public.archive_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_number int NOT NULL,
  year_of_creation int NOT NULL,
  content_description text NOT NULL,
  category_id uuid REFERENCES public.document_categories(id),
  quantity int NOT NULL DEFAULT 1,
  retention_period text NOT NULL DEFAULT '10',
  retention_years int,
  notes text,
  transferred_to_archive boolean NOT NULL DEFAULT false,
  transfer_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entry_number, year_of_creation)
);
ALTER TABLE public.archive_book ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for archive_book" ON public.archive_book FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 8. Archiving Requests
CREATE TABLE public.archiving_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  reason text,
  approval_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, request_number)
);
ALTER TABLE public.archiving_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for archiving_requests" ON public.archiving_requests FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 9. Archiving Request Items
CREATE TABLE public.archiving_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.archiving_requests(id) ON DELETE CASCADE,
  archive_book_id uuid NOT NULL REFERENCES public.archive_book(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.archiving_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for archiving_request_items" ON public.archiving_request_items FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 10. DMS Projects
CREATE TABLE public.dms_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dms_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for dms_projects" ON public.dms_projects FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 11. DMS Project Members
CREATE TABLE public.dms_project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.dms_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.dms_project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for dms_project_members" ON public.dms_project_members FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 12. Document-Project Links
CREATE TABLE public.document_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.dms_projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, project_id)
);
ALTER TABLE public.document_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for document_projects" ON public.document_projects FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 13. DMS Activity Log
CREATE TABLE public.dms_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dms_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for dms_activity_log" ON public.dms_activity_log FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- 14. Protocol number generation function
CREATE OR REPLACE FUNCTION public.generate_protocol_number(p_tenant_id uuid, p_category_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq int; v_year int;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;
  SELECT COALESCE(MAX(seq_number), 0) + 1 INTO v_seq
  FROM public.documents WHERE tenant_id = p_tenant_id AND EXTRACT(YEAR FROM created_at) = v_year;
  RETURN LPAD(v_seq::text, 3, '0') || '-' || p_category_code || '/' || v_year::text;
END; $$;

-- 15. Update timestamp triggers
CREATE TRIGGER update_archive_book_updated_at BEFORE UPDATE ON public.archive_book FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_archiving_requests_updated_at BEFORE UPDATE ON public.archiving_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dms_projects_updated_at BEFORE UPDATE ON public.dms_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

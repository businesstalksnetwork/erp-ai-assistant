
-- ============================================
-- ERP Drive Module – Core Data Model
-- ============================================

-- 1. Drives (virtual disks)
CREATE TABLE public.drives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  s3_prefix VARCHAR(300),
  drive_type VARCHAR(20) NOT NULL DEFAULT 'COMPANY' CHECK (drive_type IN ('COMPANY', 'PERSONAL', 'SYSTEM')),
  default_permission VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (default_permission IN ('NONE', 'READ', 'WRITE')),
  quota_bytes BIGINT,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  icon VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Drive Folders
CREATE TABLE public.drive_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drive_id UUID NOT NULL REFERENCES public.drives(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  full_path TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  s3_prefix VARCHAR(500),
  color VARCHAR(7),
  inherit_permissions BOOLEAN NOT NULL DEFAULT true,
  allowed_mime_types TEXT[],
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Drive Files
CREATE TABLE public.drive_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  drive_id UUID NOT NULL REFERENCES public.drives(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_name VARCHAR(500) NOT NULL,
  s3_key VARCHAR(700),
  mime_type VARCHAR(127) NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256_hash CHAR(64),
  version INTEGER NOT NULL DEFAULT 1,
  s3_version_id VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'DELETED', 'QUARANTINE')),
  thumbnail_s3_key VARCHAR(700),
  description TEXT,
  tags TEXT[],
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Drive Permissions
CREATE TABLE public.drive_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_type VARCHAR(10) NOT NULL CHECK (resource_type IN ('DRIVE', 'FOLDER', 'FILE')),
  resource_id UUID NOT NULL,
  subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('POSITION', 'EMPLOYEE', 'EVERYONE')),
  subject_id UUID,
  permission_level VARCHAR(10) NOT NULL CHECK (permission_level IN ('DENY', 'LIST', 'READ', 'COMMENT', 'WRITE', 'MANAGE', 'ADMIN')),
  propagate_to_children BOOLEAN NOT NULL DEFAULT true,
  can_reshare BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

-- 5. Drive Audit Log
CREATE TABLE public.drive_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action VARCHAR(30) NOT NULL,
  resource_type VARCHAR(10) NOT NULL,
  resource_id UUID NOT NULL,
  resource_name TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_drives_tenant ON public.drives(tenant_id);
CREATE INDEX idx_drive_folders_drive ON public.drive_folders(drive_id);
CREATE INDEX idx_drive_folders_parent ON public.drive_folders(parent_folder_id);
CREATE INDEX idx_drive_folders_tenant ON public.drive_folders(tenant_id);
CREATE INDEX idx_drive_files_folder ON public.drive_files(folder_id);
CREATE INDEX idx_drive_files_drive ON public.drive_files(drive_id);
CREATE INDEX idx_drive_files_tenant ON public.drive_files(tenant_id);
CREATE INDEX idx_drive_files_status ON public.drive_files(status) WHERE NOT is_deleted;
CREATE INDEX idx_drive_files_tags ON public.drive_files USING GIN(tags);
CREATE INDEX idx_drive_permissions_resource ON public.drive_permissions(resource_type, resource_id);
CREATE INDEX idx_drive_permissions_subject ON public.drive_permissions(subject_type, subject_id);
CREATE INDEX idx_drive_permissions_tenant ON public.drive_permissions(tenant_id);
CREATE INDEX idx_drive_audit_tenant ON public.drive_audit_log(tenant_id);
CREATE INDEX idx_drive_audit_resource ON public.drive_audit_log(resource_type, resource_id);
CREATE INDEX idx_drive_audit_occurred ON public.drive_audit_log(occurred_at DESC);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_audit_log ENABLE ROW LEVEL SECURITY;

-- Drives
CREATE POLICY "Tenant members can view drives" ON public.drives
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drives.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
  );

CREATE POLICY "Admins can manage drives" ON public.drives
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drives.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active' AND tm.role IN ('admin', 'manager'))
  );

-- Folders
CREATE POLICY "Tenant members can view folders" ON public.drive_folders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drive_folders.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
  );

CREATE POLICY "Tenant members can manage folders" ON public.drive_folders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drive_folders.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
  );

-- Files
CREATE POLICY "Tenant members can view files" ON public.drive_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drive_files.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
  );

CREATE POLICY "Tenant members can manage files" ON public.drive_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drive_files.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
  );

-- Permissions
CREATE POLICY "Tenant members can view permissions" ON public.drive_permissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drive_permissions.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
  );

CREATE POLICY "Admins can manage permissions" ON public.drive_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drive_permissions.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active' AND tm.role IN ('admin', 'manager'))
  );

-- Audit log (read-only for members)
CREATE POLICY "Tenant members can view audit log" ON public.drive_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = drive_audit_log.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
  );

-- Triggers for updated_at
CREATE TRIGGER update_drives_updated_at BEFORE UPDATE ON public.drives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_drive_folders_updated_at BEFORE UPDATE ON public.drive_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_drive_files_updated_at BEFORE UPDATE ON public.drive_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate s3_prefix for drives
CREATE OR REPLACE FUNCTION public.drive_set_s3_prefix()
RETURNS TRIGGER AS $$
BEGIN
  NEW.s3_prefix := 'tenant/' || NEW.tenant_id || '/drives/' || NEW.id || '/';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER drive_auto_s3_prefix BEFORE INSERT ON public.drives FOR EACH ROW EXECUTE FUNCTION public.drive_set_s3_prefix();

-- Auto-generate full_path and s3_prefix for folders
CREATE OR REPLACE FUNCTION public.drive_folder_set_paths()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
  drive_prefix TEXT;
BEGIN
  SELECT s3_prefix INTO drive_prefix FROM public.drives WHERE id = NEW.drive_id;
  IF NEW.parent_folder_id IS NOT NULL THEN
    SELECT full_path INTO parent_path FROM public.drive_folders WHERE id = NEW.parent_folder_id;
    NEW.full_path := COALESCE(parent_path, '') || NEW.name || '/';
    NEW.depth := (SELECT depth + 1 FROM public.drive_folders WHERE id = NEW.parent_folder_id);
  ELSE
    NEW.full_path := '/' || NEW.name || '/';
    NEW.depth := 0;
  END IF;
  NEW.s3_prefix := drive_prefix || NEW.id || '/';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER drive_folder_auto_paths BEFORE INSERT ON public.drive_folders FOR EACH ROW EXECUTE FUNCTION public.drive_folder_set_paths();

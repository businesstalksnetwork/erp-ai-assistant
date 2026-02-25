
CREATE TABLE public.drive_file_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.drive_files(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  s3_key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

ALTER TABLE public.drive_file_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view file versions"
  ON public.drive_file_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = drive_file_versions.tenant_id
    AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

CREATE POLICY "Tenant members can insert file versions"
  ON public.drive_file_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = drive_file_versions.tenant_id
    AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

CREATE POLICY "Tenant members can delete file versions"
  ON public.drive_file_versions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = drive_file_versions.tenant_id
    AND tm.user_id = auth.uid() AND tm.status = 'active'
    AND tm.role IN ('admin', 'manager')
  ));

CREATE INDEX idx_drive_file_versions_file_id ON public.drive_file_versions(file_id);

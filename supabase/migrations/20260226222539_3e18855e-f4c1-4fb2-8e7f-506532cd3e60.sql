-- SEC-7: Fix tenant-documents storage policies for cross-tenant isolation
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own documents" ON storage.objects;

-- Create tenant-scoped policies: folder structure is tenant_id/...
CREATE POLICY "Tenant members can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tenant-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT tm.tenant_id::text FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

CREATE POLICY "Tenant members can read documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tenant-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT tm.tenant_id::text FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

CREATE POLICY "Tenant members can delete documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tenant-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT tm.tenant_id::text FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );
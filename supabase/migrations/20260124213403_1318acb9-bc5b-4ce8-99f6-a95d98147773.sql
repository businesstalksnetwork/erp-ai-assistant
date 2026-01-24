-- Create document_folders table
CREATE TABLE public.document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_folders
CREATE POLICY "Users can manage own company folders" ON public.document_folders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM companies WHERE companies.id = document_folders.company_id AND companies.user_id = auth.uid())
    AND is_approved(auth.uid())
  );

CREATE POLICY "Bookkeepers can manage client folders" ON public.document_folders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM companies c WHERE c.id = document_folders.company_id AND is_bookkeeper_for(c.user_id))
    AND is_approved(auth.uid())
  );

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for documents
CREATE INDEX idx_documents_name_normalized ON public.documents(name_normalized);
CREATE INDEX idx_documents_company_folder ON public.documents(company_id, folder_id);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for documents
CREATE POLICY "Users can manage own company documents" ON public.documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM companies WHERE companies.id = documents.company_id AND companies.user_id = auth.uid())
    AND is_approved(auth.uid())
  );

CREATE POLICY "Bookkeepers can manage client documents" ON public.documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM companies c WHERE c.id = documents.company_id AND is_bookkeeper_for(c.user_id))
    AND is_approved(auth.uid())
  );

-- Create private storage bucket for company documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-documents', 'company-documents', false);

-- Storage RLS policies
CREATE POLICY "Users can upload company documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own company documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'company-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own company documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Bookkeepers can upload client documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT c.id::text FROM companies c WHERE is_bookkeeper_for(c.user_id)
    )
  );

CREATE POLICY "Bookkeepers can read client documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'company-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT c.id::text FROM companies c WHERE is_bookkeeper_for(c.user_id)
    )
  );

CREATE POLICY "Bookkeepers can delete client documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT c.id::text FROM companies c WHERE is_bookkeeper_for(c.user_id)
    )
  );

-- Allow bookkeepers to insert email logs for client companies
DROP POLICY IF EXISTS "Users can insert own company email logs" ON public.invoice_email_log;
CREATE POLICY "Users and bookkeepers can insert email logs" 
ON public.invoice_email_log 
FOR INSERT 
TO authenticated
WITH CHECK (
  (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  OR is_company_bookkeeper(company_id)
);

-- Allow bookkeepers to upload invoice PDFs for client companies
DROP POLICY IF EXISTS "Users can upload invoice PDFs" ON storage.objects;
CREATE POLICY "Users and bookkeepers can upload invoice PDFs" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-pdfs' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
    OR is_company_bookkeeper((storage.foldername(name))[1]::uuid)
  )
);

-- Allow bookkeepers to read invoice PDFs for client companies
DROP POLICY IF EXISTS "Users can read own invoice PDFs" ON storage.objects;
CREATE POLICY "Users and bookkeepers can read invoice PDFs" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'invoice-pdfs' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
    OR is_company_bookkeeper((storage.foldername(name))[1]::uuid)
  )
);

-- Allow bookkeepers to delete invoice PDFs for client companies
DROP POLICY IF EXISTS "Users can delete own invoice PDFs" ON storage.objects;
CREATE POLICY "Users and bookkeepers can delete invoice PDFs" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'invoice-pdfs' 
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
    OR is_company_bookkeeper((storage.foldername(name))[1]::uuid)
  )
);

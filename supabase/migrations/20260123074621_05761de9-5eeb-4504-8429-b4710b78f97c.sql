-- Drop incorrectly created policies
DROP POLICY IF EXISTS "reminder_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "reminder_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "reminder_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "reminder_attachments_delete" ON storage.objects;

-- Create CORRECT policies - using storage.foldername(name) not storage.foldername(c.name)
-- The 'name' column is from storage.objects table and contains the file path like: {company_id}/{timestamp}.{ext}

-- SELECT policy
CREATE POLICY "reminder_attachments_select" ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
    AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
  )
);

-- INSERT policy
CREATE POLICY "reminder_attachments_insert" ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
    AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
  )
);

-- UPDATE policy
CREATE POLICY "reminder_attachments_update" ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
    AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
  )
);

-- DELETE policy
CREATE POLICY "reminder_attachments_delete" ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
    AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
  )
);
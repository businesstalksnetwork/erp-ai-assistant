-- Drop old broken policies for reminder-attachments
DROP POLICY IF EXISTS "Users can view own company reminder attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own reminder attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own reminder attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own reminder attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own reminder attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload reminder attachments" ON storage.objects;

-- Create correct policies for reminder-attachments bucket
-- The file path is: {company_id}/{timestamp}.{ext}
-- So we need to check if the first folder in the path matches a company the user owns

-- SELECT policy: Users can view attachments for their companies
CREATE POLICY "reminder_attachments_select" ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
  )
);

-- INSERT policy: Users can upload attachments to their companies folders
CREATE POLICY "reminder_attachments_insert" ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
  )
);

-- UPDATE policy: Users can update attachments in their companies folders
CREATE POLICY "reminder_attachments_update" ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
  )
);

-- DELETE policy: Users can delete attachments from their companies folders
CREATE POLICY "reminder_attachments_delete" ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
  )
);
-- Drop and recreate upload policy to allow uploads before reminder exists
DROP POLICY IF EXISTS "Users can upload their own reminder attachments" ON storage.objects;

CREATE POLICY "Users can upload their own reminder attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reminder-attachments' 
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.user_id = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);
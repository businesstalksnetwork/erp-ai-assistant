-- Make bucket public so users can view PDFs
UPDATE storage.buckets SET public = true WHERE id = 'reminder-attachments';

-- Create storage policies for reminder-attachments bucket if they don't exist
DO $$
BEGIN
  -- Check if policies exist before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view reminder attachments' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can view reminder attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'reminder-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can upload reminder attachments' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload reminder attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'reminder-attachments' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can delete own reminder attachments' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete own reminder attachments"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'reminder-attachments' AND auth.uid() IS NOT NULL);
  END IF;
END $$;
-- Add recurrence fields and attachment URL to payment_reminders
ALTER TABLE public.payment_reminders
ADD COLUMN recurrence_type TEXT DEFAULT 'none' CHECK (recurrence_type IN ('none', 'monthly')),
ADD COLUMN recurrence_day INTEGER CHECK (recurrence_day IS NULL OR (recurrence_day >= 1 AND recurrence_day <= 31)),
ADD COLUMN attachment_url TEXT;

-- Create storage bucket for reminder attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('reminder-attachments', 'reminder-attachments', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for reminder attachments bucket
CREATE POLICY "Users can upload their own reminder attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reminder-attachments' 
  AND EXISTS (
    SELECT 1 FROM payment_reminders pr
    JOIN companies c ON c.id = pr.company_id
    WHERE c.user_id = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);

CREATE POLICY "Users can view their own reminder attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reminder-attachments'
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.user_id = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);

CREATE POLICY "Users can delete their own reminder attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reminder-attachments'
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.user_id = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);
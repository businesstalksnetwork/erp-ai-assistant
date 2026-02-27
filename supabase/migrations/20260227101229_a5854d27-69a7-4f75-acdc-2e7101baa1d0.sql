-- Make reminder-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'reminder-attachments';

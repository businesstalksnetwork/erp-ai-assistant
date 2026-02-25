
ALTER TABLE public.drive_files ADD COLUMN IF NOT EXISTS dms_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_drive_files_dms_doc ON public.drive_files(dms_document_id) WHERE dms_document_id IS NOT NULL;

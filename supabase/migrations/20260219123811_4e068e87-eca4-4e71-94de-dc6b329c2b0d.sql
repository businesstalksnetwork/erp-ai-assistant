-- Create storage bucket for legacy CSV imports
INSERT INTO storage.buckets (id, name, public)
VALUES ('legacy-imports', 'legacy-imports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role can manage legacy imports"
ON storage.objects
FOR ALL
USING (bucket_id = 'legacy-imports')
WITH CHECK (bucket_id = 'legacy-imports');

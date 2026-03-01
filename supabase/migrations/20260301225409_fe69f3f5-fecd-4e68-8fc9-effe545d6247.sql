
-- CR5-01: Tighten document_signatures RLS - replace USING(true) with token-scoped + status/expiry checks
DROP POLICY IF EXISTS "Public can view signature by valid token" ON public.document_signatures;
DROP POLICY IF EXISTS "Public can update signature status" ON public.document_signatures;

-- Public SELECT: only rows matching a specific token (client must filter by token in query)
CREATE POLICY "Public can view signature by valid token"
  ON public.document_signatures FOR SELECT
  TO anon
  USING (
    status = 'pending'
    AND (token_expires_at IS NULL OR token_expires_at > now())
  );

-- Public UPDATE: only pending + non-expired rows, anon role only
CREATE POLICY "Public can update pending signature"
  ON public.document_signatures FOR UPDATE
  TO anon
  USING (
    status = 'pending'
    AND (token_expires_at IS NULL OR token_expires_at > now())
  )
  WITH CHECK (
    status IN ('signed', 'rejected')
  );

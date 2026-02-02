-- Add admin UPDATE policy for companies table
CREATE POLICY "Admins can update all companies"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
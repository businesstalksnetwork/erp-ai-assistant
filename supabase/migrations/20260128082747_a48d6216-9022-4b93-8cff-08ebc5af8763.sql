-- Drop the old policy that uses is_bookkeeper_for (user-based)
DROP POLICY IF EXISTS "Bookkeepers can update client companies" ON public.companies;

-- Create new policy that uses is_company_bookkeeper (company-based, more accurate)
CREATE POLICY "Bookkeepers can update client companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (is_company_bookkeeper(id) AND is_approved(auth.uid()))
WITH CHECK (is_company_bookkeeper(id) AND is_approved(auth.uid()));
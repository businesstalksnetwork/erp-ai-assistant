-- Obriši postojeću RESTRICTIVE politiku
DROP POLICY IF EXISTS "Bookkeepers can update client companies" ON public.companies;

-- Kreiraj novu PERMISSIVE politiku
CREATE POLICY "Bookkeepers can update client companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (is_bookkeeper_for(user_id) AND is_approved(auth.uid()))
WITH CHECK (is_bookkeeper_for(user_id) AND is_approved(auth.uid()));
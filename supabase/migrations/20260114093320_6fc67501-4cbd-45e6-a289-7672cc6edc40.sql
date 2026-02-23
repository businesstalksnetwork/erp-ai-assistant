-- Dodaj RLS politiku koja dozvoljava knjigovođama da ažuriraju firme svojih klijenata
CREATE POLICY "Bookkeepers can update client companies"
ON public.companies
FOR UPDATE
USING (is_bookkeeper_for(user_id) AND is_approved(auth.uid()))
WITH CHECK (is_bookkeeper_for(user_id) AND is_approved(auth.uid()));
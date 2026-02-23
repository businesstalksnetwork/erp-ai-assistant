-- Admini mogu da vide sve bookkeeper_clients zapise
CREATE POLICY "Admins can view all bookkeeper_clients"
ON public.bookkeeper_clients
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
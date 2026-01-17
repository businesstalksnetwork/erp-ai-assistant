-- Dozvoli knjigovođama da dodaju stavke u šifarnik firmi svojih klijenata
CREATE POLICY "Bookkeepers can insert client service catalog"
ON public.service_catalog
FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = service_catalog.company_id 
    AND is_bookkeeper_for(c.user_id)
  )) AND is_approved(auth.uid())
);

-- Dozvoli knjigovođama da ažuriraju šifarnik firmi svojih klijenata  
CREATE POLICY "Bookkeepers can update client service catalog"
ON public.service_catalog
FOR UPDATE
USING (
  (EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = service_catalog.company_id 
    AND is_bookkeeper_for(c.user_id)
  )) AND is_approved(auth.uid())
);

-- Dozvoli knjigovođama da brišu stavke iz šifarnika firmi svojih klijenata
CREATE POLICY "Bookkeepers can delete client service catalog"
ON public.service_catalog
FOR DELETE
USING (
  (EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = service_catalog.company_id 
    AND is_bookkeeper_for(c.user_id)
  )) AND is_approved(auth.uid())
);
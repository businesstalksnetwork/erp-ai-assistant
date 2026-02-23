-- Ažurirati politiku da klijent može da briše svoje pozivnice bilo kog statusa
DROP POLICY IF EXISTS "Clients can delete own invitations" ON bookkeeper_clients;

CREATE POLICY "Clients can delete own invitations"
ON bookkeeper_clients FOR DELETE
USING (
  client_id = auth.uid() 
  AND is_approved(auth.uid())
);
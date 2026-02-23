-- Add sef_registered column to clients table
ALTER TABLE public.clients
ADD COLUMN sef_registered BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.sef_registered IS 'Da li je klijent registrovan u SEF sistemu';
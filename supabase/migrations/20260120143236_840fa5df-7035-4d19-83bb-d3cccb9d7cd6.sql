-- Dodaj RLS politike za invoice_templates koje dozvoljavaju knjigovodjama pristup

-- DROP existing policies and recreate with bookkeeper support
DROP POLICY IF EXISTS "Users can view own company templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can create templates for own companies" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can update own company templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can delete own company templates" ON public.invoice_templates;

-- SELECT: vlasnik firme ILI knjigovođa
CREATE POLICY "Users and bookkeepers can view templates"
ON public.invoice_templates
FOR SELECT
USING (
  company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  )
  OR
  company_id IN (
    SELECT c.id FROM companies c
    WHERE is_bookkeeper_for(c.user_id)
  )
);

-- INSERT: vlasnik firme ILI knjigovođa
CREATE POLICY "Users and bookkeepers can create templates"
ON public.invoice_templates
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  )
  OR
  company_id IN (
    SELECT c.id FROM companies c
    WHERE is_bookkeeper_for(c.user_id)
  )
);

-- UPDATE: vlasnik firme ILI knjigovođa
CREATE POLICY "Users and bookkeepers can update templates"
ON public.invoice_templates
FOR UPDATE
USING (
  company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  )
  OR
  company_id IN (
    SELECT c.id FROM companies c
    WHERE is_bookkeeper_for(c.user_id)
  )
);

-- DELETE: vlasnik firme ILI knjigovođa
CREATE POLICY "Users and bookkeepers can delete templates"
ON public.invoice_templates
FOR DELETE
USING (
  company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  )
  OR
  company_id IN (
    SELECT c.id FROM companies c
    WHERE is_bookkeeper_for(c.user_id)
  )
);
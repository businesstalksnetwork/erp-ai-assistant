-- Add explicit authentication requirement for profiles table
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add explicit authentication requirement for companies table  
CREATE POLICY "Require authentication for companies"
ON public.companies
FOR SELECT
USING (auth.uid() IS NOT NULL);
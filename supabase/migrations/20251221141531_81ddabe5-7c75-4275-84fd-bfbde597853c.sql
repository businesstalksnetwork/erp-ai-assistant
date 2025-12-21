-- Add policies to deny public (unauthenticated) access to sensitive tables

-- Profiles table - require authentication for SELECT
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- Companies table - require authentication for SELECT
CREATE POLICY "Require authentication for companies"
ON public.companies
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- Invoices table - require authentication for SELECT
CREATE POLICY "Require authentication for invoices"
ON public.invoices
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- Clients table - require authentication for SELECT
CREATE POLICY "Require authentication for clients"
ON public.clients
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- Invoice items table - require authentication for SELECT
CREATE POLICY "Require authentication for invoice_items"
ON public.invoice_items
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- KPO entries table - require authentication for SELECT
CREATE POLICY "Require authentication for kpo_entries"
ON public.kpo_entries
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- Payment reminders table - require authentication for SELECT
CREATE POLICY "Require authentication for payment_reminders"
ON public.payment_reminders
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- Bookkeeper clients table - require authentication for SELECT
CREATE POLICY "Require authentication for bookkeeper_clients"
ON public.bookkeeper_clients
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);
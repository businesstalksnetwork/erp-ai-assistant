-- Drop overly permissive "Require authentication" policies that expose data to all authenticated users
-- Each table already has proper owner/bookkeeper policies that correctly restrict access

-- 1. Drop policy from sef_invoices
DROP POLICY IF EXISTS "Require authentication for sef_invoices" ON public.sef_invoices;

-- 2. Drop policy from profiles
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

-- 3. Drop policy from companies
DROP POLICY IF EXISTS "Require authentication for companies" ON public.companies;

-- 4. Drop policy from invoices
DROP POLICY IF EXISTS "Require authentication for invoices" ON public.invoices;

-- 5. Drop policy from clients
DROP POLICY IF EXISTS "Require authentication for clients" ON public.clients;

-- 6. Drop policy from bookkeeper_clients
DROP POLICY IF EXISTS "Require authentication for bookkeeper_clients" ON public.bookkeeper_clients;

-- 7. Drop policy from payment_reminders
DROP POLICY IF EXISTS "Require authentication for payment_reminders" ON public.payment_reminders;

-- 8. Drop policy from service_catalog
DROP POLICY IF EXISTS "Require authentication for service_catalog" ON public.service_catalog;

-- Also drop from other tables that may have similar policies
DROP POLICY IF EXISTS "Require authentication for invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Require authentication for kpo_entries" ON public.kpo_entries;
DROP POLICY IF EXISTS "Require authentication for fiscal_entries" ON public.fiscal_entries;
DROP POLICY IF EXISTS "Require authentication for fiscal_daily_summary" ON public.fiscal_daily_summary;
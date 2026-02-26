-- P2: Database Schema Fixes (validated against live schema)

-- DB-4: FKs on audit columns (ON DELETE SET NULL)
DO $$ BEGIN
  ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.quotes ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.production_orders ADD CONSTRAINT production_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- DB-7: Recreate companies.tenant_id FK with ON DELETE CASCADE
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_tenant_id_fkey;
ALTER TABLE public.companies ADD CONSTRAINT companies_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE public.company_categories DROP CONSTRAINT IF EXISTS company_categories_tenant_id_fkey;
  ALTER TABLE public.company_categories ADD CONSTRAINT company_categories_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- DB-8: Trigger to clean up orphan bookkeeper_clients on profile deletion
CREATE OR REPLACE FUNCTION public.cleanup_orphan_bookkeeper_clients()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.bookkeeper_clients 
  WHERE client_email = OLD.email 
    AND bookkeeper_id IS NULL;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_bookkeeper_clients ON public.profiles;
CREATE TRIGGER trg_cleanup_bookkeeper_clients
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_orphan_bookkeeper_clients();

-- IDX-1: Performance indexes on ERP tables (tenant-scoped)
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due ON public.invoices(tenant_id, due_date) WHERE status IN ('draft','sent');
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_partner ON public.invoices(tenant_id, partner_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date ON public.journal_entries(tenant_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_lines_je ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_tenant ON public.inventory_stock(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members(user_id, status);
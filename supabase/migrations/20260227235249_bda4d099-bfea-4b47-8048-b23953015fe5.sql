
-- Bug 7: DB-CRIT-2 — Add tenant_id to journal_lines for direct RLS

-- Step 1: Add column
ALTER TABLE public.journal_lines ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Step 2: Disable immutability triggers
ALTER TABLE public.journal_lines DISABLE TRIGGER trg_block_posted_journal_lines_mutation;
ALTER TABLE public.journal_lines DISABLE TRIGGER trg_protect_posted_lines_update;

-- Step 3: Backfill
UPDATE public.journal_lines jl
SET tenant_id = je.tenant_id
FROM public.journal_entries je
WHERE je.id = jl.journal_entry_id;

-- Step 4: Re-enable
ALTER TABLE public.journal_lines ENABLE TRIGGER trg_block_posted_journal_lines_mutation;
ALTER TABLE public.journal_lines ENABLE TRIGGER trg_protect_posted_lines_update;

-- Step 5: NOT NULL + index
ALTER TABLE public.journal_lines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_lines_tenant ON public.journal_lines(tenant_id);

-- Step 6: RLS policies
DROP POLICY IF EXISTS "journal_lines_select" ON public.journal_lines;
DROP POLICY IF EXISTS "journal_lines_insert" ON public.journal_lines;
DROP POLICY IF EXISTS "journal_lines_update" ON public.journal_lines;
DROP POLICY IF EXISTS "journal_lines_delete" ON public.journal_lines;
DROP POLICY IF EXISTS "Tenant isolation for journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Users can view journal lines for their tenant" ON public.journal_lines;
DROP POLICY IF EXISTS "Users can insert journal lines for their tenant" ON public.journal_lines;
DROP POLICY IF EXISTS "Users can update journal lines for their tenant" ON public.journal_lines;
DROP POLICY IF EXISTS "Users can delete journal lines for their tenant" ON public.journal_lines;

CREATE POLICY "journal_lines_select" ON public.journal_lines
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "journal_lines_insert" ON public.journal_lines
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "journal_lines_update" ON public.journal_lines
  FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "journal_lines_delete" ON public.journal_lines
  FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

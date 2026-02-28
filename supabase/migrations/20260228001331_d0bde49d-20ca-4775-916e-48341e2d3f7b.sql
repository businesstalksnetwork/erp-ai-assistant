
-- Migration 2: Add tenant_id to 10 priority child tables
-- Step 1: Add nullable columns
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.quote_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.sales_order_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.purchase_order_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.goods_receipt_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.bom_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.production_consumption ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.posting_rule_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.approval_steps ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Step 2: Backfill from parent tables
UPDATE public.invoice_lines il SET tenant_id = i.tenant_id FROM public.invoices i WHERE il.invoice_id = i.id AND il.tenant_id IS NULL;
UPDATE public.quote_lines ql SET tenant_id = q.tenant_id FROM public.quotes q WHERE ql.quote_id = q.id AND ql.tenant_id IS NULL;
UPDATE public.sales_order_lines sol SET tenant_id = so.tenant_id FROM public.sales_orders so WHERE sol.sales_order_id = so.id AND sol.tenant_id IS NULL;
UPDATE public.purchase_order_lines pol SET tenant_id = po.tenant_id FROM public.purchase_orders po WHERE pol.purchase_order_id = po.id AND pol.tenant_id IS NULL;
UPDATE public.goods_receipt_lines grl SET tenant_id = gr.tenant_id FROM public.goods_receipts gr WHERE grl.goods_receipt_id = gr.id AND grl.tenant_id IS NULL;
UPDATE public.payroll_items pi SET tenant_id = pr.tenant_id FROM public.payroll_runs pr WHERE pi.payroll_run_id = pr.id AND pi.tenant_id IS NULL;
UPDATE public.bom_lines bl SET tenant_id = bt.tenant_id FROM public.bom_templates bt WHERE bl.bom_template_id = bt.id AND bl.tenant_id IS NULL;
UPDATE public.production_consumption pc SET tenant_id = po.tenant_id FROM public.production_orders po WHERE pc.production_order_id = po.id AND pc.tenant_id IS NULL;
UPDATE public.posting_rule_lines prl SET tenant_id = pr.tenant_id FROM public.posting_rules pr WHERE prl.posting_rule_id = pr.id AND prl.tenant_id IS NULL;
UPDATE public.approval_steps ast SET tenant_id = ar.tenant_id FROM public.approval_requests ar WHERE ast.request_id = ar.id AND ast.tenant_id IS NULL;

-- Step 3: Set NOT NULL (only if all rows now have tenant_id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.invoice_lines WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.invoice_lines ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_lines WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.quote_lines ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sales_order_lines WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.sales_order_lines ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_order_lines WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.purchase_order_lines ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.goods_receipt_lines WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.goods_receipt_lines ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payroll_items WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.payroll_items ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bom_lines WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.bom_lines ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_consumption WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.production_consumption ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.posting_rule_lines WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.posting_rule_lines ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.approval_steps WHERE tenant_id IS NULL LIMIT 1) THEN
    ALTER TABLE public.approval_steps ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_lines_tenant ON public.invoice_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_tenant ON public.quote_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_tenant ON public.sales_order_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_tenant ON public.purchase_order_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_lines_tenant ON public.goods_receipt_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_tenant ON public.payroll_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bom_lines_tenant ON public.bom_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_production_consumption_tenant ON public.production_consumption(tenant_id);
CREATE INDEX IF NOT EXISTS idx_posting_rule_lines_tenant ON public.posting_rule_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_tenant ON public.approval_steps(tenant_id);

-- Step 5: Update RLS policies to use direct tenant_id

-- invoice_lines: drop JOIN-based, create direct
DROP POLICY IF EXISTS "Members can view invoice lines" ON public.invoice_lines;
CREATE POLICY "Members can view invoice lines" ON public.invoice_lines FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
DROP POLICY IF EXISTS "Tenant admins/accountants manage invoice lines" ON public.invoice_lines;
CREATE POLICY "Tenant admins/accountants manage invoice lines" ON public.invoice_lines FOR ALL USING (
  tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin','accountant') AND tm.status = 'active')
);

-- quote_lines
DROP POLICY IF EXISTS "Tenant members can manage quote_lines" ON public.quote_lines;
CREATE POLICY "Tenant members can manage quote_lines" ON public.quote_lines FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- sales_order_lines
DROP POLICY IF EXISTS "Tenant members can manage sales_order_lines" ON public.sales_order_lines;
CREATE POLICY "Tenant members can manage sales_order_lines" ON public.sales_order_lines FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- purchase_order_lines
DROP POLICY IF EXISTS "Tenant isolation via purchase_orders" ON public.purchase_order_lines;
CREATE POLICY "Tenant isolation via purchase_orders" ON public.purchase_order_lines FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- goods_receipt_lines
DROP POLICY IF EXISTS "Tenant isolation via goods_receipts" ON public.goods_receipt_lines;
CREATE POLICY "Tenant isolation via goods_receipts" ON public.goods_receipt_lines FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- payroll_items
DROP POLICY IF EXISTS "Members can view payroll items" ON public.payroll_items;
CREATE POLICY "Members can view payroll items" ON public.payroll_items FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
DROP POLICY IF EXISTS "Tenant admins/hr manage payroll items" ON public.payroll_items;
CREATE POLICY "Tenant admins/hr manage payroll items" ON public.payroll_items FOR ALL USING (
  tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin','hr') AND tm.status = 'active')
);

-- bom_lines
DROP POLICY IF EXISTS "Tenant isolation via bom_templates" ON public.bom_lines;
CREATE POLICY "Tenant isolation via bom_templates" ON public.bom_lines FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- production_consumption
DROP POLICY IF EXISTS "Tenant isolation via production_orders" ON public.production_consumption;
CREATE POLICY "Tenant isolation via production_orders" ON public.production_consumption FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- posting_rule_lines
DROP POLICY IF EXISTS "posting_rule_lines_member_select" ON public.posting_rule_lines;
CREATE POLICY "posting_rule_lines_member_select" ON public.posting_rule_lines FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
DROP POLICY IF EXISTS "posting_rule_lines_admin_manage" ON public.posting_rule_lines;
CREATE POLICY "posting_rule_lines_admin_manage" ON public.posting_rule_lines FOR ALL USING (
  tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'admin' AND tm.status = 'active')
);

-- approval_steps
DROP POLICY IF EXISTS "Tenant isolation" ON public.approval_steps;
CREATE POLICY "Tenant isolation" ON public.approval_steps FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

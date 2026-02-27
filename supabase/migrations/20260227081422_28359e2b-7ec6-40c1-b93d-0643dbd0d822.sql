
-- Fix RLS policies using existing get_user_tenant_ids function

-- voucher_types
DROP POLICY IF EXISTS "Tenant isolation for voucher_types" ON public.voucher_types;
DROP POLICY IF EXISTS "Authenticated users can manage voucher_types" ON public.voucher_types;

CREATE POLICY "voucher_types_select" ON public.voucher_types FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "voucher_types_modify" ON public.voucher_types FOR ALL TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- supplier_invoice_lines (via parent supplier_invoices)
DROP POLICY IF EXISTS "Supplier invoice lines access via parent" ON public.supplier_invoice_lines;

CREATE POLICY "supplier_invoice_lines_select" ON public.supplier_invoice_lines FOR SELECT TO authenticated
  USING (supplier_invoice_id IN (SELECT id FROM public.supplier_invoices WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))));
CREATE POLICY "supplier_invoice_lines_modify" ON public.supplier_invoice_lines FOR ALL TO authenticated
  USING (supplier_invoice_id IN (SELECT id FROM public.supplier_invoices WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))))
  WITH CHECK (supplier_invoice_id IN (SELECT id FROM public.supplier_invoices WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))));

-- popdv_records
DROP POLICY IF EXISTS "Tenant isolation for popdv_records" ON public.popdv_records;

CREATE POLICY "popdv_records_select" ON public.popdv_records FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "popdv_records_modify" ON public.popdv_records FOR ALL TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

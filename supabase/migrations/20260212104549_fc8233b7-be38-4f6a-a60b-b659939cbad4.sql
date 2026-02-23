
-- ==========================================
-- Phase 6: Production, DMS, POS
-- ==========================================

-- PRODUCTION MODULE
CREATE TABLE public.bom_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  name TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bom_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.bom_templates FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.bom_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_template_id UUID NOT NULL REFERENCES public.bom_templates(id) ON DELETE CASCADE,
  material_product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation via bom_templates" ON public.bom_lines FOR ALL
  USING (bom_template_id IN (SELECT id FROM public.bom_templates WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))));

CREATE TABLE public.production_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  bom_template_id UUID REFERENCES public.bom_templates(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.production_orders FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.production_consumption (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  quantity_consumed NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation via production_orders" ON public.production_consumption FOR ALL
  USING (production_order_id IN (SELECT id FROM public.production_orders WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))));

-- DMS MODULE
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  entity_type TEXT,
  entity_id UUID,
  uploaded_by UUID,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.documents FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- POS MODULE
CREATE TABLE public.pos_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opened_by UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.pos_sessions FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.pos_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.pos_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_number TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  customer_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.pos_transactions FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Triggers for updated_at
CREATE TRIGGER update_bom_templates_updated_at BEFORE UPDATE ON public.bom_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_production_orders_updated_at BEFORE UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pos_sessions_updated_at BEFORE UPDATE ON public.pos_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit triggers
CREATE TRIGGER audit_production_orders AFTER INSERT OR UPDATE OR DELETE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_pos_transactions AFTER INSERT OR UPDATE OR DELETE ON public.pos_transactions FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Storage bucket for DMS
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-documents', 'tenant-documents', false);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tenant-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read documents" ON storage.objects FOR SELECT USING (bucket_id = 'tenant-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete own documents" ON storage.objects FOR DELETE USING (bucket_id = 'tenant-documents' AND auth.role() = 'authenticated');

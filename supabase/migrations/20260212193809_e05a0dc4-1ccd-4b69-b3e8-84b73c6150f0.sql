
-- Phase 24: Advanced Accounting Engine

-- 1.1 fx_revaluations
CREATE TABLE public.fx_revaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  revaluation_date date NOT NULL,
  base_currency text NOT NULL DEFAULT 'RSD',
  total_gain numeric NOT NULL DEFAULT 0,
  total_loss numeric NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fx_revaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage fx_revaluations" ON public.fx_revaluations FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX idx_fx_revaluations_tenant ON public.fx_revaluations(tenant_id);

-- 1.2 fx_revaluation_lines
CREATE TABLE public.fx_revaluation_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revaluation_id uuid NOT NULL REFERENCES public.fx_revaluations(id) ON DELETE CASCADE,
  open_item_id uuid NOT NULL REFERENCES public.open_items(id),
  currency text NOT NULL,
  original_rate numeric NOT NULL,
  new_rate numeric NOT NULL,
  original_amount_rsd numeric NOT NULL,
  revalued_amount_rsd numeric NOT NULL,
  difference numeric NOT NULL
);
ALTER TABLE public.fx_revaluation_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage fx_revaluation_lines" ON public.fx_revaluation_lines FOR ALL USING (revaluation_id IN (SELECT id FROM public.fx_revaluations WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')));

-- 1.3 kompenzacija
CREATE TABLE public.kompenzacija (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  document_number text NOT NULL,
  document_date date NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kompenzacija ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage kompenzacija" ON public.kompenzacija FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX idx_kompenzacija_tenant ON public.kompenzacija(tenant_id);
CREATE TRIGGER update_kompenzacija_updated_at BEFORE UPDATE ON public.kompenzacija FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.4 kompenzacija_items
CREATE TABLE public.kompenzacija_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kompenzacija_id uuid NOT NULL REFERENCES public.kompenzacija(id) ON DELETE CASCADE,
  open_item_id uuid NOT NULL REFERENCES public.open_items(id),
  amount numeric NOT NULL,
  direction text NOT NULL
);
ALTER TABLE public.kompenzacija_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage kompenzacija_items" ON public.kompenzacija_items FOR ALL USING (kompenzacija_id IN (SELECT id FROM public.kompenzacija WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')));

-- 1.5 inventory_cost_layers
CREATE TABLE public.inventory_cost_layers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  layer_date date NOT NULL,
  quantity_remaining numeric NOT NULL,
  unit_cost numeric NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_cost_layers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage cost_layers" ON public.inventory_cost_layers FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX idx_cost_layers_product ON public.inventory_cost_layers(product_id, warehouse_id);

-- 1.6 ALTER fixed_assets
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS sale_price numeric DEFAULT 0;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS disposal_type text;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id);

-- 1.7 ALTER products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS costing_method text DEFAULT 'weighted_average';

-- 1.8 ALTER inventory_movements
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;

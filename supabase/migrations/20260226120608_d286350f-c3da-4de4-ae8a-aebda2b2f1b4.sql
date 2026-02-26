
-- ============================================
-- Phase 4: Popis (Asset Inventory Count)
-- ============================================

-- Main inventory count header
CREATE TABLE public.asset_inventory_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  count_number TEXT NOT NULL,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, in_progress, completed, posted
  description TEXT,
  location_id UUID REFERENCES public.asset_locations(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  asset_type_filter TEXT, -- NULL = all types, or fixed_asset/material_good/etc.
  total_assets INTEGER DEFAULT 0,
  found_count INTEGER DEFAULT 0,
  missing_count INTEGER DEFAULT 0,
  surplus_count INTEGER DEFAULT 0,
  surplus_amount NUMERIC(15,2) DEFAULT 0,
  shortage_amount NUMERIC(15,2) DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID,
  completed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_inventory_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.asset_inventory_counts
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_asset_inventory_counts_tenant ON public.asset_inventory_counts(tenant_id);
CREATE INDEX idx_asset_inventory_counts_year ON public.asset_inventory_counts(tenant_id, year);

-- Commission members for each count
CREATE TABLE public.asset_inventory_commission (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  count_id UUID NOT NULL REFERENCES public.asset_inventory_counts(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  role TEXT NOT NULL DEFAULT 'member', -- president, member, secretary
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_inventory_commission ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.asset_inventory_commission
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Individual asset count lines
CREATE TABLE public.asset_inventory_count_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  count_id UUID NOT NULL REFERENCES public.asset_inventory_counts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  expected BOOLEAN NOT NULL DEFAULT true, -- was the asset expected in this count?
  found BOOLEAN DEFAULT NULL, -- NULL = not yet counted, true = found, false = missing
  condition TEXT DEFAULT 'good', -- good, damaged, unusable
  book_value NUMERIC(15,2) DEFAULT 0,
  counted_value NUMERIC(15,2) DEFAULT 0, -- appraised value if different
  variance_amount NUMERIC(15,2) DEFAULT 0,
  variance_type TEXT, -- NULL, surplus, shortage
  notes TEXT,
  counted_by UUID,
  counted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_inventory_count_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.asset_inventory_count_items
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_asset_inv_items_count ON public.asset_inventory_count_items(count_id);
CREATE INDEX idx_asset_inv_items_asset ON public.asset_inventory_count_items(asset_id);

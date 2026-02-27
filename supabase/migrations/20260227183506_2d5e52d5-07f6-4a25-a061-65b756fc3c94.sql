
-- Step 6: Inventory Stock Takes
CREATE TABLE public.inventory_stock_takes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  stock_take_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'approved')),
  commission_members TEXT[] DEFAULT '{}',
  notes TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_stock_take_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_take_id UUID NOT NULL REFERENCES inventory_stock_takes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  expected_qty numeric NOT NULL DEFAULT 0,
  counted_qty numeric NOT NULL DEFAULT 0,
  difference_qty numeric GENERATED ALWAYS AS (counted_qty - expected_qty) STORED,
  unit_cost numeric NOT NULL DEFAULT 0,
  difference_value numeric GENERATED ALWAYS AS ((counted_qty - expected_qty) * unit_cost) STORED,
  notes TEXT
);

ALTER TABLE public.inventory_stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_take_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view inventory_stock_takes"
  ON public.inventory_stock_takes FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
  ));

CREATE POLICY "Tenant admins can manage inventory_stock_takes"
  ON public.inventory_stock_takes FOR ALL
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
      AND tenant_members.role IN ('admin', 'accountant')
  ));

CREATE POLICY "Tenant members can view inventory_stock_take_items"
  ON public.inventory_stock_take_items FOR SELECT
  USING (stock_take_id IN (
    SELECT st.id FROM inventory_stock_takes st
    WHERE st.tenant_id IN (
      SELECT tenant_members.tenant_id FROM tenant_members
      WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
    )
  ));

CREATE POLICY "Tenant admins can manage inventory_stock_take_items"
  ON public.inventory_stock_take_items FOR ALL
  USING (stock_take_id IN (
    SELECT st.id FROM inventory_stock_takes st
    WHERE st.tenant_id IN (
      SELECT tenant_members.tenant_id FROM tenant_members
      WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
        AND tenant_members.role IN ('admin', 'accountant')
    )
  ));

-- Step 7: Inventory Write-offs
CREATE TABLE public.inventory_write_offs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  write_off_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  commission_members TEXT[] DEFAULT '{}',
  commission_protocol_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted')),
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  total_value numeric NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_write_off_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  write_off_id UUID NOT NULL REFERENCES inventory_write_offs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  reason TEXT
);

ALTER TABLE public.inventory_write_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_write_off_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view inventory_write_offs"
  ON public.inventory_write_offs FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
  ));

CREATE POLICY "Tenant admins can manage inventory_write_offs"
  ON public.inventory_write_offs FOR ALL
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
      AND tenant_members.role IN ('admin', 'accountant')
  ));

CREATE POLICY "Tenant members can view inventory_write_off_items"
  ON public.inventory_write_off_items FOR SELECT
  USING (write_off_id IN (
    SELECT wo.id FROM inventory_write_offs wo
    WHERE wo.tenant_id IN (
      SELECT tenant_members.tenant_id FROM tenant_members
      WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
    )
  ));

CREATE POLICY "Tenant admins can manage inventory_write_off_items"
  ON public.inventory_write_off_items FOR ALL
  USING (write_off_id IN (
    SELECT wo.id FROM inventory_write_offs wo
    WHERE wo.tenant_id IN (
      SELECT tenant_members.tenant_id FROM tenant_members
      WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
        AND tenant_members.role IN ('admin', 'accountant')
    )
  ));

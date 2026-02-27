
-- =============================================================
-- Phase 3: FIFO consume_fifo_layers RPC + sef_invoices + sef_registry
-- =============================================================

-- 1. FIFO cost layer consumption function
CREATE OR REPLACE FUNCTION public.consume_fifo_layers(
  p_tenant_id UUID,
  p_product_id UUID,
  p_warehouse_id UUID,
  p_quantity NUMERIC
)
RETURNS TABLE(layer_id UUID, consumed_qty NUMERIC, unit_cost NUMERIC) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining NUMERIC := p_quantity;
  layer RECORD;
BEGIN
  FOR layer IN
    SELECT id, quantity_remaining, unit_cost
    FROM inventory_cost_layers
    WHERE tenant_id = p_tenant_id
      AND product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND quantity_remaining > 0
    ORDER BY layer_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    IF remaining <= 0 THEN EXIT; END IF;

    IF layer.quantity_remaining <= remaining THEN
      -- Consume entire layer
      UPDATE inventory_cost_layers SET quantity_remaining = 0 WHERE id = layer.id;
      layer_id := layer.id;
      consumed_qty := layer.quantity_remaining;
      unit_cost := layer.unit_cost;
      remaining := remaining - layer.quantity_remaining;
      RETURN NEXT;
    ELSE
      -- Partial consumption
      UPDATE inventory_cost_layers SET quantity_remaining = quantity_remaining - remaining WHERE id = layer.id;
      layer_id := layer.id;
      consumed_qty := remaining;
      unit_cost := layer.unit_cost;
      remaining := 0;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- If remaining > 0, not enough stock in FIFO layers (allow anyway, caller handles)
  RETURN;
END;
$$;

-- 2. SEF Incoming Invoices table (for purchase eFakture from SEF portal)
CREATE TABLE IF NOT EXISTS public.sef_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sef_invoice_id TEXT NOT NULL,
  invoice_type TEXT NOT NULL DEFAULT 'purchase',
  supplier_pib TEXT,
  supplier_name TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  currency TEXT DEFAULT 'RSD',
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  xml_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  linked_supplier_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sef_invoice_id)
);

ALTER TABLE public.sef_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view sef_invoices"
  ON public.sef_invoices FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can update sef_invoices"
  ON public.sef_invoices FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can insert sef_invoices"
  ON public.sef_invoices FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 3. SEF Registry table (government CSV of registered PIBs)
CREATE TABLE IF NOT EXISTS public.sef_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pib TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active',
  registration_date DATE,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pib)
);

ALTER TABLE public.sef_registry ENABLE ROW LEVEL SECURITY;

-- Registry is public read (all authenticated users can validate PIBs)
CREATE POLICY "Authenticated users can read sef_registry"
  ON public.sef_registry FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role / super admin can insert/update registry data
CREATE POLICY "Service role can manage sef_registry"
  ON public.sef_registry FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.tenant_members WHERE role = 'super_admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sef_invoices_tenant_status ON public.sef_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sef_registry_pib ON public.sef_registry(pib);

-- Trigger for updated_at on sef_invoices
CREATE TRIGGER update_sef_invoices_updated_at
  BEFORE UPDATE ON public.sef_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

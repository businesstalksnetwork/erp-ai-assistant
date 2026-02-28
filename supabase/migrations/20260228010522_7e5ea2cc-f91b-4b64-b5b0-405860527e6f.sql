
-- 1. Create wms_affinity_pairs table
CREATE TABLE public.wms_affinity_pairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_a_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_b_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  co_pick_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, warehouse_id, product_a_id, product_b_id)
);

ALTER TABLE public.wms_affinity_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view affinity pairs"
  ON public.wms_affinity_pairs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can manage affinity pairs"
  ON public.wms_affinity_pairs FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_wms_affinity_pairs_tenant_warehouse ON public.wms_affinity_pairs(tenant_id, warehouse_id);
CREATE INDEX idx_wms_affinity_pairs_products ON public.wms_affinity_pairs(product_a_id, product_b_id);

-- 2. Create refresh_wms_affinity_pairs RPC
CREATE OR REPLACE FUNCTION public.refresh_wms_affinity_pairs(p_tenant_id UUID, p_warehouse_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMP WITH TIME ZONE := now() - INTERVAL '90 days';
BEGIN
  WITH pick_orders AS (
    SELECT DISTINCT product_id, order_reference
    FROM wms_tasks
    WHERE tenant_id = p_tenant_id
      AND warehouse_id = p_warehouse_id
      AND task_type = 'pick'
      AND status = 'completed'
      AND completed_at >= v_cutoff
      AND product_id IS NOT NULL
      AND order_reference IS NOT NULL
  ),
  pairs AS (
    SELECT
      a.product_id AS product_a,
      b.product_id AS product_b,
      COUNT(DISTINCT a.order_reference) AS cnt
    FROM pick_orders a
    JOIN pick_orders b ON a.order_reference = b.order_reference AND a.product_id < b.product_id
    GROUP BY a.product_id, b.product_id
  )
  INSERT INTO wms_affinity_pairs (tenant_id, warehouse_id, product_a_id, product_b_id, co_pick_count, updated_at)
  SELECT p_tenant_id, p_warehouse_id, product_a, product_b, cnt, now()
  FROM pairs
  ON CONFLICT (tenant_id, warehouse_id, product_a_id, product_b_id)
  DO UPDATE SET co_pick_count = EXCLUDED.co_pick_count, updated_at = now();

  DELETE FROM wms_affinity_pairs
  WHERE tenant_id = p_tenant_id
    AND warehouse_id = p_warehouse_id
    AND updated_at < now() - INTERVAL '1 minute';
END;
$$;

-- 3. Add pick_sequence column to wms_tasks
ALTER TABLE public.wms_tasks ADD COLUMN IF NOT EXISTS pick_sequence INTEGER;

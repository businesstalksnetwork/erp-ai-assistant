
-- Item 26: WMS Product Stats precomputation table
CREATE TABLE IF NOT EXISTS public.wms_product_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  velocity_picks_per_week numeric DEFAULT 0,
  last_pick_date timestamptz,
  avg_daily_movement numeric DEFAULT 0,
  total_picks_90d int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, warehouse_id, product_id)
);

ALTER TABLE public.wms_product_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view wms_product_stats"
  ON public.wms_product_stats FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can manage wms_product_stats"
  ON public.wms_product_stats FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- RPC to refresh product stats for a warehouse
CREATE OR REPLACE FUNCTION public.refresh_wms_product_stats(p_tenant_id uuid, p_warehouse_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ninety_ago timestamptz := now() - interval '90 days';
  v_weeks numeric := 13.0;
BEGIN
  PERFORM assert_tenant_member(p_tenant_id);
  
  INSERT INTO wms_product_stats (tenant_id, warehouse_id, product_id, velocity_picks_per_week, last_pick_date, avg_daily_movement, total_picks_90d, updated_at)
  SELECT
    p_tenant_id,
    p_warehouse_id,
    t.product_id,
    ROUND(COUNT(*)::numeric / v_weeks, 2),
    MAX(t.completed_at),
    ROUND(COUNT(*)::numeric / 90.0, 2),
    COUNT(*)::int,
    now()
  FROM wms_tasks t
  WHERE t.tenant_id = p_tenant_id
    AND t.warehouse_id = p_warehouse_id
    AND t.task_type = 'pick'
    AND t.status = 'completed'
    AND t.completed_at >= v_ninety_ago
    AND t.product_id IS NOT NULL
  GROUP BY t.product_id
  ON CONFLICT (tenant_id, warehouse_id, product_id) DO UPDATE SET
    velocity_picks_per_week = EXCLUDED.velocity_picks_per_week,
    last_pick_date = EXCLUDED.last_pick_date,
    avg_daily_movement = EXCLUDED.avg_daily_movement,
    total_picks_90d = EXCLUDED.total_picks_90d,
    updated_at = now();
END;
$$;

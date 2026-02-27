
-- Dashboard widget configs table
CREATE TABLE public.dashboard_widget_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  widget_id TEXT NOT NULL,
  position_index INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4 CHECK (width BETWEEN 1 AND 12),
  height INTEGER NOT NULL DEFAULT 1 CHECK (height BETWEEN 1 AND 4),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, widget_id)
);

-- Indexes
CREATE INDEX idx_dwc_user_tenant ON public.dashboard_widget_configs(user_id, tenant_id);

-- RLS
ALTER TABLE public.dashboard_widget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own widget configs"
  ON public.dashboard_widget_configs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_dashboard_widget_configs_updated_at
  BEFORE UPDATE ON public.dashboard_widget_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default dashboard RPC
CREATE OR REPLACE FUNCTION public.seed_default_dashboard(
  p_user_id UUID,
  p_tenant_id UUID,
  p_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
  v_widgets JSONB;
BEGIN
  -- Check if user already has configs for this tenant
  SELECT EXISTS(
    SELECT 1 FROM dashboard_widget_configs
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  ) INTO v_exists;

  IF v_exists THEN RETURN; END IF;

  -- Role-based default widget layouts
  -- Format: [widget_id, position_index, width, height]
  CASE p_role
    WHEN 'admin', 'super_admin' THEN
      v_widgets := '[
        ["kpi_revenue", 0, 3, 1],
        ["kpi_expenses", 1, 3, 1],
        ["kpi_invoices", 2, 3, 1],
        ["kpi_employees", 3, 3, 1],
        ["pending_actions", 4, 6, 2],
        ["quick_actions", 5, 6, 2],
        ["revenue_expenses_chart", 6, 6, 2],
        ["invoice_status_chart", 7, 6, 2],
        ["cashflow_chart", 8, 6, 2],
        ["top_customers_chart", 9, 6, 2]
      ]'::jsonb;

    WHEN 'accountant', 'finance_director' THEN
      v_widgets := '[
        ["kpi_revenue", 0, 3, 1],
        ["kpi_expenses", 1, 3, 1],
        ["kpi_invoices", 2, 3, 1],
        ["kpi_outstanding", 3, 3, 1],
        ["revenue_expenses_chart", 4, 6, 2],
        ["invoice_status_chart", 5, 6, 2],
        ["cashflow_chart", 6, 6, 2],
        ["top_customers_chart", 7, 6, 2],
        ["quick_actions", 8, 12, 1]
      ]'::jsonb;

    WHEN 'sales', 'sales_manager', 'sales_rep' THEN
      v_widgets := '[
        ["kpi_revenue", 0, 4, 1],
        ["kpi_invoices", 1, 4, 1],
        ["kpi_opportunities", 2, 4, 1],
        ["top_customers_chart", 3, 6, 2],
        ["invoice_status_chart", 4, 6, 2],
        ["quick_actions", 5, 12, 1]
      ]'::jsonb;

    WHEN 'hr', 'hr_manager', 'hr_staff' THEN
      v_widgets := '[
        ["kpi_employees", 0, 4, 1],
        ["kpi_leave_pending", 1, 4, 1],
        ["kpi_attendance", 2, 4, 1],
        ["pending_leave", 3, 6, 2],
        ["leave_balance", 4, 6, 2],
        ["quick_actions", 5, 12, 1]
      ]'::jsonb;

    WHEN 'store', 'store_manager', 'cashier' THEN
      v_widgets := '[
        ["kpi_today_sales", 0, 4, 1],
        ["kpi_transactions", 1, 4, 1],
        ["kpi_low_stock", 2, 4, 1],
        ["today_sales", 3, 6, 2],
        ["low_stock_alert", 4, 6, 2],
        ["quick_actions", 5, 12, 1]
      ]'::jsonb;

    WHEN 'manager', 'production_manager', 'production_worker' THEN
      v_widgets := '[
        ["kpi_revenue", 0, 3, 1],
        ["kpi_production", 1, 3, 1],
        ["kpi_inventory", 2, 3, 1],
        ["kpi_employees", 3, 3, 1],
        ["pending_actions", 4, 6, 2],
        ["revenue_expenses_chart", 5, 6, 2],
        ["quick_actions", 6, 12, 1]
      ]'::jsonb;

    WHEN 'warehouse_manager', 'warehouse_worker' THEN
      v_widgets := '[
        ["kpi_inventory", 0, 4, 1],
        ["kpi_low_stock", 1, 4, 1],
        ["kpi_pending_receipts", 2, 4, 1],
        ["low_stock_alert", 3, 6, 2],
        ["quick_actions", 4, 6, 2]
      ]'::jsonb;

    ELSE
      v_widgets := '[
        ["kpi_revenue", 0, 6, 1],
        ["kpi_invoices", 1, 6, 1],
        ["quick_actions", 2, 12, 1]
      ]'::jsonb;
  END CASE;

  -- Insert widget configs
  INSERT INTO dashboard_widget_configs (user_id, tenant_id, widget_id, position_index, width, height)
  SELECT
    p_user_id,
    p_tenant_id,
    elem->>0,
    (elem->>1)::int,
    (elem->>2)::int,
    (elem->>3)::int
  FROM jsonb_array_elements(v_widgets) AS elem;
END;
$$;

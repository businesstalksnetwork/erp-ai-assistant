
-- ================================================
-- 2.3: ZPDP Tax Depreciation RPC
-- ================================================
-- Serbian ZPDP groups with declining-balance rates per Zakon o porezu na dobit pravnih lica
CREATE OR REPLACE FUNCTION public.calculate_tax_depreciation(
  p_tenant_id UUID,
  p_period TEXT -- format: YYYY-MM
)
RETURNS TABLE(
  asset_id UUID,
  asset_code TEXT,
  asset_name TEXT,
  tax_group TEXT,
  acquisition_cost NUMERIC,
  tax_depreciation_rate NUMERIC,
  accumulated_tax_depreciation NUMERIC,
  tax_net_book_value NUMERIC,
  period_tax_depreciation NUMERIC,
  accounting_depreciation NUMERIC,
  difference NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  v_period_start := (p_period || '-01')::DATE;
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  RETURN QUERY
  SELECT
    a.id AS asset_id,
    a.asset_code,
    a.name AS asset_name,
    COALESCE(fd.tax_group, 'II') AS tax_group,
    COALESCE(a.acquisition_cost, 0)::NUMERIC AS acquisition_cost,
    COALESCE(fd.tax_depreciation_rate,
      CASE COALESCE(fd.tax_group, 'II')
        WHEN 'I' THEN 2.5
        WHEN 'II' THEN 10.0
        WHEN 'III' THEN 15.0
        WHEN 'IV' THEN 20.0
        WHEN 'V' THEN 30.0
        ELSE 10.0
      END
    )::NUMERIC AS tax_depreciation_rate,
    COALESCE(fd.accumulated_tax_depreciation, 0)::NUMERIC AS accumulated_tax_depreciation,
    (COALESCE(a.acquisition_cost, 0) - COALESCE(fd.accumulated_tax_depreciation, 0))::NUMERIC AS tax_net_book_value,
    -- Monthly declining balance: (cost - accum) * rate / 100 / 12
    ROUND(
      GREATEST(0,
        (COALESCE(a.acquisition_cost, 0) - COALESCE(fd.accumulated_tax_depreciation, 0))
        * COALESCE(fd.tax_depreciation_rate,
            CASE COALESCE(fd.tax_group, 'II')
              WHEN 'I' THEN 2.5 WHEN 'II' THEN 10.0 WHEN 'III' THEN 15.0
              WHEN 'IV' THEN 20.0 WHEN 'V' THEN 30.0 ELSE 10.0
            END
          ) / 100.0 / 12.0
      ), 2
    )::NUMERIC AS period_tax_depreciation,
    -- Accounting depreciation for comparison
    COALESCE(
      (SELECT SUM(ds.depreciation_amount) FROM fixed_asset_depreciation_schedules ds
       WHERE ds.asset_id = a.id AND ds.period_start >= v_period_start AND ds.period_start <= v_period_end),
      0
    )::NUMERIC AS accounting_depreciation,
    -- Difference: tax - accounting (positive = tax shield, negative = taxable)
    (ROUND(
      GREATEST(0,
        (COALESCE(a.acquisition_cost, 0) - COALESCE(fd.accumulated_tax_depreciation, 0))
        * COALESCE(fd.tax_depreciation_rate,
            CASE COALESCE(fd.tax_group, 'II')
              WHEN 'I' THEN 2.5 WHEN 'II' THEN 10.0 WHEN 'III' THEN 15.0
              WHEN 'IV' THEN 20.0 WHEN 'V' THEN 30.0 ELSE 10.0
            END
          ) / 100.0 / 12.0
      ), 2
    ) - COALESCE(
      (SELECT SUM(ds.depreciation_amount) FROM fixed_asset_depreciation_schedules ds
       WHERE ds.asset_id = a.id AND ds.period_start >= v_period_start AND ds.period_start <= v_period_end),
      0
    ))::NUMERIC AS difference
  FROM assets a
  LEFT JOIN fixed_asset_details fd ON fd.asset_id = a.id
  WHERE a.tenant_id = p_tenant_id
    AND a.asset_type IN ('fixed_asset', 'intangible')
    AND a.status IN ('active', 'in_use')
  ORDER BY a.asset_code;
END;
$$;

-- ================================================
-- 2.4: PB-1 Poreski Bilans tables
-- ================================================
CREATE TABLE IF NOT EXISTS public.pb1_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, year, legal_entity_id)
);

ALTER TABLE public.pb1_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pb1_submissions_tenant_access" ON public.pb1_submissions
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE TABLE IF NOT EXISTS public.pb1_line_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES pb1_submissions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  line_label TEXT NOT NULL,
  auto_amount NUMERIC DEFAULT 0,
  manual_adjustment NUMERIC DEFAULT 0,
  final_amount NUMERIC GENERATED ALWAYS AS (auto_amount + manual_adjustment) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, line_number)
);

ALTER TABLE public.pb1_line_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pb1_line_values_tenant_access" ON public.pb1_line_values
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Trigger for updated_at on pb1_submissions
CREATE TRIGGER update_pb1_submissions_updated_at
  BEFORE UPDATE ON public.pb1_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

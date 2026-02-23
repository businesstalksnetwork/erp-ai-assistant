-- ============================================================
-- Serbian Financial Reports (Bilans uspeha, Bilans stanja)
-- Official Serbian format per accounting law 2026
-- ============================================================

-- =============================================
-- 1. BILANS USPEHA (Income Statement) - Serbian Format
-- =============================================

CREATE OR REPLACE FUNCTION public.get_bilans_uspeha(
  p_tenant_id UUID,
  p_date_from DATE,
  p_date_to DATE,
  p_legal_entity_id UUID DEFAULT NULL
)
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_name_sr TEXT,
  account_class TEXT, -- '5' (Prihodi) or '6' (Rashodi)
  section TEXT, -- Section within class (e.g., '51', '52', '61', '62')
  amount NUMERIC,
  sort_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  
  RETURN QUERY
  WITH journal_data AS (
    SELECT
      coa.code,
      coa.name,
      coa.name_sr,
      coa.account_type,
      SUBSTRING(coa.code, 1, 1) AS account_class,
      SUBSTRING(coa.code, 1, 2) AS section,
      SUM(CASE 
        WHEN coa.account_type = 'revenue' THEN jl.credit - jl.debit
        WHEN coa.account_type = 'expense' THEN jl.debit - jl.credit
        ELSE 0
      END) AS balance
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    INNER JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE je.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date >= p_date_from
      AND je.entry_date <= p_date_to
      AND coa.account_type IN ('revenue', 'expense')
      AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    GROUP BY coa.id, coa.code, coa.name, coa.name_sr, coa.account_type
    HAVING ABS(SUM(CASE 
      WHEN coa.account_type = 'revenue' THEN jl.credit - jl.debit
      WHEN coa.account_type = 'expense' THEN jl.debit - jl.credit
      ELSE 0
    END)) > 0.01
  )
  SELECT
    jd.code::TEXT AS account_code,
    COALESCE(jd.name_sr, jd.name)::TEXT AS account_name,
    jd.name_sr::TEXT AS account_name_sr,
    jd.account_class::TEXT,
    jd.section::TEXT,
    jd.balance AS amount,
    CASE 
      WHEN jd.account_class = '5' THEN 1000 + CAST(jd.section AS INTEGER) -- Prihodi first
      WHEN jd.account_class = '6' THEN 2000 + CAST(jd.section AS INTEGER) -- Rashodi second
      ELSE 9999
    END AS sort_order
  FROM journal_data jd
  ORDER BY sort_order, jd.code;
END;
$$;

-- =============================================
-- 2. BILANS STANJA (Balance Sheet) - Serbian Format
-- =============================================

CREATE OR REPLACE FUNCTION public.get_bilans_stanja(
  p_tenant_id UUID,
  p_as_of_date DATE,
  p_legal_entity_id UUID DEFAULT NULL
)
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_name_sr TEXT,
  account_class TEXT, -- '0', '1', '2', '3', '4'
  section TEXT, -- Section within class (e.g., '01', '02', '11', '12')
  account_type TEXT, -- 'asset', 'liability', 'equity'
  balance NUMERIC,
  sort_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  
  RETURN QUERY
  WITH journal_data AS (
    SELECT
      coa.code,
      coa.name,
      coa.name_sr,
      coa.account_type,
      SUBSTRING(coa.code, 1, 1) AS account_class,
      SUBSTRING(coa.code, 1, 2) AS section,
      SUM(CASE 
        WHEN coa.account_type = 'asset' THEN jl.debit - jl.credit
        WHEN coa.account_type IN ('liability', 'equity') THEN jl.credit - jl.debit
        ELSE 0
      END) AS balance
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    INNER JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE je.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date <= p_as_of_date
      AND coa.account_type IN ('asset', 'liability', 'equity')
      AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    GROUP BY coa.id, coa.code, coa.name, coa.name_sr, coa.account_type
    HAVING ABS(SUM(CASE 
      WHEN coa.account_type = 'asset' THEN jl.debit - jl.credit
      WHEN coa.account_type IN ('liability', 'equity') THEN jl.credit - jl.debit
      ELSE 0
    END)) > 0.01
  )
  SELECT
    jd.code::TEXT AS account_code,
    COALESCE(jd.name_sr, jd.name)::TEXT AS account_name,
    jd.name_sr::TEXT AS account_name_sr,
    jd.account_class::TEXT,
    jd.section::TEXT,
    jd.account_type::TEXT,
    jd.balance,
    CASE 
      WHEN jd.account_class = '0' THEN 1000 + CAST(jd.section AS INTEGER) -- Dugotrajna imovina
      WHEN jd.account_class = '1' THEN 2000 + CAST(jd.section AS INTEGER) -- Kratkotrajna imovina
      WHEN jd.account_class = '2' THEN 3000 + CAST(jd.section AS INTEGER) -- Kratkoročne obaveze
      WHEN jd.account_class = '3' THEN 4000 + CAST(jd.section AS INTEGER) -- Dugoročne obaveze
      WHEN jd.account_class = '4' THEN 5000 + CAST(jd.section AS INTEGER) -- Kapital i rezerve
      ELSE 9999
    END AS sort_order
  FROM journal_data jd
  ORDER BY sort_order, jd.code;
END;
$$;

-- =============================================
-- 3. SUMMARY TOTALS FOR BILANS USPEHA
-- =============================================

CREATE OR REPLACE FUNCTION public.get_bilans_uspeha_totals(
  p_tenant_id UUID,
  p_date_from DATE,
  p_date_to DATE,
  p_legal_entity_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_revenue NUMERIC,
  total_expenses NUMERIC,
  net_income NUMERIC,
  revenue_sections JSONB,
  expense_sections JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue NUMERIC := 0;
  v_expenses NUMERIC := 0;
  v_sections JSONB := '[]'::jsonb;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  
  -- Calculate totals by section
  WITH section_totals AS (
    SELECT
      SUBSTRING(coa.code, 1, 2) AS section,
      coa.account_type,
      SUM(CASE 
        WHEN coa.account_type = 'revenue' THEN jl.credit - jl.debit
        WHEN coa.account_type = 'expense' THEN jl.debit - jl.credit
        ELSE 0
      END) AS section_total
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    INNER JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE je.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date >= p_date_from
      AND je.entry_date <= p_date_to
      AND coa.account_type IN ('revenue', 'expense')
      AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    GROUP BY SUBSTRING(coa.code, 1, 2), coa.account_type
    HAVING ABS(SUM(CASE 
      WHEN coa.account_type = 'revenue' THEN jl.credit - jl.debit
      WHEN coa.account_type = 'expense' THEN jl.debit - jl.credit
      ELSE 0
    END)) > 0.01
  )
  SELECT
    COALESCE(SUM(CASE WHEN account_type = 'revenue' THEN section_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_type = 'expense' THEN section_total ELSE 0 END), 0),
    jsonb_agg(
      jsonb_build_object(
        'section', section,
        'account_type', account_type,
        'total', section_total
      )
    ) FILTER (WHERE account_type = 'revenue')
  INTO v_revenue, v_expenses, v_sections
  FROM section_totals;
  
  -- Get expense sections separately
  WITH section_totals AS (
    SELECT
      SUBSTRING(coa.code, 1, 2) AS section,
      SUM(jl.debit - jl.credit) AS section_total
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    INNER JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE je.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date >= p_date_from
      AND je.entry_date <= p_date_to
      AND coa.account_type = 'expense'
      AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    GROUP BY SUBSTRING(coa.code, 1, 2)
    HAVING ABS(SUM(jl.debit - jl.credit)) > 0.01
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'section', section,
      'total', section_total
    )
  ) INTO v_sections
  FROM section_totals;
  
  RETURN QUERY SELECT
    v_revenue AS total_revenue,
    v_expenses AS total_expenses,
    v_revenue - v_expenses AS net_income,
    (SELECT jsonb_agg(s) FROM jsonb_array_elements(v_sections) s WHERE s->>'account_type' = 'revenue') AS revenue_sections,
    (SELECT jsonb_agg(s) FROM jsonb_array_elements(v_sections) s WHERE s->>'account_type' = 'expense') AS expense_sections;
END;
$$;

-- =============================================
-- 4. SUMMARY TOTALS FOR BILANS STANJA
-- =============================================

CREATE OR REPLACE FUNCTION public.get_bilans_stanja_totals(
  p_tenant_id UUID,
  p_as_of_date DATE,
  p_legal_entity_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_assets NUMERIC,
  total_current_assets NUMERIC,
  total_fixed_assets NUMERIC,
  total_liabilities NUMERIC,
  total_current_liabilities NUMERIC,
  total_long_term_liabilities NUMERIC,
  total_equity NUMERIC,
  is_balanced BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assets NUMERIC := 0;
  v_current_assets NUMERIC := 0;
  v_fixed_assets NUMERIC := 0;
  v_liabilities NUMERIC := 0;
  v_current_liabilities NUMERIC := 0;
  v_long_term_liabilities NUMERIC := 0;
  v_equity NUMERIC := 0;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);
  
  -- Calculate totals by class
  WITH class_totals AS (
    SELECT
      SUBSTRING(coa.code, 1, 1) AS account_class,
      coa.account_type,
      SUM(CASE 
        WHEN coa.account_type = 'asset' THEN jl.debit - jl.credit
        WHEN coa.account_type IN ('liability', 'equity') THEN jl.credit - jl.debit
        ELSE 0
      END) AS class_total
    FROM journal_lines jl
    INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
    INNER JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE je.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date <= p_as_of_date
      AND coa.account_type IN ('asset', 'liability', 'equity')
      AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    GROUP BY SUBSTRING(coa.code, 1, 1), coa.account_type
    HAVING ABS(SUM(CASE 
      WHEN coa.account_type = 'asset' THEN jl.debit - jl.credit
      WHEN coa.account_type IN ('liability', 'equity') THEN jl.credit - jl.debit
      ELSE 0
    END)) > 0.01
  )
  SELECT
    COALESCE(SUM(CASE WHEN account_type = 'asset' THEN class_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_class = '1' AND account_type = 'asset' THEN class_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_class = '0' AND account_type = 'asset' THEN class_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_type = 'liability' THEN class_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_class = '2' AND account_type = 'liability' THEN class_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_class = '3' AND account_type = 'liability' THEN class_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN account_type = 'equity' THEN class_total ELSE 0 END), 0)
  INTO v_assets, v_current_assets, v_fixed_assets, v_liabilities, v_current_liabilities, v_long_term_liabilities, v_equity
  FROM class_totals;
  
  RETURN QUERY SELECT
    v_assets AS total_assets,
    v_current_assets AS total_current_assets,
    v_fixed_assets AS total_fixed_assets,
    v_liabilities AS total_liabilities,
    v_current_liabilities AS total_current_liabilities,
    v_long_term_liabilities AS total_long_term_liabilities,
    v_equity AS total_equity,
    ABS(v_assets - (v_liabilities + v_equity)) < 0.01 AS is_balanced;
END;
$$;

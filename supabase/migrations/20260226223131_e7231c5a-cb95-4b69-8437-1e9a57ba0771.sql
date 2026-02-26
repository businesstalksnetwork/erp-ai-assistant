-- BRK-3: Fix calculate_depreciation_batch RPC to use correct table/column names
CREATE OR REPLACE FUNCTION public.calculate_depreciation_batch(
  p_tenant_id UUID,
  p_period_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(asset_id UUID, depreciation_amount NUMERIC, journal_entry_id UUID) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_asset RECORD;
  v_monthly_dep NUMERIC;
  v_je_id UUID;
  v_entry_number TEXT;
  v_dep_account_id UUID;
  v_expense_account_id UUID;
BEGIN
  -- Find the accumulated depreciation account (0290 or similar)
  SELECT id INTO v_dep_account_id FROM chart_of_accounts 
    WHERE tenant_id = p_tenant_id AND code = '0290' AND is_active = true LIMIT 1;
  -- Find the depreciation expense account (5400 or similar)
  SELECT id INTO v_expense_account_id FROM chart_of_accounts 
    WHERE tenant_id = p_tenant_id AND code = '5400' AND is_active = true LIMIT 1;

  IF v_dep_account_id IS NULL OR v_expense_account_id IS NULL THEN
    RAISE EXCEPTION 'Depreciation accounts 0290 and/or 5400 not found in chart of accounts';
  END IF;

  FOR v_asset IN
    SELECT a.id, a.name AS asset_name, a.acquisition_cost, 
           a.residual_value AS salvage_value,
           fd.useful_life_months,
           fd.depreciation_start_date, 
           fd.accumulated_depreciation
    FROM assets a
    JOIN fixed_asset_details fd ON fd.asset_id = a.id AND fd.tenant_id = a.tenant_id
    WHERE a.tenant_id = p_tenant_id
      AND a.status IN ('active', 'in_use')
      AND a.asset_type IN ('fixed_asset', 'intangible')
      AND fd.depreciation_start_date <= p_period_date
      AND fd.is_fully_depreciated = false
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je 
        WHERE je.tenant_id = p_tenant_id 
          AND je.reference = 'DEP-' || a.id::text 
          AND date_trunc('month', je.entry_date) = date_trunc('month', p_period_date)
      )
  LOOP
    v_monthly_dep := ROUND((v_asset.acquisition_cost - COALESCE(v_asset.salvage_value, 0)) / GREATEST(v_asset.useful_life_months, 1), 2);
    
    -- Skip if fully depreciated
    IF COALESCE(v_asset.accumulated_depreciation, 0) + v_monthly_dep > (v_asset.acquisition_cost - COALESCE(v_asset.salvage_value, 0)) THEN
      v_monthly_dep := GREATEST((v_asset.acquisition_cost - COALESCE(v_asset.salvage_value, 0)) - COALESCE(v_asset.accumulated_depreciation, 0), 0);
    END IF;
    
    IF v_monthly_dep <= 0 THEN CONTINUE; END IF;

    v_entry_number := 'DEP-' || to_char(p_period_date, 'YYMM') || '-' || substr(v_asset.id::text, 1, 8);

    INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, created_by)
    VALUES (p_tenant_id, v_entry_number, p_period_date, 
            'Amortizacija: ' || v_asset.asset_name, 
            'DEP-' || v_asset.id::text, 'posted', auth.uid())
    RETURNING id INTO v_je_id;

    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES 
      (v_je_id, v_expense_account_id, v_monthly_dep, 0, 'Trošak amortizacije - ' || v_asset.asset_name, 1),
      (v_je_id, v_dep_account_id, 0, v_monthly_dep, 'Ispravka vrednosti - ' || v_asset.asset_name, 2);

    -- Update fixed_asset_details accumulated depreciation and net book value
    UPDATE fixed_asset_details 
    SET accumulated_depreciation = COALESCE(accumulated_depreciation, 0) + v_monthly_dep,
        net_book_value = v_asset.acquisition_cost - (COALESCE(v_asset.accumulated_depreciation, 0) + v_monthly_dep),
        last_depreciation_date = p_period_date,
        is_fully_depreciated = CASE 
          WHEN (COALESCE(v_asset.accumulated_depreciation, 0) + v_monthly_dep) >= (v_asset.acquisition_cost - COALESCE(v_asset.salvage_value, 0)) 
          THEN true ELSE false END,
        updated_at = now()
    WHERE asset_id = v_asset.id AND tenant_id = p_tenant_id;

    -- Update current_value on assets table
    UPDATE assets SET current_value = v_asset.acquisition_cost - (COALESCE(v_asset.accumulated_depreciation, 0) + v_monthly_dep), updated_at = now()
    WHERE id = v_asset.id;

    asset_id := v_asset.id;
    depreciation_amount := v_monthly_dep;
    journal_entry_id := v_je_id;
    RETURN NEXT;
  END LOOP;
END;
$$;
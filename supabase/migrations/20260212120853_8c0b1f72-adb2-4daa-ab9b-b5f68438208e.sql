
-- Add enhanced partner fields
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 30;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'RSD';
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS contact_person text;

-- Update seed function to include WIP and Finished Goods accounts
CREATE OR REPLACE FUNCTION public.seed_tenant_chart_of_accounts(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, level, is_system, is_active)
  VALUES
    (_tenant_id, '1000', 'Cash and Bank', 'Gotovina i banka', 'asset', 1, true, true),
    (_tenant_id, '1200', 'Accounts Receivable', 'Potraživanja od kupaca', 'asset', 1, true, true),
    (_tenant_id, '2100', 'Accounts Payable', 'Obaveze prema dobavljačima', 'liability', 1, true, true),
    (_tenant_id, '4700', 'Tax Payable (VAT)', 'Obaveze za PDV', 'liability', 1, true, true),
    (_tenant_id, '3000', 'Equity', 'Kapital', 'equity', 1, true, true),
    (_tenant_id, '5000', 'Work in Progress', 'Proizvodnja u toku', 'asset', 1, true, true),
    (_tenant_id, '5100', 'Finished Goods', 'Gotovi proizvodi', 'asset', 1, true, true),
    (_tenant_id, '6000', 'Sales Revenue', 'Prihodi od prodaje', 'revenue', 1, true, true),
    (_tenant_id, '7000', 'Cost of Goods Sold', 'Nabavna vrednost prodate robe', 'expense', 1, true, true),
    (_tenant_id, '8000', 'General Expenses', 'Opšti troškovi', 'expense', 1, true, true)
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Seed WIP/FG accounts for all existing tenants
INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, level, is_system, is_active)
SELECT t.id, '5000', 'Work in Progress', 'Proizvodnja u toku', 'asset', 1, true, true
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.tenant_id = t.id AND c.code = '5000');

INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, level, is_system, is_active)
SELECT t.id, '5100', 'Finished Goods', 'Gotovi proizvodi', 'asset', 1, true, true
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.tenant_id = t.id AND c.code = '5100');

-- Create fiscal period check function
CREATE OR REPLACE FUNCTION public.check_fiscal_period_open(p_tenant_id uuid, p_entry_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period RECORD;
BEGIN
  SELECT * INTO v_period FROM public.fiscal_periods
  WHERE tenant_id = p_tenant_id
    AND p_entry_date >= start_date::date
    AND p_entry_date <= end_date::date
  LIMIT 1;

  IF v_period IS NOT NULL AND v_period.status IN ('closed', 'locked') THEN
    RAISE EXCEPTION 'Cannot post to closed/locked fiscal period: %', v_period.name;
  END IF;

  RETURN v_period.id;
END;
$function$;

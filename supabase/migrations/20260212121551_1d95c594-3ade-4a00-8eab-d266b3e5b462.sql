
-- Seed missing accounts for Phase 17 (depreciation, disposal, revenue)
-- Add to seed function for future tenants
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
    (_tenant_id, '1290', 'Accumulated Depreciation', 'Ispravka vrednosti', 'asset', 1, true, true),
    (_tenant_id, '2100', 'Accounts Payable', 'Obaveze prema dobavljačima', 'liability', 1, true, true),
    (_tenant_id, '4000', 'Revenue', 'Prihodi od prodaje', 'revenue', 1, true, true),
    (_tenant_id, '4200', 'Gain on Disposal', 'Dobici od prodaje sredstava', 'revenue', 1, true, true),
    (_tenant_id, '4700', 'Tax Payable (VAT)', 'Obaveze za PDV', 'liability', 1, true, true),
    (_tenant_id, '3000', 'Equity', 'Kapital', 'equity', 1, true, true),
    (_tenant_id, '5000', 'Work in Progress', 'Proizvodnja u toku', 'asset', 1, true, true),
    (_tenant_id, '5100', 'Finished Goods', 'Gotovi proizvodi', 'asset', 1, true, true),
    (_tenant_id, '6000', 'Sales Revenue', 'Prihodi od prodaje', 'revenue', 1, true, true),
    (_tenant_id, '7000', 'Cost of Goods Sold', 'Nabavna vrednost prodate robe', 'expense', 1, true, true),
    (_tenant_id, '8000', 'General Expenses', 'Opšti troškovi', 'expense', 1, true, true),
    (_tenant_id, '8100', 'Depreciation Expense', 'Amortizacija', 'expense', 1, true, true),
    (_tenant_id, '8200', 'Loss on Disposal', 'Gubici od rashodovanja', 'expense', 1, true, true)
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Seed new accounts for all existing tenants
INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, level, is_system, is_active)
SELECT t.id, v.code, v.name, v.name_sr, v.account_type, 1, true, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('1290', 'Accumulated Depreciation', 'Ispravka vrednosti', 'asset'),
  ('4000', 'Revenue', 'Prihodi od prodaje', 'revenue'),
  ('4200', 'Gain on Disposal', 'Dobici od prodaje sredstava', 'revenue'),
  ('8100', 'Depreciation Expense', 'Amortizacija', 'expense'),
  ('8200', 'Loss on Disposal', 'Gubici od rashodovanja', 'expense')
) AS v(code, name, name_sr, account_type)
ON CONFLICT DO NOTHING;

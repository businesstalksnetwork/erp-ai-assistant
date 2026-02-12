
-- Create loan_payments table
CREATE TABLE public.loan_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  principal_amount NUMERIC NOT NULL DEFAULT 0,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view loan payments for their tenants"
  ON public.loan_payments FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert loan payments for their tenants"
  ON public.loan_payments FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Update seed function to include new accounts
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
    (_tenant_id, '1300', 'Loans Receivable', 'Potraživanja po kreditima', 'asset', 1, true, true),
    (_tenant_id, '1800', 'Prepaid Expenses', 'Unapred plaćeni troškovi', 'asset', 1, true, true),
    (_tenant_id, '2100', 'Accounts Payable', 'Obaveze prema dobavljačima', 'liability', 1, true, true),
    (_tenant_id, '2200', 'Loans Payable', 'Obaveze po kreditima', 'liability', 1, true, true),
    (_tenant_id, '2500', 'Deferred Revenue', 'Razgraničeni prihodi', 'liability', 1, true, true),
    (_tenant_id, '4000', 'Revenue', 'Prihodi od prodaje', 'revenue', 1, true, true),
    (_tenant_id, '4100', 'Interest Income', 'Prihodi od kamata', 'revenue', 1, true, true),
    (_tenant_id, '4200', 'Gain on Disposal', 'Dobici od prodaje sredstava', 'revenue', 1, true, true),
    (_tenant_id, '4700', 'Tax Payable (VAT)', 'Obaveze za PDV', 'liability', 1, true, true),
    (_tenant_id, '3000', 'Equity', 'Kapital', 'equity', 1, true, true),
    (_tenant_id, '5000', 'Work in Progress', 'Proizvodnja u toku', 'asset', 1, true, true),
    (_tenant_id, '5100', 'Finished Goods', 'Gotovi proizvodi', 'asset', 1, true, true),
    (_tenant_id, '6000', 'Sales Revenue', 'Prihodi od prodaje', 'revenue', 1, true, true),
    (_tenant_id, '7000', 'Cost of Goods Sold', 'Nabavna vrednost prodate robe', 'expense', 1, true, true),
    (_tenant_id, '8000', 'General Expenses', 'Opšti troškovi', 'expense', 1, true, true),
    (_tenant_id, '8100', 'Depreciation Expense', 'Amortizacija', 'expense', 1, true, true),
    (_tenant_id, '8200', 'Loss on Disposal', 'Gubici od rashodovanja', 'expense', 1, true, true),
    (_tenant_id, '8300', 'Interest Expense', 'Rashodi kamata', 'expense', 1, true, true)
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Seed new accounts for all existing tenants
INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, level, is_system, is_active)
SELECT t.id, v.code, v.name, v.name_sr, v.account_type, 1, true, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('1300', 'Loans Receivable', 'Potraživanja po kreditima', 'asset'),
  ('1800', 'Prepaid Expenses', 'Unapred plaćeni troškovi', 'asset'),
  ('2200', 'Loans Payable', 'Obaveze po kreditima', 'liability'),
  ('2500', 'Deferred Revenue', 'Razgraničeni prihodi', 'liability'),
  ('4100', 'Interest Income', 'Prihodi od kamata', 'revenue'),
  ('8300', 'Interest Expense', 'Rashodi kamata', 'expense')
) AS v(code, name, name_sr, account_type)
ON CONFLICT DO NOTHING;

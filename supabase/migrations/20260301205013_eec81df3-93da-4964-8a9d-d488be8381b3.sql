-- Phase 1: Drop dangerous function overloads

-- CR3-01: Drop 2-arg payroll stub that produces net_salary=0, tax_amount=0
DROP FUNCTION IF EXISTS public.calculate_payroll_for_run(uuid, uuid);

-- CR3-02: Drop old 4-arg POS overload (uuid, uuid, uuid, jsonb)
-- Keep the correct one: (p_tenant_id uuid, p_transaction_id uuid, p_fiscal_receipt_number text, p_fiscal_receipt_date timestamptz)
DROP FUNCTION IF EXISTS public.complete_pos_transaction(uuid, uuid, uuid, jsonb);
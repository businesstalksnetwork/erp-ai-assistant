
-- Phase 7: IOS Balance Confirmations + Performance Indexes

-- IOS Balance Confirmations
CREATE TABLE IF NOT EXISTS public.ios_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  partner_id UUID NOT NULL REFERENCES partners(id),
  legal_entity_id UUID REFERENCES legal_entities(id),
  confirmation_number TEXT NOT NULL,
  confirmation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  our_receivable NUMERIC DEFAULT 0,
  our_payable NUMERIC DEFAULT 0,
  partner_receivable NUMERIC DEFAULT 0,
  partner_payable NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'RSD',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','disputed','expired')),
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, confirmation_number)
);

ALTER TABLE public.ios_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view IOS confirmations"
  ON public.ios_confirmations FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can manage IOS confirmations"
  ON public.ios_confirmations FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RPC to calculate partner balance for IOS
CREATE OR REPLACE FUNCTION public.get_partner_ios_balance(
  p_tenant_id UUID,
  p_partner_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE,
  p_legal_entity_id UUID DEFAULT NULL
)
RETURNS TABLE(
  receivable_total NUMERIC,
  payable_total NUMERIC,
  open_invoices BIGINT,
  open_bills BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(i.total_amount - COALESCE(i.paid_amount, 0))
      FROM invoices i
      WHERE i.tenant_id = p_tenant_id AND i.partner_id = p_partner_id
        AND i.status IN ('sent','overdue','partially_paid')
        AND i.invoice_date <= p_as_of_date
        AND (p_legal_entity_id IS NULL OR i.legal_entity_id = p_legal_entity_id)
    ), 0)::NUMERIC AS receivable_total,
    COALESCE((SELECT SUM(si.total_amount - COALESCE(si.paid_amount, 0))
      FROM supplier_invoices si
      WHERE si.tenant_id = p_tenant_id AND si.partner_id = p_partner_id
        AND si.status IN ('approved','overdue','partially_paid')
        AND si.invoice_date <= p_as_of_date
        AND (p_legal_entity_id IS NULL OR si.legal_entity_id = p_legal_entity_id)
    ), 0)::NUMERIC AS payable_total,
    (SELECT COUNT(*) FROM invoices i
      WHERE i.tenant_id = p_tenant_id AND i.partner_id = p_partner_id
        AND i.status IN ('sent','overdue','partially_paid')
        AND i.invoice_date <= p_as_of_date
    )::BIGINT AS open_invoices,
    (SELECT COUNT(*) FROM supplier_invoices si
      WHERE si.tenant_id = p_tenant_id AND si.partner_id = p_partner_id
        AND si.status IN ('approved','overdue','partially_paid')
        AND si.invoice_date <= p_as_of_date
    )::BIGINT AS open_bills;
END;
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_aop_positions_tenant_type ON public.aop_positions(tenant_id, report_type);
CREATE INDEX IF NOT EXISTS idx_overtime_hours_employee_year ON public.overtime_hours(tenant_id, employee_id, year);
CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON public.credit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_tenant ON public.debit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ios_confirmations_tenant_partner ON public.ios_confirmations(tenant_id, partner_id);
CREATE INDEX IF NOT EXISTS idx_ios_confirmations_status ON public.ios_confirmations(tenant_id, status);

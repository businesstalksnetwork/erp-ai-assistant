
-- =====================================================
-- Revers (Asset Handover Document) table
-- =====================================================

CREATE TABLE public.asset_reverses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  assignment_id UUID REFERENCES public.asset_assignments(id),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  employee_id UUID REFERENCES public.employees(id),
  
  -- Document info
  revers_number TEXT NOT NULL,
  revers_date DATE NOT NULL DEFAULT CURRENT_DATE,
  revers_type TEXT NOT NULL DEFAULT 'handover' CHECK (revers_type IN ('handover', 'return')),
  
  -- Content
  description TEXT,
  condition_on_handover TEXT,
  accessories TEXT,
  notes TEXT,
  
  -- Signature workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'signed', 'rejected', 'cancelled')),
  issued_by UUID REFERENCES auth.users(id),
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  signature_ip TEXT,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.asset_reverses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.asset_reverses
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Updated_at trigger
CREATE TRIGGER update_asset_reverses_updated_at
  BEFORE UPDATE ON public.asset_reverses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_asset_reverses_tenant ON public.asset_reverses(tenant_id);
CREATE INDEX idx_asset_reverses_asset ON public.asset_reverses(asset_id);
CREATE INDEX idx_asset_reverses_employee ON public.asset_reverses(employee_id);
CREATE INDEX idx_asset_reverses_status ON public.asset_reverses(status);

-- Sequence for revers numbering per tenant+year
CREATE OR REPLACE FUNCTION public.generate_revers_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN revers_number ~ ('^REV-' || v_year || '-\d+$')
    THEN SUBSTRING(revers_number FROM '\d+$')::INT ELSE 0 END
  ), 0) + 1
  INTO v_seq
  FROM asset_reverses
  WHERE tenant_id = p_tenant_id;
  
  RETURN 'REV-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

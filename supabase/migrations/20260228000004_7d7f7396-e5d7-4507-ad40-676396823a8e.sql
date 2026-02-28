-- Bug 3: Add legal_entity_id to payroll_runs for multi-PIB GL posting
ALTER TABLE public.payroll_runs 
ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES public.legal_entities(id);

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_payroll_runs_legal_entity ON public.payroll_runs(legal_entity_id);

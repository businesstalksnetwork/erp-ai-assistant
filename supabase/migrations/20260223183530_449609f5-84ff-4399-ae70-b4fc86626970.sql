
-- Delete corrupted payroll_parameters rows where rates were stored as raw percentages (e.g. 14 instead of 0.14)
DELETE FROM public.payroll_parameters
WHERE tax_rate >= 1;

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.payroll_parameters
ADD CONSTRAINT uq_payroll_parameters_tenant_effective UNIQUE (tenant_id, effective_from);

-- Phase 5: Bugs 6 & 10 — Add missing payroll parameter columns
ALTER TABLE public.payroll_parameters
  ADD COLUMN IF NOT EXISTS unemployment_employer_rate numeric DEFAULT 0.0075,
  ADD COLUMN IF NOT EXISTS holiday_multiplier numeric DEFAULT 1.10,
  ADD COLUMN IF NOT EXISTS sickness_rate_employer numeric DEFAULT 0.65,
  ADD COLUMN IF NOT EXISTS annual_leave_daily_rate numeric DEFAULT 0;
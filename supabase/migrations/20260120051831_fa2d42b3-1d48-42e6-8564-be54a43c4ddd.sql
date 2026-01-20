-- Add is_foreign column to fiscal_entries table
ALTER TABLE public.fiscal_entries 
ADD COLUMN is_foreign BOOLEAN NOT NULL DEFAULT false;

-- Add domestic_amount and foreign_amount columns to fiscal_daily_summary table
ALTER TABLE public.fiscal_daily_summary 
ADD COLUMN domestic_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN foreign_amount NUMERIC NOT NULL DEFAULT 0;

-- Update existing daily summaries to set domestic_amount equal to total_amount (all existing data is domestic)
UPDATE public.fiscal_daily_summary 
SET domestic_amount = total_amount, foreign_amount = 0;
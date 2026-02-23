-- Create fiscal_entries table for storing fiscal cash register data
CREATE TABLE public.fiscal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  business_name TEXT,
  receipt_number TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Продаја', 'Рефундација')),
  amount NUMERIC NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, receipt_number)
);

-- Enable RLS
ALTER TABLE public.fiscal_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own fiscal entries"
  ON public.fiscal_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = fiscal_entries.company_id
      AND companies.user_id = auth.uid()
    ) AND is_approved(auth.uid())
  );

CREATE POLICY "Bookkeepers can view client fiscal entries"
  ON public.fiscal_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = fiscal_entries.company_id
      AND is_bookkeeper_for(c.user_id)
    ) AND is_approved(auth.uid())
  );

CREATE POLICY "Require authentication for fiscal_entries"
  ON public.fiscal_entries
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create daily fiscal KPO entries table
CREATE TABLE public.fiscal_daily_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  sales_amount NUMERIC NOT NULL DEFAULT 0,
  refunds_amount NUMERIC NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  kpo_entry_id UUID REFERENCES public.kpo_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, summary_date)
);

-- Enable RLS for daily summary
ALTER TABLE public.fiscal_daily_summary ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily summary
CREATE POLICY "Users can manage own fiscal daily summary"
  ON public.fiscal_daily_summary
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = fiscal_daily_summary.company_id
      AND companies.user_id = auth.uid()
    ) AND is_approved(auth.uid())
  );

CREATE POLICY "Bookkeepers can view client fiscal daily summary"
  ON public.fiscal_daily_summary
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = fiscal_daily_summary.company_id
      AND is_bookkeeper_for(c.user_id)
    ) AND is_approved(auth.uid())
  );

CREATE POLICY "Require authentication for fiscal_daily_summary"
  ON public.fiscal_daily_summary
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
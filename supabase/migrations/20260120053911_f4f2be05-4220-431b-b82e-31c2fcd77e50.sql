-- Add RLS policies for bookkeepers to manage fiscal_entries
CREATE POLICY "Bookkeepers can insert client fiscal entries"
ON public.fiscal_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = fiscal_entries.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

CREATE POLICY "Bookkeepers can update client fiscal entries"
ON public.fiscal_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = fiscal_entries.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

CREATE POLICY "Bookkeepers can delete client fiscal entries"
ON public.fiscal_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = fiscal_entries.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

-- Add RLS policies for bookkeepers to manage fiscal_daily_summary
CREATE POLICY "Bookkeepers can insert client fiscal daily summary"
ON public.fiscal_daily_summary
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = fiscal_daily_summary.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

CREATE POLICY "Bookkeepers can update client fiscal daily summary"
ON public.fiscal_daily_summary
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = fiscal_daily_summary.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

CREATE POLICY "Bookkeepers can delete client fiscal daily summary"
ON public.fiscal_daily_summary
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = fiscal_daily_summary.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

-- Add RLS policies for bookkeepers to manage kpo_entries
CREATE POLICY "Bookkeepers can insert client KPO entries"
ON public.kpo_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = kpo_entries.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

CREATE POLICY "Bookkeepers can update client KPO entries"
ON public.kpo_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = kpo_entries.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

CREATE POLICY "Bookkeepers can delete client KPO entries"
ON public.kpo_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = kpo_entries.company_id
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);
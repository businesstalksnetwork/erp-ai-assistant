-- Drop the existing trigger that creates KPO entries
-- We will create KPO entries from the application code after invoice items are inserted
DROP TRIGGER IF EXISTS create_kpo_on_invoice ON public.invoices;

-- Keep the function but it won't be used by trigger anymore
-- We'll call it manually or create a new approach
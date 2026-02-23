-- Fix existing KPO entries amounts based on invoice_items totals
WITH item_sums AS (
  SELECT
    invoice_id,
    COALESCE(SUM(CASE WHEN item_type = 'products' THEN total_amount ELSE 0 END), 0) AS products_sum,
    COALESCE(SUM(CASE WHEN item_type = 'services' THEN total_amount ELSE 0 END), 0) AS services_sum
  FROM public.invoice_items
  GROUP BY invoice_id
)
UPDATE public.kpo_entries ke
SET
  products_amount = s.products_sum,
  services_amount = s.services_sum,
  total_amount = (s.products_sum + s.services_sum)
FROM item_sums s
WHERE ke.invoice_id = s.invoice_id;

-- Drop the old trigger that creates KPO entries before invoice items exist
DROP TRIGGER IF EXISTS create_kpo_entry_trigger ON public.invoices;
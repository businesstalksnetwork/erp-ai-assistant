-- Fix missing KPO entries for regular invoices that were created before RLS policies were added
-- This will create KPO entries for all regular invoices that don't have them

INSERT INTO kpo_entries (
  company_id, 
  invoice_id, 
  ordinal_number, 
  description,
  products_amount, 
  services_amount, 
  total_amount, 
  year, 
  document_date
)
SELECT 
  i.company_id,
  i.id as invoice_id,
  ROW_NUMBER() OVER (PARTITION BY i.company_id, EXTRACT(YEAR FROM i.service_date) ORDER BY i.service_date, i.created_at) + 
    COALESCE((SELECT MAX(ordinal_number) FROM kpo_entries k WHERE k.company_id = i.company_id AND k.year = EXTRACT(YEAR FROM i.service_date)::int), 0) as ordinal_number,
  'Faktura ' || i.invoice_number || ', ' || TO_CHAR(i.service_date, 'DD.MM.YYYY') || ', ' || i.client_name as description,
  COALESCE(items.products_total, CASE WHEN i.item_type = 'products' THEN i.total_amount ELSE 0 END) as products_amount,
  COALESCE(items.services_total, CASE WHEN i.item_type = 'services' THEN i.total_amount ELSE 0 END) as services_amount,
  i.total_amount,
  EXTRACT(YEAR FROM i.service_date)::int as year,
  i.service_date as document_date
FROM invoices i
LEFT JOIN (
  SELECT 
    invoice_id,
    SUM(CASE WHEN item_type = 'products' THEN total_amount ELSE 0 END) as products_total,
    SUM(CASE WHEN item_type = 'services' THEN total_amount ELSE 0 END) as services_total
  FROM invoice_items
  GROUP BY invoice_id
) items ON items.invoice_id = i.id
WHERE i.is_proforma = false 
  AND i.invoice_type = 'regular'
  AND i.total_amount > 0
  AND NOT EXISTS (SELECT 1 FROM kpo_entries k WHERE k.invoice_id = i.id);
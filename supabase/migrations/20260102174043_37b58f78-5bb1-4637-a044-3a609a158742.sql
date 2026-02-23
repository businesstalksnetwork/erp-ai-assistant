-- 1. Brisanje "siročadi" KPO unosa - fakture bez veze ka fakturi
DELETE FROM kpo_entries 
WHERE invoice_id IS NULL 
  AND description LIKE 'Faktura %';

-- 2. Uklanjanje postojećeg foreign key constraint-a
ALTER TABLE kpo_entries 
DROP CONSTRAINT IF EXISTS kpo_entries_invoice_id_fkey;

-- 3. Dodavanje novog foreign key sa CASCADE brisanjem
ALTER TABLE kpo_entries 
ADD CONSTRAINT kpo_entries_invoice_id_fkey 
FOREIGN KEY (invoice_id) 
REFERENCES invoices(id) 
ON DELETE CASCADE;
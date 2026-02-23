-- Drop the existing check constraint
ALTER TABLE sef_invoices DROP CONSTRAINT IF EXISTS sef_invoices_local_status_check;

-- Add updated check constraint with storno and cancelled values
ALTER TABLE sef_invoices ADD CONSTRAINT sef_invoices_local_status_check 
CHECK (local_status = ANY (ARRAY['pending', 'approved', 'rejected', 'imported', 'storno', 'cancelled']));
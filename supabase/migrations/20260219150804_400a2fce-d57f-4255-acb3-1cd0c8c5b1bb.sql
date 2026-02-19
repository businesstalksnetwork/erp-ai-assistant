
-- Clear all imported legacy data for Uniprom tenant
-- Order matters: delete dependent tables first

DELETE FROM opportunities WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM contacts WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822');
DELETE FROM invoices WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM inventory_stock WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM products WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM partners WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM departments WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM warehouses WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM tax_rates WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';
DELETE FROM employees WHERE tenant_id = '7774c25d-d9c0-4b26-a9eb-983f28cac822';

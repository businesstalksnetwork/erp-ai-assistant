-- Bug 8: Add composite indexes on high-query tables
CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant_type_status 
  ON pos_transactions(tenant_id, receipt_type, status);

CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant_invoice 
  ON credit_notes(tenant_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_debit_notes_tenant_invoice 
  ON debit_notes(tenant_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_employees_tenant_status 
  ON employees(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant_status 
  ON payroll_runs(tenant_id, status);
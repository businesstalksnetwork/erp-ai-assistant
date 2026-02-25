-- Add missing payroll posting rules to the catalog for all tenants that have the existing rules
-- First update existing rules to have correct defaults
UPDATE posting_rule_catalog SET credit_account_code = '4620' WHERE rule_code = 'payroll_net_payable' AND credit_account_code = '4500';
UPDATE posting_rule_catalog SET credit_account_code = '4631' WHERE rule_code = 'payroll_tax' AND credit_account_code = '4510';
UPDATE posting_rule_catalog SET debit_account_code = '4620', credit_account_code = '2410' WHERE rule_code = 'payroll_bank';

-- Insert missing rules for each tenant that already has payroll rules
INSERT INTO posting_rule_catalog (tenant_id, rule_code, description, debit_account_code, credit_account_code)
SELECT DISTINCT p.tenant_id, v.rule_code, v.description, v.debit_account_code, v.credit_account_code
FROM posting_rule_catalog p
CROSS JOIN (VALUES
  ('payroll_employee_contrib', 'Payroll Employee Contributions', NULL, '4632'),
  ('payroll_employer_exp', 'Payroll Employer Contribution Expense', '5250', NULL),
  ('payroll_employer_contrib', 'Payroll Employer Contribution Liability', NULL, '4633')
) AS v(rule_code, description, debit_account_code, credit_account_code)
WHERE p.rule_code = 'payroll_gross_exp'
AND NOT EXISTS (
  SELECT 1 FROM posting_rule_catalog p2
  WHERE p2.tenant_id = p.tenant_id AND p2.rule_code = v.rule_code
);
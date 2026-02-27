# HR / Payroll Module

## Pages (Routes) — 28 pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/hr` | HrHub | Module dashboard |
| `/hr/employees` | Employees | Employee list |
| `/hr/employees/:id` | EmployeeDetail | Employee profile |
| `/hr/contracts` | EmployeeContracts | Employment contracts |
| `/hr/departments` | Departments | Department structure |
| `/hr/attendance` | Attendance | Daily attendance records |
| `/hr/leave-requests` | LeaveRequests | Leave request management |
| `/hr/payroll` | Payroll | Payroll runs list + GL posting |
| `/hr/payroll/categories` | PayrollCategories | Payroll categories config |
| `/hr/payroll/payment-types` | PayrollPaymentTypes | Payment type definitions |
| `/hr/payroll/pppd` | PppdReview | PPP-PD XML review |
| `/hr/payroll/:id` | PayrollRunDetail | Single payroll run detail |
| `/hr/work-logs` | WorkLogs | Work log entries |
| `/hr/work-logs/bulk` | WorkLogsBulkEntry | Bulk work log entry |
| `/hr/work-logs/calendar` | WorkLogsCalendar | Calendar view of work logs |
| `/hr/overtime` | OvertimeHours | Overtime tracking |
| `/hr/night-work` | NightWork | Night shift tracking |
| `/hr/annual-leave` | AnnualLeaveBalances | Leave balance management |
| `/hr/holidays` | Holidays | Public holiday calendar |
| `/hr/deductions` | Deductions | Employee deductions |
| `/hr/allowances` | Allowances | Employee allowances |
| `/hr/external-workers` | ExternalWorkers | Non-employee workers |
| `/hr/salaries` | EmployeeSalaries | Salary configuration |
| `/hr/insurance` | InsuranceRecords | Insurance/RFZO records |
| `/hr/position-templates` | PositionTemplates | Job position templates |
| `/hr/reports` | HrReports | HR-specific reports |
| `/hr/ebolovanje` | EBolovanje | Electronic sick leave (eBolovanje) |
| `/hr/non-employment-income` | NonEmploymentIncome | Non-employment income (ugovori o delu, etc.) |

## Database Tables

### Core HR
| Table | Key Columns |
|-------|------------|
| `employees` | id, tenant_id, first_name, last_name, jmbg, email, department_id, position, status, hire_date |
| `employee_contracts` | id, employee_id, tenant_id, contract_type, start_date, end_date, gross_salary |
| `departments` | id, tenant_id, name, parent_id, manager_id |
| `position_templates` | id, tenant_id, title, department_id, required_qualifications |

### Time & Attendance
| Table | Key Columns |
|-------|------------|
| `attendance_records` | id, employee_id, tenant_id, date, check_in, check_out, status, hours_worked |
| `work_logs` | id, employee_id, tenant_id, date, hours, work_type, description |
| `leave_requests` | id, employee_id, tenant_id, leave_type, start_date, end_date, status |
| `annual_leave_balances` | id, employee_id, tenant_id, year, entitled_days, used_days, carried_over_days |
| `holidays` | id, tenant_id, date, name, is_recurring |
| `overtime_hours` | id, employee_id, tenant_id, date, hours, rate_multiplier |

### Payroll
| Table | Key Columns |
|-------|------------|
| `payroll_runs` | id, tenant_id, period_month, period_year, status, legal_entity_id, total_gross, total_net |
| `payroll_items` | id, payroll_run_id, employee_id, gross_salary, net_salary, tax, contributions |
| `payroll_payment_types` | id, tenant_id, code, name, calculation_type |
| `payroll_categories` | id, tenant_id, name, code |
| `employee_salaries` | id, employee_id, tenant_id, gross_amount, effective_from |
| `deductions` | id, employee_id, tenant_id, type, amount |
| `allowances` | id, employee_id, tenant_id, allowance_type_id, amount, month, year |
| `allowance_types` | id, tenant_id, code, name |
| `non_employment_income` | id, tenant_id, recipient_name, income_type, gross_amount, tax_amount |
| `insurance_records` | id, employee_id, tenant_id, insurance_type, start_date |

### Payroll GL Mapping (Legacy)
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `posting_rule_catalog` | id, tenant_id, rule_code, debit_account, credit_account | Legacy GL code lookup |
| `payroll_pt_gl_overrides` | id, tenant_id, payment_type_code, legal_entity_id, debit_account, credit_account | Per-entity GL overrides |

## RPC Functions

| RPC | Called By | Purpose |
|-----|----------|---------|
| `calculate_payroll_for_run` | `Payroll.tsx` | Calculate gross→net for all employees in a run |
| `seed_payroll_payment_types` | Settings | Seed default Serbian payment types |
| `seed_payroll_categories` | Settings | Seed default payroll categories |

## Edge Functions

| Function | Purpose |
|----------|---------|
| `generate-pppd-xml` | Generate PPP-PD XML for tax authority submission |
| `generate-ovp-xml` | Generate OVP (obračun veština poreza) XML |
| `seed-payroll-payment-types` | Seed payment types via edge function |

## GL Posting Touchpoints

### Payroll → Accounting (Legacy Path)
```
Payroll.tsx
  → reads posting_rule_catalog for rule_code matching payroll payment type
  → maps to debit/credit GL accounts
  → createCodeBasedJournalEntry({
      lines: [
        { accountCode: debitAccount, debit: amount, credit: 0 },
        { accountCode: creditAccount, debit: 0, credit: amount },
      ]
    })
```

### Per-Entity Overrides
```
payroll_pt_gl_overrides table:
  payment_type_code + legal_entity_id → custom debit/credit accounts
  Falls back to posting_rule_catalog if no override found
```

### Non-Employment Income
- Separate GL posting path from regular payroll
- Uses hardcoded GL codes for author fees, service contracts, etc.

## Cross-Module Dependencies

### Reads From
- **Accounting**: `chart_of_accounts` (GL account resolution)
- **Settings**: `legal_entities` (multi-entity payroll), `cost_centers`
- **Posting Rules**: `posting_rule_catalog`, `payroll_pt_gl_overrides`

### Writes To
- **Accounting**: `journal_entries` + `journal_lines` via `createCodeBasedJournalEntry`
- **Accounting**: payroll journal entries reference payroll_run_id

## Compliance (Serbian)

| Feature | Implementation |
|---------|---------------|
| PPP-PD | `generate-pppd-xml` edge function → XML for Poreska Uprava |
| OVP | `generate-ovp-xml` edge function |
| eBolovanje | `EBolovanje.tsx` page for electronic sick leave |
| JMBG validation | Employee JMBG field with format validation |
| Contribution rates | Configurable via payroll parameters |

## Known Gaps
- _(resolved)_ ~~Payroll GL posting still on legacy `posting_rule_catalog`~~ — migrated to posting rules engine with Serbian standard account fallbacks (5200/4500/4510/4520/5210/4530/2410)
- _(resolved)_ ~~No automated reconciliation between payroll journals and bank salary payments~~ — PayrollBankReconciliation page with auto-match engine added

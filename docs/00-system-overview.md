# System Overview

## Module Map

| # | Module | Route Prefix | Pages | Primary Tables |
|---|--------|-------------|-------|----------------|
| 1 | **Accounting** | `/accounting/*` | 42 | journal_entries, journal_lines, chart_of_accounts, invoices, invoice_lines, fiscal_periods, budgets |
| 2 | **Bank Management** | `/accounting/bank-*` | 3 | bank_accounts, bank_statements, bank_statement_lines, bank_reconciliations, bank_reconciliation_lines, banks |
| 3 | **HR / Payroll** | `/hr/*` | 28 | employees, employee_contracts, payroll_runs, payroll_items, work_logs, attendance_records, leave_requests |
| 4 | **Inventory / WMS** | `/inventory/*` | 25 | products, inventory_stock, warehouses, wms_receipts, wms_receipt_lines, production_orders |
| 5 | **Sales** | `/sales/*` | 12 | sales_orders, sales_order_lines, sales_quotes, sales_channels, pos_transactions, pos_transaction_lines |
| 6 | **Purchasing** | `/inventory/purchase-orders` | 4 | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_invoice_lines |
| 7 | **Production** | `/inventory/production` | 3 | production_orders, production_order_lines, bom_templates, bom_lines |
| 8 | **CRM** | `/crm/*` | 8 | companies, contacts, leads, opportunities, meetings, activities, partners |
| 9 | **Settings** | `/settings/*` | 18 | tenants, legal_entities, cost_centers, currencies, tax_rates, approval_workflows, posting_rules |
| 10 | **Documents / DMS** | `/inventory/documents` | 3 | document_imports, document_categories, archive_book |
| 11 | **AI Services** | (edge functions) | 2 | ai_conversations, ai_insights_cache, ai_token_usage, ai_action_log |

## Shared Infrastructure

### Authentication & Multi-tenancy
- All tables scoped by `tenant_id` (FK → `tenants.id`)
- RLS policies enforce `auth.uid()` checks via `user_tenants` join table
- `legal_entity_id` subdivides tenants for multi-PIB support

### GL Posting Engine (Knjiženja)
Two parallel systems:
1. **New Engine**: `posting_rules` + `posting_rule_lines` → `findPostingRule()` RPC → `resolvePostingRuleToJournalLines()` → `createCodeBasedJournalEntry()`
2. **Legacy Engine**: `posting_rule_catalog` → hardcoded GL codes → `createCodeBasedJournalEntry()`

### Journal Engine
- `createCodeBasedJournalEntry()` → resolves account codes → calls `create_journal_entry_with_lines` RPC
- Atomic: header + all lines in single transaction
- Balance check: `SUM(debit) == SUM(credit)` enforced server-side
- Immutability: posted entries can only be reversed via storno

### Edge Functions
75+ Supabase Edge Functions handling SEF e-invoicing, AI services, bank XML parsing, payroll XML generation, storage, notifications, and data seeding.

## File Index

| File | Description |
|------|-------------|
| [01-accounting-module.md](./01-accounting-module.md) | Accounting module: 42 pages, tables, RPCs, GL posting |
| [02-posting-rules-engine.md](./02-posting-rules-engine.md) | GL posting rules architecture (new + legacy) |
| [03-hr-payroll-module.md](./03-hr-payroll-module.md) | HR/Payroll: 28 pages, tables, RPCs, PPP-PD |
| [04-bank-management.md](./04-bank-management.md) | Bank accounts, statements, reconciliation |
| [05-inventory-module.md](./05-inventory-module.md) | Inventory/WMS: 25 pages, stock, production |
| [06-sales-purchasing-pos.md](./06-sales-purchasing-pos.md) | Sales, Purchasing, POS |
| [07-crm-module.md](./07-crm-module.md) | CRM: companies, contacts, leads, opportunities |
| [08-settings-shared.md](./08-settings-shared.md) | Settings, legal entities, approval workflows |
| [09-edge-functions-catalog.md](./09-edge-functions-catalog.md) | All edge functions catalog |
| [10-cross-module-dependency-matrix.md](./10-cross-module-dependency-matrix.md) | Cross-module dependency matrix |



# Documentation: System Architecture & Module Dependency Maps

## What We're Building

A set of markdown documentation files in a `docs/` directory that map every module, its database tables, RPC functions, edge functions, cross-module dependencies, and GL posting touchpoints. This gives you a single source of truth to audit connections between Accounting, HR/Payroll, Inventory, Sales, POS, Purchasing, Production, and Settings.

## Proposed Files

| File | Content |
|------|---------|
| `docs/00-system-overview.md` | High-level module map with all 11 modules, page counts, shared infrastructure |
| `docs/01-accounting-module.md` | All 40+ accounting pages, tables (journal_entries, journal_lines, chart_of_accounts, invoices, fiscal_periods, etc.), RPCs (create_journal_entry_with_lines, perform_year_end_closing, etc.), edge functions (sef-*), and cross-module links |
| `docs/02-posting-rules-engine.md` | Full GL posting rules architecture: payment_models, posting_rules, posting_rule_lines, account_mappings, waterfall RPC, legacy posting_rule_catalog, and every file that calls createCodeBasedJournalEntry or findPostingRule |
| `docs/03-hr-payroll-module.md` | All 28 HR pages, tables (employees, contracts, payroll_runs, payroll_items, work_logs, etc.), RPCs (calculate_payroll_for_run, seed_payroll_*), posting_rule_catalog usage for GL posting, PPP-PD/OVP compliance |
| `docs/04-bank-management.md` | Bank accounts, bank statements, statement lines, reconciliation logic, parse-bank-xml edge function, auto-match scoring, posting rule integration for automated journal creation |
| `docs/05-inventory-module.md` | 25 inventory/WMS pages, tables (products, inventory_stock, warehouses, wms_*), RPCs (adjust_inventory_stock, confirm_internal_receipt, complete_production_order), GL touchpoints (kalkulacija, nivelacija) |
| `docs/06-sales-purchasing-pos.md` | Sales (quotes, orders, channels), Purchasing (PO, goods receipts, supplier invoices), POS (terminal, fiscal devices), and their GL posting connections (process_invoice_post, create_journal_from_invoice, process_pos_sale) |
| `docs/07-crm-module.md` | CRM pages, tables (companies, contacts, leads, opportunities, meetings), partner links to accounting (invoices, supplier_invoices, open_items) |
| `docs/08-settings-shared.md` | Settings pages, legal entities, cost centers, currencies, tax rates, approval workflows, posting rules config, payroll parameters, legacy import |
| `docs/09-edge-functions-catalog.md` | All 75+ edge functions categorized: SEF (14), AI (6), Bank (2), Storage (7), Seed/Import (8), Notifications (3), etc. with their triggers and dependencies |
| `docs/10-cross-module-dependency-matrix.md` | ASCII matrix showing which modules depend on which tables/RPCs, GL posting flow from every source document type, and the complete data flow diagram |

## Content Structure for Each Module Doc

Each file follows a consistent template:

```text
# Module Name
## Pages (routes)
## Database Tables (with key columns)
## RPC Functions (with callers)
## Edge Functions
## GL Posting Touchpoints (which pages create journal entries and how)
## Cross-Module Dependencies (reads from / writes to other modules)
## Known Gaps / Migration Notes
```

## Key Connections to Document

### GL Posting Sources (16 files that create journal entries)
- `Payroll.tsx` → `createCodeBasedJournalEntry` via `posting_rule_catalog` (legacy)
- `PayrollRunDetail.tsx` → reads `posting_rule_catalog` for GL codes
- `BankStatements.tsx` → `findPostingRule` (new engine) → `resolvePostingRuleToJournalLines` → `createCodeBasedJournalEntry`, fallback to hardcoded codes
- `Invoices.tsx` → `process_invoice_post` RPC, `create_journal_from_invoice` RPC
- `SupplierInvoices.tsx` → `createCodeBasedJournalEntry` (hardcoded 5xxx/2100)
- `FixedAssets.tsx` → `createCodeBasedJournalEntry` (8100/1290 depreciation)
- `FxRevaluation.tsx` → `createCodeBasedJournalEntry`
- `PosTerminal.tsx` → `process_pos_sale` RPC
- `JournalEntries.tsx` → direct `create_journal_entry_with_lines` RPC
- `YearEndClosing.tsx` → `perform_year_end_closing` RPC
- `Deferrals.tsx`, `CashRegister.tsx`, `Kompenzacija.tsx`, `IntercompanyTransactions.tsx`, `RecurringJournals.tsx`

### HR ↔ Accounting Links
- Payroll GL posting uses `posting_rule_catalog` (legacy, not yet migrated to new engine)
- `payroll_pt_gl_overrides` table for per-legal-entity GL mapping
- PPP-PD XML generation via `generate-pppd-xml` edge function
- Non-employment income has separate GL posting path

### Inventory ↔ Accounting Links
- `process_invoice_post` adjusts inventory stock when posting sales invoices
- `GoodsReceipts.tsx` calls `adjust_inventory_stock` and could trigger GL
- `complete_production_order` RPC adjusts stock
- Kalkulacija/Nivelacija create price adjustment journal entries

## Implementation

All 11 files created in `docs/` directory. Pure markdown, no code changes. Approximately 200-300 lines per file, totaling ~2500 lines of structured documentation.

## Technical Details

The dependency matrix in `10-cross-module-dependency-matrix.md` will include:

```text
Source Document     → Posting Rule Path          → Journal Engine
─────────────────────────────────────────────────────────────────
Sales Invoice       → process_invoice_post RPC   → journal_entries
Supplier Invoice    → hardcoded 5xxx/2100        → createCodeBasedJournalEntry
Bank Statement      → findPostingRule (new)      → resolvePostingRuleToJournalLines
                      fallback hardcoded          → createCodeBasedJournalEntry
Payroll Run         → posting_rule_catalog       → createCodeBasedJournalEntry
POS Sale            → process_pos_sale RPC       → journal_entries
Fixed Asset Depr.   → hardcoded 8100/1290        → createCodeBasedJournalEntry
FX Revaluation      → hardcoded                  → createCodeBasedJournalEntry
Year-End Closing    → perform_year_end_closing   → journal_entries (internal)
```


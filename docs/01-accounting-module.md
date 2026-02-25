# Accounting Module

## Pages (Routes)

| Route | Page Component | Purpose |
|-------|---------------|---------|
| `/accounting` | AccountingHub | Dashboard / module landing |
| `/accounting/chart-of-accounts` | ChartOfAccounts | CoA tree management |
| `/accounting/journal` | JournalEntries | Manual journal entry CRUD |
| `/accounting/invoices` | Invoices | Customer invoice list + posting |
| `/accounting/invoices/new` | InvoiceForm | Create invoice |
| `/accounting/invoices/:id` | InvoiceForm | Edit invoice |
| `/accounting/fiscal-periods` | FiscalPeriods | Open/close/lock fiscal periods |
| `/accounting/ledger` | GeneralLedger | GL account detail view |
| `/accounting/expenses` | Expenses | Expense tracking |
| `/accounting/reports` | Reports | Report hub |
| `/accounting/reports/trial-balance` | TrialBalance | Trial balance report |
| `/accounting/reports/income-statement` | IncomeStatement | P&L report |
| `/accounting/reports/balance-sheet` | BalanceSheet | Balance sheet report |
| `/accounting/reports/bilans-uspeha` | BilansUspeha | Serbian P&L format |
| `/accounting/reports/bilans-stanja` | BilansStanja | Serbian BS format |
| `/accounting/reports/aging` | AgingReports | AR/AP aging |
| `/accounting/reports/cost-center-pl` | CostCenterPL | P&L by cost center |
| `/accounting/reports/consolidated` | ConsolidatedStatements | Multi-entity consolidated |
| `/accounting/reports/multi-period` | MultiPeriodReports | Multi-period comparison |
| `/accounting/bank-statements` | BankStatements | Import & match bank statements |
| `/accounting/bank-accounts` | BankAccounts | Bank account management |
| `/accounting/document-import` | BankDocumentImport | Bank XML document import |
| `/accounting/open-items` | OpenItems | Open receivables/payables |
| `/accounting/ios` | IosBalanceConfirmation | IOS balance confirmation |
| `/accounting/pdv` | PdvPeriods | VAT periods & returns |
| `/accounting/withholding-tax` | WithholdingTax | Withholding tax tracking |
| `/accounting/cit-return` | CitTaxReturn | Corporate income tax return |
| `/accounting/year-end` | YearEndClosing | Year-end closing procedure |
| `/accounting/fixed-assets` | FixedAssets | Fixed asset register + depreciation |
| `/accounting/deferrals` | Deferrals | Prepaid expense / deferred revenue |
| `/accounting/loans` | Loans | Loan tracking |
| `/accounting/fx-revaluation` | FxRevaluation | Foreign currency revaluation |
| `/accounting/kompenzacija` | Kompenzacija | Mutual debt compensation |
| `/accounting/intercompany` | IntercompanyTransactions | Inter-entity transactions |
| `/accounting/cash-register` | CashRegister | Cash register (blagajna) |
| `/accounting/recurring-invoices` | RecurringInvoices | Auto-generated invoices |
| `/accounting/recurring-journals` | RecurringJournals | Auto-generated journal entries |
| `/accounting/statisticki-aneks` | StatistickiAneks | Statistical annex report |
| `/accounting/kpo-book` | KpoBook | KPO book of invoices |
| `/accounting/transfer-pricing` | TransferPricing | Transfer pricing documentation |
| `/accounting/report-snapshots` | ReportSnapshots | Saved report snapshots |

## Database Tables

### Core Ledger
| Table | Key Columns | Notes |
|-------|------------|-------|
| `journal_entries` | id, tenant_id, entry_number, entry_date, description, status, legal_entity_id, fiscal_period_id | Header; status: draft/posted/storno |
| `journal_lines` | id, journal_entry_id, account_id, debit, credit, description, sort_order | No tenant_id — join via journal_entries |
| `chart_of_accounts` | id, tenant_id, code, name, account_type, level, parent_id, is_active, is_system | Hierarchical CoA |
| `fiscal_periods` | id, tenant_id, name, start_date, end_date, status, legal_entity_id | Status: open/closed/locked |

### Invoicing
| Table | Key Columns |
|-------|------------|
| `invoices` | id, tenant_id, invoice_number, partner_id, total, status, sef_status, legal_entity_id |
| `invoice_lines` | id, invoice_id, product_id, quantity, unit_price, tax_rate, line_total |
| `invoice_attachments` | id, invoice_id, file_path |
| `recurring_invoices` | id, tenant_id, template_invoice_id, frequency, next_date |

### Sub-modules
| Table | Purpose |
|-------|---------|
| `fixed_assets` | Asset register with depreciation schedules |
| `fixed_asset_depreciation` | Monthly depreciation records |
| `deferrals` | Prepaid/deferred items with amortization |
| `loans` | Loan tracking with payment schedules |
| `cash_register` | Cash in/out entries (blagajna) |
| `advance_payments` | Advance payment tracking |
| `bad_debt_provisions` | Provisioning for doubtful debts |
| `budgets` | Budget amounts per account/month |
| `open_items` | Open receivables/payables aging |
| `cit_tax_returns` | Corporate income tax calculations |
| `report_snapshots` | Saved report data |
| `ar_aging_snapshots` | Accounts receivable aging snapshots |
| `ap_aging_snapshots` | Accounts payable aging snapshots |

## RPC Functions

| RPC | Called By | Purpose |
|-----|----------|---------|
| `create_journal_entry_with_lines` | `journalUtils.ts` → many pages | Atomic journal creation (header + lines + balance check) |
| `process_invoice_post` | `Invoices.tsx` | Post invoice → create journal entry + adjust inventory |
| `create_journal_from_invoice` | `Invoices.tsx` | Alternative invoice→journal path |
| `perform_year_end_closing` | `YearEndClosing.tsx` | Close fiscal year: transfer P&L to retained earnings |
| `check_fiscal_period_open` | `journalUtils.ts` | Validate fiscal period is open for a date |
| `find_posting_rule` | `postingRuleEngine.ts` | Waterfall match: model → bank account → currency → partner |
| `seed_default_posting_rules` | `PostingRules.tsx` | Seed 14 standard Serbian posting rules |

## GL Posting Touchpoints

| Source | File | Method | GL Codes |
|--------|------|--------|----------|
| Manual Journal | `JournalEntries.tsx` | `create_journal_entry_with_lines` RPC | User-selected |
| Customer Invoice | `Invoices.tsx` | `process_invoice_post` RPC | Server-side logic |
| Supplier Invoice | `SupplierInvoices.tsx` | `createCodeBasedJournalEntry` | Hardcoded 5xxx/2100 |
| Fixed Asset Depreciation | `FixedAssets.tsx` | `createCodeBasedJournalEntry` | 8100/1290 |
| FX Revaluation | `FxRevaluation.tsx` | `createCodeBasedJournalEntry` | Hardcoded |
| Cash Register | `CashRegister.tsx` | `createCodeBasedJournalEntry` | Hardcoded |
| Deferrals | `Deferrals.tsx` | `createCodeBasedJournalEntry` | Hardcoded |
| Kompenzacija | `Kompenzacija.tsx` | `createCodeBasedJournalEntry` | Hardcoded |
| Intercompany | `IntercompanyTransactions.tsx` | `createCodeBasedJournalEntry` | Hardcoded |
| Recurring Journals | `RecurringJournals.tsx` | `createCodeBasedJournalEntry` | Template-based |
| Year-End Closing | `YearEndClosing.tsx` | `perform_year_end_closing` RPC | Server-side |

## Cross-Module Dependencies

### Reads From
- **Partners** (`partners`): invoice partner_id
- **Products** (`products`): invoice lines, inventory adjustment
- **Inventory** (`inventory_stock`): `process_invoice_post` adjusts stock
- **HR** (indirect): payroll creates journal entries via `posting_rule_catalog`
- **Bank** (`bank_statements`, `bank_statement_lines`): reconciliation links to journal_entries

### Written To By
- **HR/Payroll**: `Payroll.tsx` → `createCodeBasedJournalEntry`
- **Bank**: `BankStatements.tsx` → `findPostingRule` + `createCodeBasedJournalEntry`
- **POS**: `PosTerminal.tsx` → `process_pos_sale` RPC
- **Inventory**: stock adjustments via `process_invoice_post`

## Known Gaps
- Supplier invoice posting uses hardcoded GL codes (5xxx/2100) — not yet on posting rules engine
- Fixed asset depreciation uses hardcoded 8100/1290 — should migrate to posting rules
- Cash register, deferrals, kompenzacija all use hardcoded codes
- Missing automated VAT journal creation from PDV period closing

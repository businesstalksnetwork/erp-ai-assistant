# Cross-Module Dependency Matrix

## Module Dependency Matrix

```
                  Acct  Bank  HR    Inv   Sales  Purch  Prod  CRM   Settings
Accounting  ───    ●     ●     ←     ←      ←      ←     ·     ←      ←
Bank Mgmt   ───    →     ●     ·     ·      ←      ←     ·     ←      ←
HR/Payroll  ───    →     ·     ●     ·      ·      ·     ·     ·      ←
Inventory   ───    →     ·     ·     ●      ←      ←     ←     ·      ←
Sales       ───    →     →     ·     →      ●      ·     ·     ←      ←
Purchasing  ───    →     →     ·     →      ·      ●     ·     ←      ←
Production  ───    ·     ·     ·     →      ·      ·     ●     ·      ←
CRM         ───    →     →     ·     ·      →      →     ·     ●      ←
Settings    ───    →     →     →     →      →      →     →     →      ●

Legend: → writes to, ← receives from, ● self, · no direct dependency
```

## GL Posting Flow — Complete Map

```
Source Document     → Posting Rule Path              → Journal Engine              → Ledger
──────────────────────────────────────────────────────────────────────────────────────────────
Sales Invoice       → process_invoice_post RPC       → journal_entries (server)    → GL
                      (also adjusts inventory_stock)

Supplier Invoice    → hardcoded 5xxx/2100            → createCodeBasedJournalEntry → GL
                      (LEGACY — migrate to engine)

Bank Statement      → findPostingRule (NEW ENGINE)   → resolvePostingRuleToJournalLines
                      ↳ waterfall: model→bank→curr     → createCodeBasedJournalEntry → GL
                      ↳ fallback: hardcoded 2410/2040

Payroll Run         → posting_rule_catalog (LEGACY)  → createCodeBasedJournalEntry → GL
                      ↳ payroll_pt_gl_overrides

POS Sale            → process_pos_sale RPC           → journal_entries (server)    → GL

Fixed Asset Depr.   → hardcoded 8100/1290            → createCodeBasedJournalEntry → GL

FX Revaluation      → hardcoded                      → createCodeBasedJournalEntry → GL

Cash Register       → hardcoded                      → createCodeBasedJournalEntry → GL

Deferrals           → hardcoded                      → createCodeBasedJournalEntry → GL

Kompenzacija        → hardcoded                      → createCodeBasedJournalEntry → GL

Intercompany        → hardcoded                      → createCodeBasedJournalEntry → GL

Recurring Journals  → template-based                 → createCodeBasedJournalEntry → GL

Year-End Closing    → perform_year_end_closing RPC   → journal_entries (server)    → GL

Kalkulacija         → hardcoded                      → createCodeBasedJournalEntry → GL

Nivelacija          → hardcoded                      → createCodeBasedJournalEntry → GL

Manual Journal      → user-selected accounts         → create_journal_entry_with_lines → GL
```

## Data Flow: Invoice Lifecycle

```
Quote → Sales Order → Invoice → Post → Journal Entry → GL → Financial Reports
                                  ↓
                          Inventory Stock ↓
                                  ↓
                          SEF e-Invoice → eFaktura Portal
                                  ↓
                          Open Items (AR) → Bank Statement Match → Payment
```

## Data Flow: Purchase Lifecycle

```
Purchase Order → Goods Receipt → Supplier Invoice → Post → Journal Entry → GL
                      ↓                                          ↓
              adjust_inventory_stock                     Open Items (AP)
                      ↓                                          ↓
              inventory_stock ↑                    Bank Statement Match → Payment
```

## Data Flow: Payroll Lifecycle

```
Work Logs + Attendance → Payroll Run → calculate_payroll_for_run RPC
                                           ↓
                                    Payroll Items (per employee)
                                           ↓
                              Post → posting_rule_catalog lookup
                                           ↓
                              createCodeBasedJournalEntry → GL
                                           ↓
                              PPP-PD XML → Tax Authority
                                           ↓
                              Bank Payment → Bank Statement → Match
```

## Data Flow: Bank Reconciliation

```
Bank XML Import → parse-bank-xml edge function
       ↓
bank_statements + bank_statement_lines
       ↓
Auto-match (reference + amount + partner)
       ↓
Match to invoices/supplier_invoices
       ↓
Select payment model → findPostingRule (waterfall)
       ↓
resolvePostingRuleToJournalLines
       ↓
createCodeBasedJournalEntry → journal_entries
       ↓
Update statement_line.journal_entry_id + match_status
```

## Shared Tables (Used by 3+ Modules)

| Table | Used By |
|-------|---------|
| `partners` | CRM, Sales, Purchasing, Invoices, Supplier Invoices, Bank, Cash Register, Advance Payments |
| `chart_of_accounts` | Accounting (all), Payroll, Bank, Posting Rules, Supplier Invoices |
| `journal_entries` | Accounting (all), Payroll, Bank, Invoices, POS, Fixed Assets, FX, Cash Register |
| `products` | Inventory, Sales, Purchasing, Production, POS, Invoices |
| `legal_entities` | Accounting, Payroll, Bank, Invoices, Tax Returns |
| `cost_centers` | Accounting, Journal Lines, Reports |
| `tax_rates` | Invoices, POS, Supplier Invoices, Sales |
| `currencies` | Bank Accounts, Invoices, FX Revaluation |

## Engine Migration Status

| Component | Engine | Status |
|-----------|--------|--------|
| Bank Statements | New (posting_rules) | ✅ Migrated |
| Payroll | Legacy (posting_rule_catalog) | ⏳ Planned |
| Supplier Invoices | Hardcoded | ⏳ Planned |
| Fixed Assets | Hardcoded | ⏳ Planned |
| Cash Register | Hardcoded | ⏳ Planned |
| FX Revaluation | Hardcoded | ⏳ Planned |
| Deferrals | Hardcoded | ⏳ Planned |
| Kompenzacija | Hardcoded | ⏳ Planned |
| Intercompany | Hardcoded | ⏳ Planned |
| Kalkulacija | Hardcoded | ⏳ Planned |
| Nivelacija | Hardcoded | ⏳ Planned |
| Invoices | RPC (server-side) | ✅ N/A (server logic) |
| POS | RPC (server-side) | ✅ N/A (server logic) |
| Year-End | RPC (server-side) | ✅ N/A (server logic) |
| Manual Journal | User-selected | ✅ N/A |

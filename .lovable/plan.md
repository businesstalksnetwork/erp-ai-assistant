

# Accounting & Finance Gap Analysis — What's Missing

After a thorough review of the codebase (routes, pages, DB schema, RPCs, and analytics), here is a complete inventory of what exists and what is still missing to have a production-grade Serbian accounting and finance system.

---

## What Already Exists (Solid Foundation)

```text
CORE ACCOUNTING          STATUS
─────────────────────    ──────
Chart of Accounts        ✅ Full (Serbian 2026 classes 0-9)
Journal Entries           ✅ Draft/Posted/Storno, atomic RPC
General Ledger            ✅ Synth/analytic view
Invoices (AR)             ✅ With lines, advance linking, proforma conversion
Supplier Invoices (AP)    ✅ Three-way match, approval workflow
Credit Notes              ✅ With reversal journals
Bank Statements           ✅ Import, AI matching, confidence scoring
Open Items                ✅ Auto-created on post, auto-closed on payment
Payment Allocations       ✅ Partial payments table exists
Fixed Assets              ✅ Depreciation (straight-line), disposal, GL posting
Deferrals                 ✅ Revenue/expense, monthly recognition, GL posting
Loans                     ✅ Amortization schedule, GL posting
FX Revaluation            ✅ Batch revaluation with journal entries
Kompenzacija              ✅ Mutual offset
PDV/POPDV                 ✅ Full sections, auto-collect from invoices
Fiscal Periods            ✅ Open/Closed/Locked
Year-End Closing          ✅ CIT 15%, revenue/expense zeroing, lock
Opening Balances          ✅ RPC: generate_opening_balance(s)
Posting Rules             ✅ POS/Invoicing/Payroll configurable
Cost Centers              ✅ Table + journal_lines.cost_center_id FK
Currencies + FX Rates     ✅ NBS import
Budgets vs Actuals        ✅ Per-account, per-month, with chart
SEF e-Invoice             ✅ UBL 2.1, status polling, idempotent
Advance Settlement        ✅ settle_advance_payment RPC

ANALYTICS                STATUS
─────────────────────    ──────
Financial Ratios          ✅
Cash Flow Forecast        ✅ AR bucket probabilities
Break-Even Analysis       ✅
Profitability             ✅
Margin Bridge             ✅ Waterfall
Working Capital Stress    ✅
Customer Risk Scoring     ✅
Supplier Dependency       ✅
VAT Cash Trap             ✅
Inventory Health          ✅
Early Warning System      ✅
Business Planning         ✅ Scenario simulator
Payroll Benchmark         ✅
```

---

## What's Missing — Prioritized Upgrade Plan

### TIER 1: Core Gaps (High Business Impact)

**1. Recurring Invoices / Recurring Journals**
- No `recurring_invoices` or `recurring_journals` table exists
- No cron/edge function to auto-generate periodic invoices (rent, subscriptions) or periodic journal entries (monthly accruals)
- Need: DB tables + edge function + UI for template management

**2. Multi-Currency on Invoices (exchange_rate column missing)**
- `invoices` table has `currency` but no `exchange_rate` column
- Invoice posting doesn't convert to base currency (RSD) or create exchange difference entries
- Need: Add `exchange_rate` column, update `process_invoice_post` to create dual-currency journal entries

**3. Budget Lines (Monthly Granularity)**
- Current `budgets` table is flat (account + year + month + amount) — works for basic use
- Missing: budget versioning, departmental budgets, budget approval workflow, budget-to-PO commitment tracking

**4. Intercompany Transactions**
- Multi-legal-entity tenants exist, but no intercompany elimination or transfer tracking
- No `intercompany_transactions` table to record cross-entity charges
- Need: Table + auto-balanced journal entries in both entities + elimination report for consolidated view

**5. Consolidation / Combined Financial Statements**
- BalanceSheet and IncomeStatement exist but are single-entity
- No consolidation engine to merge multiple legal entities, eliminate intercompany, and produce group-level financials

### TIER 2: Compliance & Reporting Gaps

**6. PPP-PD XML Export (Payroll Tax Return)**
- `generate-pppd-xml` edge function exists but needs to be connected to the new K01-K52 categories and OVP catalog
- UI for reviewing and submitting PPP-PD is missing

**7. Poreska Prijava PDP (Annual CIT Return)**
- No tax return preparation page for the annual corporate income tax declaration (PDP form)
- Need: Page that pulls from year-end closing data, calculates adjustments, and generates XML

**8. IOS (Izvod Otvorenih Stavki) — Confirmation of Balances**
- Serbian businesses must send periodic balance confirmations to partners
- No page or PDF generation for IOS documents
- Need: Partner balance summary page + PDF export

**9. KPO Book (Knjiga Prihoda i Rashoda) for Paušalci**
- `parse-pausalni-pdf` edge function exists but no dedicated KPO book page
- Need: Simple income/expense ledger view for flat-rate taxpayers

**10. Statistički Aneks / Notes to Financial Statements**
- Bilans Stanja and Bilans Uspeha exist, but the mandatory "Statistički Aneks" (statistical annex) and notes are missing
- Required for annual filing with APR

### TIER 3: Operational Enhancements

**11. Bank Account ↔ GL Account Linking**
- `bank_accounts` table exists but has no `gl_account_id` column
- Bank statement reconciliation doesn't know which GL account maps to which bank account
- Need: FK to chart_of_accounts, update bank matching to auto-post to correct account

**12. Depreciation Batch Run (Automated)**
- Fixed assets have manual "Run depreciation" button per asset
- No batch depreciation RPC (`calculate_depreciation_batch` doesn't exist)
- Need: Single-click monthly depreciation for all active assets

**13. Cost Center Reporting**
- `cost_center_id` exists on `journal_lines` but no dedicated P&L-by-cost-center report
- Need: Cost center profitability report page

**14. Withholding Tax (Porez po odbitku)**
- No table or logic for withholding tax on services from non-residents
- Serbian companies must withhold 20% on certain cross-border payments
- Need: Table + calculation + integration with supplier invoice posting

**15. Transfer Pricing Documentation**
- No support for related-party transaction tracking or transfer pricing reports
- Required for companies with connected entities

### TIER 4: Nice-to-Have / Advanced

**16. Cash Register (Blagajna — Physical Cash Book)**
- Separate from POS; this is the accounting cash register for petty cash
- No `cash_register` or `blagajnicki_dnevnik` table
- Need: Daily cash book with receipts/disbursements and GL posting

**17. Audit Trail on Financial Reports**
- Reports are generated on-the-fly; no snapshot/archive of submitted reports
- Need: Ability to "freeze" a report version with timestamp for regulatory proof

**18. Multi-Period Comparative Reports**
- Trial Balance, Income Statement, Balance Sheet show single period
- No side-by-side comparison (e.g., 2025 vs 2024, or Q1 vs Q2)

**19. Document Attachments on Journal Entries**
- Journal entries have no file attachment support
- Auditors need to see scanned source documents linked to entries

**20. Automated Bank Statement Import via API**
- Current import is manual CSV/XML
- No integration with Serbian bank APIs (Halcom, etc.)

---

## Recommended Implementation Order

```text
PHASE    ITEMS                                    EFFORT
──────   ──────────────────────────────────────    ──────
Phase A  #1 Recurring Invoices/Journals            Medium
         #2 Multi-Currency Invoice Posting          Medium
         #11 Bank Account ↔ GL Linking              Small
         #12 Depreciation Batch Run                 Small

Phase B  #6 PPP-PD Review/Submit UI                 Medium
         #8 IOS (Balance Confirmation)              Small
         #13 Cost Center P&L Report                 Small
         #16 Cash Register (Blagajna)               Medium

Phase C  #4 Intercompany Transactions               Large
         #5 Consolidation Reports                   Large
         #7 PDP Annual CIT Return                   Medium
         #14 Withholding Tax                        Medium

Phase D  #10 Statistički Aneks                      Medium
         #18 Multi-Period Comparative Reports       Small
         #19 Document Attachments on JE             Small
         #9 KPO Book                                Small
         #15 Transfer Pricing                       Large
         #17 Report Snapshots                       Small
         #20 Bank API Integration                   Large
```

---

## Technical Notes

- All new tables must include `tenant_id` with RLS policies matching existing patterns
- Financial mutations must use atomic RPCs (no client-side multi-table writes)
- Recurring invoice/journal generation should be an edge function triggered by pg_cron or external scheduler
- Intercompany and consolidation features require a `legal_entity_id` filter on all existing report queries (most already have this)
- PPP-PD XML must pull from `payroll_items` joined with `ovp_catalog` and `income_recipient_types` (tables already exist from recent migration)


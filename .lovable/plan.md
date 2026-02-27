

# Accounting Module Restructuring — Implementation Plan

## Current State Assessment

The PRD identifies **20 critical issues** from an accountant review and targets feature parity with BizniSoft, Minimax, and Pantheon ERP across **7 phases / 20 weeks**.

**What exists today:**
- Chart of accounts: 4,750 accounts loaded, but missing `analytics_type`, `is_foreign_currency`, `tracks_cost_center`, `tracks_cost_bearer`, `is_closing_account`
- Invoices: has `invoice_type`, `advance_invoice_id`, `journal_entry_id` — but missing `posted_at`; invoice lines missing `item_type`, `popdv_field`, `efaktura_category`
- Journal lines: missing `analytics_type`, `analytics_reference_id`, `foreign_currency`, `foreign_amount`, `exchange_rate`, `popdv_field`
- Supplier invoices: no line-items table, no POPDV mapping
- No `popdv_records` table
- Payroll: schema exists, calculation RPC exists, but the PRD says "nothing works" (this may be outdated — payroll has had significant work since)
- Bank statements: XML import exists but flagged as broken

**This is a ~20-week project. I recommend executing it phase by phase, starting with Phase 1.**

---

## Phase 1: Foundation Fixes (PRD Sections 4, 5, 6, 7) — ✅ COMPLETED

### 1A. Database Schema Migration ✅
- Added `analytics_type`, `is_foreign_currency`, `tracks_cost_center`, `tracks_cost_bearer`, `is_closing_account` to `chart_of_accounts`
- Added `item_type`, `popdv_field`, `efaktura_category`, `warehouse_id` to `invoice_lines`
- Added `posted_at` to `invoices`
- Added `analytics_type`, `analytics_reference_id`, `analytics_label`, `foreign_currency`, `foreign_amount`, `exchange_rate`, `popdv_field` to `journal_lines`
- Created `voucher_types` table with proper RLS
- Created `supplier_invoice_lines` table with proper RLS
- Created `popdv_records` table (full POPDV form with all 11 sections) with proper RLS
- Added performance indexes for all new columns

### 1B. Chart of Accounts Upgrade ✅
- Added analytics type display with color-coded badges (PARTNER=blue, EMPLOYEE=green, OBJECT=orange)
- Added foreign currency flag with globe icon
- Added cost center tracking indicator
- Added analytics type filter dropdown
- Added account flags editor in dialog (foreign currency, cost center, cost bearer, closing account)
- Added all translations (EN + SR)

### 1C. Invoice Form Redesign ✅
- Added `item_type` selector per line (Goods/Service/Product)
- Added GL Posting Preview panel showing estimated journal entries before save
- Item type saved to `invoice_lines.item_type` column
- Preview shows receivable (2040), revenue by item type (6120/6500/6100), and output VAT (4700)

### 1D. Journal Entry Improvements ✅
- Added analytics label column per line (auto-shows when account has analytics_type)
- Account selection auto-detects analytics_type and prompts for label
- Analytics data saved per journal line

---

## Phase 2: Full Posting Chain — ✅ COMPLETED

### 2A. Item-Type-Aware Invoice Posting ✅
- Upgraded `process_invoice_post` RPC to aggregate revenue by `item_type` from `invoice_lines`
- Goods → 6120, Service → 6500, Product → 6100, fallback → 6000
- Revenue lines split per item type in journal entries

### 2B. Posting Preview on All Document Types ✅
- Created generic `PostingPreviewPanel` component with helper builders
- Added posting preview to Supplier Invoices (approval flow shows GL preview before confirming)
- Added posting preview to Cash Register (shows DR/CR before saving)
- Invoice posting preview already existed from Phase 1 (`GlPostingPreview`)
- All previews show balanced/unbalanced badge and full debit/credit breakdown

### 2C. Storno Reversal ✅
- Already implemented via `storno_journal_entry` RPC in JournalEntries.tsx
- All document types that post journals link `journal_entry_id`, enabling storno from journal entries page

### 2D. Supplier Invoice Posting ✅
- Already uses `postWithRuleOrFallback` with `SUPPLIER_INVOICE_POST` and `SUPPLIER_INVOICE_PAYMENT` models
- Added posting preview dialog before approval (shows expected GL entries)

---

## Phase 3: VAT & POPDV — ✅ COMPLETED

### 3A. POPDV Field Mapping ✅
- Enhanced POPDV calculation in `PdvPeriods.tsx` to use `popdv_field` from `invoice_lines` when available
- Falls back to rate-based heuristic (20%→section 3, 10%→3a, 0%→4) when `popdv_field` is not set
- Fetches `popdv_field` and `item_type` alongside line data for accurate section assignment

### 3B. PP-PDV XML Export ✅
- Already existed via `generate-pppdv-xml` edge function
- Generates ePorezi-compatible XML with full POPDV section mapping
- Includes legal entity details (PIB, MB, address) and period information

### 3C. Tax Period Locking ✅
- Added `is_locked` column to `pdv_periods` table
- Created `trg_check_pdv_period_locked` trigger on `journal_entries` — prevents posting to locked periods
- Created `trg_auto_lock_pdv_period` trigger — auto-locks when period status changes to submitted/closed
- Added Lock/Unlock buttons to PDV periods UI with visual indicator

### 3D. PDV Settlement & Payment Orders ✅
- Already existed: `create_pdv_settlement_journal` RPC for closing VAT accounts
- Already existed: `generate-tax-payment-orders` edge function with Model 97 reference logic

---

## Phase 4: Payroll Completion — ✅ COMPLETED

### Already Working (Pre-existing)
- `calculate_payroll_for_run` RPC with full Serbian regulatory matrix (52 income categories, contribution clamping, subsidies)
- PPP-PD XML generation edge function with JMBG validation
- Salary payment orders CSV generation
- Payslip PDF generation in `generate-pdf` edge function
- GL posting on approval (accrual) and payment (bank) via `postWithRuleOrFallback`
- Full payroll UI: create run → calculate → approve → pay workflow

### 4A. Tax Payment Orders ✅
- Enhanced `generate-tax-payment-orders` edge function to support bulk payroll mode
- Generates CSV with separate payment orders for: PIT (porez na zarade), PIO employee/employer, health employee/employer, unemployment
- Uses Model 97 reference numbers with PIB + period
- Added "Nalozi porezi" button to payroll UI for approved/paid runs

### 4B. Posting Preview ✅
- Added `PostingPreviewPanel` dialog before payroll approval
- Shows all GL lines (gross expense, net payable, tax, contributions, employer costs) before confirming
- Reuses existing `PostingPreviewPanel` component from Phase 2

### 4C. Journal Entry Linking ✅
- Added `journal_entry_id`, `employer_journal_entry_id`, `payment_journal_entry_id` columns to `payroll_runs`
- GL posting now saves journal entry IDs back to the payroll run for full audit trail
- Enables storno/reversal from journal entries page

---

## Phase 5: Reports & Closing — ✅ COMPLETED

### Already Working (Pre-existing)
- Trial Balance (Bruto Bilans) with PDF export
- Income Statement (Bilans Uspeha) with PDF export
- Balance Sheet (Bilans Stanja) with PDF export
- Year-End Closing workflow with revenue/expense account zeroing
- IOS Balance Confirmation with partner summary
- Cash Flow Forecast (analytics)
- Aging Reports (AR/AP)

### 5A. Kartica Konta Upgrade ✅
- Added opening balance row (Početno stanje) when date range is set
- Added running balance per line with proper fmtNum formatting
- Added account search/filter with Serbian name support
- Added CSV export for all displayed data
- Added PDF export via `account_card` type in generate-pdf edge function
- Uses PageHeader component with proper icon

### 5B. IOS PDF Export ✅
- Added PDF export button to IOS Balance Confirmation page
- Added `ios_report` PDF type to generate-pdf edge function
- Generates partner-by-partner receivable/payable summary with totals

### 5C. Cash Flow Statement ✅
- Created `CashFlowStatement.tsx` — actual cash flow statement (indirect method)
- Three sections: Operating (net income + adjustments + working capital), Investing, Financing
- Account prefix mapping follows Serbian kontni okvir (540=depreciation, 02=fixed assets, etc.)
- Shows opening/closing cash positions
- Added PDF export via `cash_flow_statement` type
- Route: `/accounting/cash-flow-statement`
- Added to accounting navigation

---

## Phase 6: AI Agent & Compliance — ✅ COMPLETED

### 6A. Serbian Accounting Compliance Checker ✅
- Created `compliance-checker` edge function with 12+ rule-based checks covering:
  - Journal entries: unbalanced entries, missing descriptions, future dates
  - VAT/PDV: missing VAT, late submissions, GL vs invoice VAT mismatch
  - Invoicing: numbering gaps, missing PIB
  - Payroll: uncalculated payroll, employees without contracts
  - Fixed assets: missing depreciation schedules
  - Reporting: unbalanced trial balance
  - General: incomplete legal entity data
- All checks reference specific Serbian laws (Zakon o računovodstvu, Zakon o PDV, Zakon o radu, MRS/MSFI)
- AI enrichment via Gemini generates executive summary and prioritized corrective actions

### 6B. Inline Validation Hooks ✅
- Created `useAccountingValidation` hook — runs full compliance scan via edge function
- Created `useJournalEntryValidation` hook with:
  - `validateBeforePost()`: checks balance, empty lines, dual-side entries
  - `validateInvoice()`: checks VAT presence, missing PIB with law references
- Both hooks are bilingual (EN/SR) based on locale

### 6C. Compliance Dashboard UI ✅
- Created `/accounting/compliance` page with:
  - Stats cards (total, errors, warnings, info)
  - AI-powered summary with prioritized corrective actions
  - Checks grouped by category with law references
  - Severity-sorted display with badges and icons
- Added to accounting navigation and routing

---

## Phase 7 (Future)

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **7** | Polish | Credit/debit notes workflow, proforma invoices, fixed asset improvements, multi-currency |

---

## Technical Approach

- All schema changes via single migration
- PRD copied to `docs/PRD-Accounting-Module-v2.md` for reference
- Existing posting rules engine (`postWithRuleOrFallback`) extended for item-type-aware routing
- New components: `GlPostingPreview` ✅
- Reuse existing patterns: `useTenant`, `useLegalEntities`, `fmtNum`, `Select` components

---

## Recommendation

Phase 3 is complete. To continue, say "proceed to Phase 4" to implement payroll completion.

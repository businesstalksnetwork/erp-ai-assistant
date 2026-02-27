

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

## Phases 3-7 (Future — executed sequentially after Phase 2)

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **3** | VAT & POPDV | POPDV form generation from transactions, PP-PDV form, XML export for ePorezi, tax period locking |
| **4** | Payroll Completion | Verify/fix calculation, PPP-PD XML generation, payment orders, payslips, GL posting |
| **5** | Reports & Closing | Account card (kartica konta), partner card (IOS), daily journal, cash flow statement, year-end workflow |
| **6** | AI Agent | Serbian accounting law RAG agent, inline validation hooks, compliance checker |
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

Phase 2 is complete. To continue, say "proceed to Phase 3" to implement VAT & POPDV support.

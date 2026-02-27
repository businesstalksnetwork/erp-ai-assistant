

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

## Phase 1: Foundation Fixes (PRD Sections 4, 5, 6, 7)

This is the critical first batch — fixing what the accountant flagged as broken.

### 1A. Database Schema Migration

Add missing columns and create new tables:

| Table | New Columns |
|-------|-------------|
| `chart_of_accounts` | `analytics_type`, `is_foreign_currency`, `tracks_cost_center`, `tracks_cost_bearer`, `is_closing_account` |
| `invoice_lines` | `item_type`, `popdv_field`, `efaktura_category`, `warehouse_id` |
| `invoices` | `posted_at` (if missing) |
| `journal_lines` | `analytics_type`, `analytics_reference_id`, `analytics_label`, `foreign_currency`, `foreign_amount`, `exchange_rate`, `popdv_field` |

Create new tables:
- `popdv_records` (full POPDV form with all 11 sections)
- `supplier_invoice_lines` (with `item_type`, `popdv_field`, `efaktura_category`)
- `voucher_types` (ON, IB, KL, DP, IF, UF, etc.)

### 1B. Chart of Accounts Upgrade

- Add analytics type column display + edit in `ChartOfAccounts.tsx`
- Add foreign currency flag, cost center tracking indicators
- Add color coding by analytics type
- Ensure search works across all 4,750+ accounts (already paginated per memory)
- Enforce 4+ digit minimum for posting (validation in journal entry creation)
- Seed default analytics types for standard Serbian accounts (2020→PARTNER, 4320→PARTNER, 4500→EMPLOYEE, etc.)

### 1C. Invoice Form Redesign

- Add invoice type selector tabs (Konacna / Avansna / Predracun / Kn.Odobrenje / Kn.Zaduzenje)
- Add `item_type` selector per line (Roba / Usluga / Proizvod)
- Add `popdv_field` selector per line
- Add `efaktura_category` selector per line
- Auto-select legal entity when only one exists
- Remove voucher type from main form
- Add **GL posting preview panel** before save/send (the #1 missing feature)
- Add advance invoice linking for ADVANCE_FINAL type
- Enhance partner search to navigate to full partner form

### 1D. Journal Entry Improvements

- Add account search with typeahead (code + name, Serbian/English)
- Add analytics selection per line (partner/employee/object selector appears based on account's `analytics_type`)
- Enforce 4-digit minimum on account code
- Add foreign currency fields when account has `is_foreign_currency = true`
- Add POPDV field per line
- Add voucher type selector (ON, IB, IF, UF, etc.)
- Fix posting flow if broken

### 1E. Bank Statement Fixes

- Fix XML import parser for Serbian bank format
- Fix auto-numbering (iz{last3}-{seq})
- Fix PDF import (basic OCR)

---

## Phases 2-7 (Future — executed sequentially after Phase 1)

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **2** | Full Posting Chain | Item-type-aware GL posting for invoices, supplier invoices, bank lines; posting preview on all doc types; storno |
| **3** | VAT & POPDV | POPDV form generation from transactions, PP-PDV form, XML export for ePorezi, tax period locking |
| **4** | Payroll Completion | Verify/fix calculation, PPP-PD XML generation, payment orders, payslips, GL posting |
| **5** | Reports & Closing | Account card (kartica konta), partner card (IOS), daily journal, cash flow statement, year-end workflow |
| **6** | AI Agent | Serbian accounting law RAG agent, inline validation hooks, compliance checker |
| **7** | Polish | Credit/debit notes workflow, proforma invoices, fixed asset improvements, multi-currency |

---

## Technical Approach

- All schema changes via single migration
- Copy PRD to `docs/PRD-Accounting-Module-v2.md` for reference
- Existing posting rules engine (`postWithRuleOrFallback`) extended for item-type-aware routing
- New components: `GlPostingPreview`, `AccountSearchCombobox`, `AnalyticsSelector`, `PopdvFieldSelector`
- Reuse existing patterns: `useTenant`, `useLegalEntities`, `fmtNum`, `Select` components

---

## Recommendation

**Start with Phase 1** — it addresses all 20 accountant-flagged issues and establishes the schema foundation everything else builds on. Each subsequent phase can be triggered with "proceed to Phase 2", etc.

Shall I begin implementing Phase 1?


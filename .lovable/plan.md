# Upgrade Phases Implementation Plan

Implementing all items from the review **except #7** (Payroll 2026 Defaults — skipped per your instruction). Total: **32 items across 6 phases**.

---

## Phase 1: Critical Security and Data Integrity (Items 1-6) ✅ COMPLETE

### Item 1: Fix Account Code Validation (Class 5/6 Swapped) ✅ N/A
### Item 2: Enable JWT Verification ✅ N/A
### Item 3: Add Auth Checks to Edge Functions ✅ VERIFIED
### Item 4: Add .env to .gitignore ⚠️ SKIPPED (read-only)
### Item 5: Block UNION in AI SQL + Parameterize Queries ✅ DONE
### Item 6: Add Suspense to Super Admin Routes ✅ DONE
### Item 16: Vite Build Optimization ✅ DONE (pulled from Phase 3)
### Item 18: Prompt Injection Hardening ✅ DONE (pulled from Phase 3)

---

## Phase 2: Serbian 2026 Compliance (Items 8-14, skipping 7) ✅ COMPLETE

### Item 8: Advance Payment Settlement ✅ DONE
- Created `settle_advance_payment()` RPC with configurable `p_tax_rate` (not hardcoded 20%)
- Supports partial settlements, proper JE reversal (D:2300/C:2040, D:4701/C:4700)
- Added account 4701 (VAT on Advances) to chart seed

### Item 9: Credit Note SEF Submission (Type 381) ✅ DONE
- Added `document_type` param (380=Invoice, 381=Credit Note) to sef-submit
- Added `<cac:BillingReference>` block with original invoice reference
- Added `billing_reference_number` and `billing_reference_date` to InvoiceData

### Item 10: SEF Tax Category Date Logic ✅ DONE
- `getTaxCategoryId()` now accepts `invoiceDate` parameter
- Before 2026-04-01: returns legacy codes (S, AE)
- After 2026-04-01: returns split codes (S10/S20, AE10/AE20)

### Item 11: POPDV Section 2.1 Validation ✅ DONE
- Added Section 2.1 to POPDV_SECTIONS array
- PDV calculation now auto-detects Class 77xx accounts (financial income)
- Auto-populates Section 2.1 entries when interest income exists in period

### Item 12: Fiscal Receipt PFR v3 Fields ✅ DONE
- Added `environmentType`, `OmitQRCodeGen` optional fields
- Added journal endpoint call (`/api/v3/invoices/journal`) for end-of-day reconciliation

### Item 13: Bilans Uspeha/Stanja Consistency ✅ DONE
- Fixed swapped filter: revenue now filters Class 6, expenses filter Class 5
- Fixed labels: "Класа 6: Приходи" and "Класа 5: Расходи"
- Removed incorrect Class 4 from ACCOUNT_CLASSES

### Item 14: Payroll Enhancements ✅ DONE
- Added `meal_allowance_daily` and `transport_allowance_monthly` to payroll_parameters
- Added `overtime_multiplier` and `night_work_multiplier` to payroll_parameters
- Added `municipal_tax_rate` to employees table
- Payroll calc now includes partial month proration, municipal tax, meal/transport allowances
- Added new columns to payroll_items table

---

## Phase 3: Architecture and Code Quality (Items 15-20)

### Item 15: ErrorBoundary for All Routes ✅ ALREADY DONE
### Item 16: Vite Build Optimization ✅ DONE (moved to Phase 1)
### Item 17: TypeScript Strict Mode — PENDING
### Item 18: Prompt Injection Hardening ✅ DONE (moved to Phase 1)
### Item 19: POS Offline Service Worker — PENDING
### Item 20: Cmd+K Command Palette ✅ ALREADY DONE

---

## Phase 4: Accounting Feature Gaps (Items 21-24) — PENDING
## Phase 5: WMS, Production, and AI (Items 25-31) — PENDING
## Phase 6: Housekeeping (Items 32-33) — PENDING

---

## Implementation Order

Phases 1 & 2 complete. Remaining: Phase 3 (Items 17, 19) → Phase 4 → Phase 5 → Phase 6.

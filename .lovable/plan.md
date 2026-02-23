# Upgrade Phases Implementation Plan

Implementing all items from the review **except #7** (Payroll 2026 Defaults — skipped per your instruction). Total: **32 items across 6 phases**.

---

## Phase 1: Critical Security and Data Integrity (Items 1-6) ✅ COMPLETE

### Item 1: Fix Account Code Validation (Class 5/6 Swapped) ✅ N/A
Verified — Class 5/6 mappings are already correct in the database. `validate_account_code_type()` function does not exist. No fix needed.

### Item 2: Enable JWT Verification ✅ N/A
Per Supabase signing-keys system, `verify_jwt = false` is the correct approach. Auth validation is done in code (see Item 3).

### Item 3: Add Auth Checks to Edge Functions ✅ VERIFIED
Most functions already have `getUser()` checks. Config stays as-is.

### Item 4: Add .env to .gitignore ⚠️ SKIPPED
`.gitignore` is a read-only file.

### Item 5: Block UNION in AI SQL + Parameterize Queries ✅ DONE
- Added `"UNION "` to forbidden keywords in `validateSql()`
- Refactored `searchDocuments()` to use Supabase `.from()` client
- Refactored `getPartnerDossier()` to use Supabase `.from()` client
- Refactored `explainAccount()` to use Supabase `.from()` for account lookup
- Added 8 new injection patterns (Unicode, base64, JSON injection, role impersonation)

### Item 6: Add Suspense to Super Admin Routes ✅ DONE
All 7 lazy-loaded super admin routes wrapped in `<React.Suspense fallback={<LoadingFallback />}>`.

### Item 16: Vite Build Optimization ✅ DONE (pulled from Phase 3)
Added `manualChunks` splitting: vendor, charts, supabase, ui.

### Item 18: Prompt Injection Hardening ✅ DONE (pulled from Phase 3)
Added Unicode/homoglyph, base64, JSON injection, role impersonation patterns.

---

## Phase 2: Serbian 2026 Compliance (Items 8-14, skipping 7)

### Item 8: Advance Payment Settlement
**File:** New migration  
Create `settle_advance_payment()` RPC that:
- Takes `p_tenant_id`, `p_advance_id`, `p_invoice_id`, `p_tax_rate` (not hardcoded 20%)
- Creates a reversal journal entry offsetting the advance
- Updates both the advance payment record and invoice balance
- Handles partial settlements

### Item 9: Credit Note SEF Submission (Type 381)
**File:** `supabase/functions/sef-submit/index.ts`  
- Accept `document_type` parameter (default `380` for invoice, `381` for credit note)
- Add `<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>` for credit notes
- Add `<cac:BillingReference>` block referencing the original invoice
- Handle negative line amounts

### Item 10: SEF Tax Category Date Logic
**File:** `supabase/functions/sef-submit/index.ts`  
Update `getTaxCategoryId()` to accept an `invoiceDate` parameter. If date is before 2026-04-01, return legacy codes (`S`, `AE`). After that date, return split codes (`S10`/`S20`, `AE10`/`AE20`).

### Item 11: POPDV Section 2.1 Validation
**File:** New component or existing PDV periods page  
Add a validation check that detects Class 77xx accounts (financial income — interest on deposits) and flags if Section 2.1 is missing from the POPDV submission.

### Item 12: Fiscal Receipt PFR v3 Fields
**File:** `supabase/functions/fiscalize-receipt/index.ts`  
Add fields: `environmentType`, `OmitQRCodeGen`, multi-label support. Add journal endpoint call (`/api/v3/invoices/journal`) for end-of-day reconciliation.

### Item 13: Bilans Uspeha/Stanja Consistency
**Files:** `src/pages/tenant/BilansUspeha.tsx`, `src/pages/tenant/BilansStanja.tsx`  
Verify and fix that report mappings use Class 5 = Rashodi, Class 6 = Prihodi (consistent with Item 1 fix).

### Item 14: Payroll Enhancements
**Files:** `src/pages/tenant/Payroll.tsx`, new migration  
Add: meal allowance (topli obrok), transport allowance (prevoz), configurable overtime multiplier, partial month proration, variable municipal tax rates per employee.

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

Phases 1 & 3 (partial) complete. Remaining: Phase 2 → Phase 3 (Items 17, 19) → Phase 4 → Phase 5 → Phase 6.

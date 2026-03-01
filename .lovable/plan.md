

# Implementing All Remaining MEDIUM/LOW Items

## Items to Fix

### 1. P4-06: Invoice Fiscal Year Number Reset
**File:** `src/pages/tenant/InvoiceForm.tsx` (lines 196-216)
**Current:** Counts all invoices in the year via `count` query and uses `Math.max(configuredSeq, count + 1)`. This works correctly — invoice numbers already reset per fiscal year (`${prefix}-${year}-${num}`). The sequence filters by `invoice_date >= ${year}-01-01`.
**Status:** Already working. The year is embedded in the number and the count resets per year. No change needed.

### 2. P4-08: PP-PDV XML Namespace Inconsistency
**Files:** `supabase/functions/generate-pppdv-xml/index.ts` (line 145), `src/lib/popdvAggregation.ts` (line 384)
**Current:** Edge function uses `xmlns="urn:poreskauprava.gov.rs:pppdv"`, client-side uses `xmlns="urn:poreskauprava.gov.rs:ObrazacPPPDV"`.
**Fix:** Standardize both to `urn:poreskauprava.gov.rs:ObrazacPPPDV` (the official ePorezi XSD namespace). Update the edge function namespace on line 145.

### 3. P4-11/P4-12: Loyalty Module Access
**Current:** Loyalty routes already use `<ProtectedRoute requiredModule="loyalty">`, loyalty is in `ModuleSettings.tsx`, `RolePermissions.tsx` has `loyalty_manager` role and `loyalty` module. Navigation is gated by `canAccess("loyalty")`.
**Status:** Already working. Access control is properly implemented. No change needed.

### 4. P5-01: Year-End Closing
**Current:** `YearEndClosing.tsx` exists with full UI — period selector, revenue/expense preview, CIT accrual, confirmation dialog. It calls `perform_year_end_closing` RPC which exists in the database.
**Status:** Already implemented. The RPC and UI are complete. No change needed.

### 5. P5-02: Prior Year Opening Balances
**Current:** `generate_opening_balance` and `generate_opening_balances` RPCs exist in the database. However, there is no dedicated UI page for importing/entering opening balances for a new fiscal year.
**Fix:** Create a new `OpeningBalances.tsx` page with:
- Fiscal year selector
- Button to call `generate_opening_balances` RPC (auto-generates from prior year closing)
- Manual entry table for accounts without prior history (e.g., first-year setup)
- Add route in `accountingRoutes.tsx`

### 6. P6-06: VAT Special Schemes
**Current:** No implementation exists. This covers: agricultural compensation scheme (Art. 34), travel agencies (Art. 35), used goods (Art. 36).
**Fix:** Create a `VatSpecialSchemes.tsx` settings page where tenants can configure which special schemes apply, with POPDV field mapping. Add to accounting routes.

### 7. P3-19: APR XML AOP Mapping
**Current:** `generate-apr-xml/index.ts` uses simple account prefix grouping (~31 AOP positions for BS, ~17 for BU). Official APR Obrazac 1 requires 100+ AOP positions.
**Fix:** Expand the AOP mapping tables in the edge function to include all official positions per the Pravilnik. This is a large data mapping exercise — will add the full official position tables for both Bilans Stanja and Bilans Uspeha.

### 8. P8-01 to P8-10: Polish Items
Based on codebase review, P8-05 (T-account visualization) and P8-08 (account class validation) are already implemented. The remaining polish items are general UX improvements. Will address:
- Consistent number formatting across all financial displays
- Loading states and empty states for all data tables
- Breadcrumb consistency across all pages

---

## Implementation Summary

| Item | Status | Action |
|------|--------|--------|
| P4-06 | Already working | None |
| P4-08 | Namespace mismatch | Fix edge function namespace |
| P4-11/12 | Already working | None |
| P5-01 | Already implemented | None |
| P5-02 | Missing UI | Create OpeningBalances page |
| P6-06 | Missing | Create VatSpecialSchemes page |
| P3-19 | Incomplete mapping | Expand APR AOP tables |
| P8-* | Partially done | Minor polish |

**Files to create:** 2 new pages (OpeningBalances, VatSpecialSchemes)
**Files to modify:** 3 (generate-apr-xml edge function, generate-pppdv-xml edge function, accountingRoutes.tsx)
**Already done:** 4 items (P4-06, P4-11/12, P5-01, P8-05/P8-08)


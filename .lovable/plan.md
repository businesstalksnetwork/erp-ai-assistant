

# CR3-05 + CR4 Issues — Fix Plan

All 12 new bugs from the V3.4 audit plus the lingering CR3-05 are confirmed present. Here's the implementation plan organized by priority.

---

## Phase A: HIGH Priority (7 items)

### 1. CR3-05: sef-cancel returns 500 for all errors
**File:** `supabase/functions/sef-cancel-sales-invoice/index.ts` (line 192-198)
The catch block always returns HTTP 500. Fix: parse known error types and return 400 for validation errors, 404 for not-found, 502 for upstream SEF failures.

### 2. CR4-02: AI narrative cache hash collision
**File:** `supabase/functions/ai-analytics-narrative/index.ts` (line 222)
`JSON.stringify(data).length + "_" + context_type` is collision-prone. Fix: use `crypto.subtle.digest("SHA-256", ...)` on the stringified data to produce a proper hash.

### 3. CR4-03: GeneralLedger partner/cost-center filters are UI-only
**File:** `src/pages/tenant/GeneralLedger.tsx` (lines 79-102)
`partnerFilter` and `costCenterFilter` are never applied to the Supabase query. Fix: add `journal_lines` join to `partners` via `journal_entry.partner_id` and filter by `cost_center_id` when not "all". Add these to the query key.

### 4. CR4-04: CIT advances Q4 due date off-by-one
**File:** `src/components/cit/CitAdvancePayments.tsx` (lines 48, 107)
`fiscalYear + 2` for Q4 is wrong — should be `fiscalYear + 1`. Per ZPDPL Art. 68, advances for year N are due during year N+1, so Q4 (Jan 15) = Jan 15 of N+1, not N+2. Fix: change `nextYear` logic to just use `fiscalYear + 1` for all quarters.

### 5. CR4-05: CIT advances quarterly instead of monthly
**File:** `src/components/cit/CitAdvancePayments.tsx`
ZPDPL Art. 68 requires monthly advances (1/12 of annual tax), not quarterly. Refactor the schedule from 4 quarters to 12 months with proper due dates (15th of each month in year N+1).

### 6. CR4-07: PoreskiBilans tax base uses wrong line
**File:** `src/pages/tenant/PoreskiBilans.tsx` (line 208)
`getFinal(33)` (net accounting loss) must be `getFinal(62)` (AOP 1056 — oporeziva dobit after all adjustments). The 15% tax on line 68 should come from the adjusted taxable base.

### 7. CR4-01: Auth pattern inconsistency (partial — standardize new/modified functions)
**Scope:** Edge functions modified in this batch. Standardize `sef-cancel-sales-invoice` to use `getClaims()` instead of `getUser()`. Full migration of all 41 `getUser()` functions deferred to a dedicated auth sweep.

---

## Phase B: MEDIUM Priority (4 items)

### 8. CR4-06: PoreskiBilans ZPDP → ZPDPL
**File:** `src/pages/tenant/PoreskiBilans.tsx` (lines 83, 87, 89, 97)
Also `src/pages/tenant/AssetDepreciation.tsx` (multiple references to "ZPDP"). Replace all occurrences with "ZPDPL" (Zakon o porezu na dobit pravnih lica).

### 9. CR4-08: NonDeductibleCalc client-side query optimization
**File:** `src/components/cit/NonDeductibleCalc.tsx`
Currently fetches all journal_lines for the fiscal year client-side. Fix: add account code filter to the query (`account.code` starting with "552" or "553") so only relevant lines are fetched. Full RPC optimization deferred.

### 10. CR4-09: PartnerStatement missing opening balance
**File:** `src/pages/tenant/PartnerStatement.tsx`
Add a query for all open_items before `dateFrom` to compute opening balance. Display as first row and use as starting point for running balance.

### 11. CR4-10: PartnerStatement credit/debit note direction
**File:** `src/pages/tenant/PartnerStatement.tsx` (lines 65-67)
Handle `document_type` for credit notes: if document_type is "credit_note" and direction is "receivable", it should be a credit (not debit), and vice versa for debit notes against payables.

---

## Phase C: LOW Priority (2 items)

### 12. CR4-11: CashRegister sequential numbering
**File:** `src/pages/tenant/CashRegister.tsx` (line 63)
Replace `Date.now().toString(36)` with a sequential pattern: query `MAX(entry_number)` for the current month and increment. Format: `BL-YYYY-MM-NNNN`.

### 13. CR4-12: Cash-in default account 6990
**File:** `src/pages/tenant/CashRegister.tsx` (line 69)
Change fallback from `6990` to `2040` (customer receivables) for cash-in, which is the standard contra-account for cash receipts in Serbian accounting.

---

## Technical Summary

| Phase | Items | Files Changed |
|-------|-------|---------------|
| **A** | 7 (HIGH) | 4 frontend files, 2 edge functions |
| **B** | 4 (MED) | 3 frontend files |
| **C** | 2 (LOW) | 1 frontend file |
| **Total** | 13 fixes | ~8 files |

All phases can be implemented in a single pass. No new migrations needed (CIT advances table already exists with `month` column that can store 1-12).


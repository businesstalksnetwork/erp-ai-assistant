

# Next Priority Fixes from V3.2 Audit

Based on verification of current code, here are the remaining unfixed items in priority order. Items already fixed in the last round (CR2-01 through CR2-14, P2-07, P3-20, CR-08/09) are excluded.

## Fix 1: P1-03 — POS Triple Stock Deduction (CRITICAL)
**File:** `src/pages/tenant/PosTerminal.tsx` lines 478-495
**Issue:** Both `complete_pos_transaction` (line 480) AND `process_pos_sale` (line 500) deduct stock server-side. The client calls both sequentially = double deduction.
**Fix:** Remove the `complete_pos_transaction` call (lines 478-495). Let `process_pos_sale` handle stock atomically. Keep the `complete_pos_transaction` only as a fallback if `process_pos_sale` doesn't handle stock.

## Fix 2: P1-05 — BOM Superseded Lines Filter (CRITICAL)
**File:** `supabase/migrations/` — new migration to recreate `complete_production_order`
**Issue:** Line 38 of `20260228021004` queries `bom_lines` without `AND bl.superseded_at IS NULL`. Revised BOMs consume both old and new lines.
**Fix:** New migration that adds `AND bl.superseded_at IS NULL` to the BOM lines query.

## Fix 3: P3-03 — Production GL Accounts 5100/5000 → 120/511 (HIGH)
**Same migration as Fix 2**
**Issue:** Both DR (5100) and CR (5000) are expense accounts. Finished goods never hit the balance sheet.
**Fix:** Change fallback accounts from `5100`→`1200` (Gotovi proizvodi) and `5000`→`5110` (Troškovi materijala). Material consumption: DR 5110 / CR 1010. Finished goods: DR 1200 / CR 5800.

## Fix 4: P3-09 — Leave Type Enum Mismatch (HIGH)
**Issue:** The payroll RPC migration we just created uses `'sick'` correctly. But need to verify the `eBolovanje` trigger and `LeaveRequests.tsx` also use the correct enum values.
**Files:** Check `LeaveRequests.tsx` for `'sick_leave'` vs `'sick'`

## Fix 5: P3-18 — NBS Exchange Rate Unit Division (HIGH)
**File:** `supabase/functions/nbs-exchange-rates/index.ts`
**Issue:** JPY and other currencies with `<unit>100</unit>` store rates 100x too high because `middle_rate` is not divided by `unit`.
**Fix:** Extract `<unit>` from XML and divide rate by it.

## Fix 6: CR-20 — SEF S10/S20 Uses Wall Clock Not Invoice Date (HIGH)
**File:** `supabase/functions/sef-send-invoice/index.ts` (if it exists)
**Issue:** `determineVatCategory` uses `new Date()` instead of the invoice's `issue_date` for the April 2026 cutover.
**Note:** This function may not exist in the codebase (search returned no results). If so, skip.

## Fix 7: P2-10 — Journal Entry Numbering Race Condition (CRITICAL)
**File:** `src/lib/journalUtils.ts`
**Issue:** Fallback still uses `COUNT+1` which can produce duplicates. Should use the server-side RPC with advisory lock.

## Fix 8: CR2-11 — generate-apr-xml Uses Anon Key (HIGH)
**Note:** This function doesn't exist in the codebase (search returned no results). Skip.

## Summary
- **1 new DB migration** (BOM superseded filter + production GL accounts)
- **1-2 frontend files** (PosTerminal.tsx, journalUtils.ts)
- **1 edge function** (nbs-exchange-rates if it exists)
- Fixes 2 CRITICAL + 3 HIGH issues




# Next Batch: V3.2 Remaining Fixes (Round 4)

Focusing on the next highest-priority unfixed items from the audit. Items already addressed in Rounds 1-3 are excluded.

## Fix 1: P3-04 — Advance Invoice Clearing GL Lines (HIGH)
**File:** `src/pages/tenant/InvoiceForm.tsx` ~line 505
**Issue:** When `invoiceType === "advance_final"` and `advanceAmountApplied > 0`, no GL clearing entry is created. Missing: DR 2270 (Primljeni avansi) / CR 2040 (Kupci) for the advance amount applied.
**Fix:** After building `fallbackLines`, if `values.invoiceType === "advance_final" && values.advanceAmountApplied > 0`, push two additional lines to clear the advance.

## Fix 2: P3-10 — POPDV Missing Credit Notes (HIGH)
**File:** `src/lib/popdvAggregation.ts` ~line 124
**Issue:** `fetchOutputLines` only queries `invoices` table. Credit notes from `credit_notes` table are never included in POPDV VAT return — legal compliance gap.
**Fix:** Add a second query in `fetchOutputLines` to also fetch from `credit_notes` table (join with any line detail if available), and include them as negative amounts in the aggregation.

## Fix 3: P3-12 — InvoiceForm FIFO Failure Must Reverse GL (HIGH)
**File:** `src/pages/tenant/InvoiceForm.tsx` ~line 534
**Issue:** On FIFO failure, invoice reverts to "draft" but the already-posted GL entry remains — split-brain state.
**Fix:** Before throwing, also delete/storno the journal entry that was just created. Use the `journalId` or reference to reverse.

## Fix 4: P3-13 — 3-Way Match Missing Price Check (HIGH)
**File:** `src/pages/tenant/SupplierInvoices.tsx` lines 154-176
**Issue:** `performThreeWayMatch` only compares quantities, not prices. Supplier can overbill by any amount with no discrepancy flagged.
**Fix:** Add price comparison: compare PO `unit_price` vs supplier invoice line price. Flag discrepancies when price differs by more than a tolerance (e.g., 1%).

## Fix 5: P3-07 — SEF Error HTTP Status Codes (HIGH)
**Files:** `supabase/functions/sef-send-invoice/index.ts`, `supabase/functions/sef-cancel-sales-invoice/index.ts`
**Issue:** Errors return HTTP 200 with `success: false`. Callers checking `response.ok` treat failures as success.
**Fix:** Return HTTP 4xx/5xx for actual errors instead of 200.

## Fix 6: P4-07 — Fiscalization Tax Label Map (MEDIUM)
**File:** `supabase/functions/fiscalize-receipt/index.ts`
**Issue:** 10% VAT maps to wrong tax label. Per Pravilnik: A=20%, B=10%, G=0% exempt.
**Fix:** Verify and correct the tax label mapping.

## Fix 7: CR-27 — KpoBook Column Name (NOT VERIFIED)
**File:** `src/pages/tenant/KpoBook.tsx`
**Issue:** Audit flagged `.select('total_amount')` but column might be `total`. Current code uses `total_amount` for invoices and `total_amount` for supplier_invoices.
**Status:** Verified — KpoBook uses correct column names (`total_amount` for invoices, `total_amount` for supplier_invoices). No fix needed.

## Summary
- **2 frontend files** modified (InvoiceForm.tsx, SupplierInvoices.tsx)
- **1 lib file** modified (popdvAggregation.ts)
- **2-3 edge functions** modified (sef-send-invoice, sef-cancel-sales-invoice, fiscalize-receipt)
- Fixes 5 HIGH + 1 MEDIUM issues


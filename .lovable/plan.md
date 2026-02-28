

# Round 6: V3.2 Remaining Fixes

## Already verified as fixed (skipping)
P3-14 (waste GL+stock), P3-22 (bank→paid), CR-21 (MultiPeriodReports Class 2), CR-14 (DeferredTax sign), CR-17 (payment-orders auth), CR-25 (VatProRata), CR-10 (ZPDPL refs), P4-14 (MobileFilterBar duplicate)

## Fix 1: P3-25 — complete_pos_transaction Uses Wrong Table (HIGH)
**File:** New migration
**Issue:** Line 163 of the RPC queries `inventory` table instead of `inventory_stock`. `FOR UPDATE` on a view may not lock correctly.
**Fix:** New migration to `CREATE OR REPLACE FUNCTION` changing `FROM inventory` to `FROM inventory_stock`.

## Fix 2: P4-04 — PB-1 Sidebar Navigation Link Missing (MEDIUM)
**File:** `src/layouts/TenantLayout.tsx`
**Issue:** PoreskiBilans at `/accounting/reports/poreski-bilans` has no sidebar entry.
**Fix:** Add entry to the accounting sidebar section: `{ key: "poreskiBilans", url: "/accounting/reports/poreski-bilans", icon: FileText }`.

## Fix 3: P4-13 — WMS Cycle Count Reconciliation Missing GL + Inventory Adjustment (MEDIUM)
**File:** `src/pages/tenant/WmsCycleCounts.tsx` lines 304-312
**Issue:** Reconcile only updates `wms_bin_stock` quantities. No `adjust_inventory_stock` call, no GL posting for shortages/surpluses.
**Fix:** For each variance line, call `adjust_inventory_stock` with the variance quantity, then post GL: shortage DR 5710 / CR 1320, surplus DR 1320 / CR 5790.

## Fix 4: P4-18 — Concurrent Contract Payroll Deduplication (MEDIUM)
**File:** New migration to update `calculate_payroll_for_run`
**Issue:** If an employee has multiple active contracts, the payroll loop processes them all, creating duplicate payroll items.
**Fix:** Add `DISTINCT ON (emp_id)` or a processed-employee check in the cursor loop to skip already-processed employees.

## Fix 5: P4-19 — Payroll Recalculation Guard (MEDIUM)
**Same migration as Fix 4**
**Issue:** No server-side check prevents recalculating an already approved/paid payroll run.
**Fix:** Add `IF v_run.status IN ('approved','paid') THEN RAISE EXCEPTION 'Cannot recalculate...'; END IF;` at the start of the RPC.

## Fix 6: P4-20 — Credit Note Inventory Restoration Wrong Warehouse (MEDIUM)
**File:** `src/pages/tenant/CreditDebitNotes.tsx`
**Issue:** Inventory restoration picks the first warehouse arbitrarily instead of using the warehouse from the original sale.
**Fix:** Fetch the original invoice's warehouse (from invoice_lines or related stock movements) and use that for restoration.

## Summary
- 1 new DB migration (POS table fix + payroll dedup + recalc guard)
- 3 frontend files modified (TenantLayout.tsx, WmsCycleCounts.tsx, CreditDebitNotes.tsx)
- Fixes 1 HIGH + 5 MEDIUM issues


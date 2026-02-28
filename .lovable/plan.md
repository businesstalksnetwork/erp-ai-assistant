

# Round 6: V3.2 Remaining Fixes — COMPLETED

## Already verified as fixed (skipping)
P3-14 (waste GL+stock), P3-22 (bank→paid), CR-21 (MultiPeriodReports Class 2), CR-14 (DeferredTax sign), CR-17 (payment-orders auth), CR-25 (VatProRata), CR-10 (ZPDPL refs), P4-14 (MobileFilterBar duplicate)

## Fix 1: P3-25 — complete_pos_transaction Uses Wrong Table (HIGH) ✅
Migration applied: `FROM inventory` → `FROM inventory_stock` with proper `FOR UPDATE` row locking.

## Fix 2: P4-04 — PB-1 Sidebar Navigation Link Missing (MEDIUM) ✅
Added `poreskiBilans` entry to `accountingNav` in TenantLayout.tsx.

## Fix 3: P4-13 — WMS Cycle Count Reconciliation Missing GL + Inventory Adjustment (MEDIUM) ✅
Reconcile now calls `batch_adjust_inventory_stock` per variance line and posts GL via `postWithRuleOrFallback` (shortage DR 5710 / CR 1320, surplus DR 1320 / CR 5790).

## Fix 4: P4-18 — Concurrent Contract Payroll Deduplication (MEDIUM) ✅
Migration: `calculate_payroll_for_run` now tracks processed employees in `v_processed_employees uuid[]` array, skipping duplicates.

## Fix 5: P4-19 — Payroll Recalculation Guard (MEDIUM) ✅
Same migration: raises exception if run status is 'approved' or 'paid'.

## Fix 6: P4-20 — Credit Note Inventory Restoration Wrong Warehouse (MEDIUM) ✅
`CreditDebitNotes.tsx` now checks `line.warehouse_id` first, then falls back to `inventory_stock` lookup, then last resort first warehouse.

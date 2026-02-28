

## Phase 0: Critical Hotfixes — 9 Items

All 9 bugs confirmed present in the codebase.

### Items

**0.1: Fix Cross-Tenant RLS on voucher_types, supplier_invoice_lines, popdv_records**
- Migration: drop 3 `USING(true)` policies from migration `20260227081329`, replace with tenant-scoped policies using `get_user_tenant_ids(auth.uid())`

**0.2: Fix Storage Bucket Security**
- Migration: drop and recreate `legacy-imports` policy with `TO service_role` clause (currently missing — any authenticated user can access)

**0.3: Fix Loyalty RPCs Missing tenant_member Check**
- Migration: recreate `accrue_loyalty_points` and `redeem_loyalty_points` with `PERFORM public.assert_tenant_member(p_tenant_id)` at function start

**0.4: Fix Service Invoice Missing invoice_number**
- Migration: recreate `generate_invoice_from_service_order` to generate `v_inv_number := 'SRV-' || v_order.order_number` and include it in the INSERT

**0.5: Fix Duplicate notifications Table**
- Migration: wrap second `CREATE TABLE notifications` (from `20260216194711`) in `IF NOT EXISTS`, remove duplicate `ALTER PUBLICATION` line
- Approach: new migration with `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` to add any missing columns

**0.6: Fix journal_lines Missing tenant_id in INSERT Functions**
- Confirmed: `process_pos_sale` (line 107) and `complete_production_order` (line 230) both INSERT into `journal_lines` without `tenant_id`
- Migration: recreate both functions adding `tenant_id` column to all `INSERT INTO journal_lines` statements

**0.7: Fix Balance Sheet Class 2 Misclassification**
- `BilansStanja.tsx` line 177: Class 2 grouped with liabilities instead of assets
- Fix: move "2" from liabilities array to assets array: `assets = ["0", "1", "2"]`, `liabilities = ["4"]`

**0.8: Fix QueryClient Missing Defaults**
- `App.tsx` line 55: bare `new QueryClient()` with no defaults
- Fix: add `staleTime: 2min`, `gcTime: 10min`, `refetchOnWindowFocus: false`, `retry: 2`

**0.9: Fix POS Invoice Number Race Condition**
- Create `invoice_number_sequences` table with `(tenant_id, prefix, year)` PK
- Create `next_invoice_number` RPC using `INSERT ... ON CONFLICT DO UPDATE` for atomic increment
- Wire POS refund numbering to use the new RPC instead of `Date.now()`

### Technical Details

| # | Type | Files |
|---|------|-------|
| 0.1 | Migration | New SQL — drop+recreate 3 RLS policies |
| 0.2 | Migration | New SQL — drop+recreate storage policy with `TO service_role` |
| 0.3 | Migration | New SQL — recreate 2 loyalty RPCs with assert_tenant_member |
| 0.4 | Migration | New SQL — recreate generate_invoice_from_service_order |
| 0.5 | Migration | New SQL — IF NOT EXISTS wrapper for notifications |
| 0.6 | Migration | New SQL — recreate process_pos_sale + complete_production_order with tenant_id |
| 0.7 | Code fix | `src/pages/tenant/BilansStanja.tsx` line 177 |
| 0.8 | Code fix | `src/App.tsx` line 55 |
| 0.9 | Migration + Code | New SQL (table + RPC) + `PosTerminal.tsx` line 264 |

### Execution Order
1. Single migration covering items 0.1–0.6 and 0.9 (DB/RLS/RPC fixes)
2. `BilansStanja.tsx` fix (item 0.7)
3. `App.tsx` QueryClient defaults (item 0.8)
4. `PosTerminal.tsx` wire `next_invoice_number` (item 0.9)


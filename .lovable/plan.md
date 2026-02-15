

# Fix Seed Function Cleanup and Re-Seed

## Problem

The `seed-demo-data` function fails during cleanup because:

1. **Wrong trigger names in `force_delete_journal_entries` RPC**: The function tries to disable `trg_block_posted_journal_lines_mutation` and `trg_block_posted_journal_mutation`, but the actual trigger names (from the latest security migration) are `trg_protect_posted_lines_update`, `trg_protect_posted_lines_delete`, `trg_protect_posted_entry`, and `trg_check_journal_balance`.

2. **Missing FK-dependent tables in cleanup order**: Tables like `open_item_payments`, `credit_notes`, `inventory_cost_layers`, `wms_bin_stock`, and others reference parent tables but aren't being deleted before their parents.

## Changes

### 1. Database Migration: Fix the RPC Function

Update `force_delete_journal_entries` to use the correct trigger names:

```sql
CREATE OR REPLACE FUNCTION public.force_delete_journal_entries(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable all journal protection triggers
  ALTER TABLE journal_lines DISABLE TRIGGER trg_protect_posted_lines_update;
  ALTER TABLE journal_lines DISABLE TRIGGER trg_protect_posted_lines_delete;
  ALTER TABLE journal_entries DISABLE TRIGGER trg_protect_posted_entry;
  ALTER TABLE journal_entries DISABLE TRIGGER trg_check_journal_balance;
  
  DELETE FROM journal_lines WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id = p_tenant_id
  );
  DELETE FROM journal_entries WHERE tenant_id = p_tenant_id;
  
  -- Re-enable triggers
  ALTER TABLE journal_lines ENABLE TRIGGER trg_protect_posted_lines_update;
  ALTER TABLE journal_lines ENABLE TRIGGER trg_protect_posted_lines_delete;
  ALTER TABLE journal_entries ENABLE TRIGGER trg_protect_posted_entry;
  ALTER TABLE journal_entries ENABLE TRIGGER trg_check_journal_balance;
END;
$$;
```

### 2. Fix Cleanup Order in `seed-demo-data/index.ts`

Add missing FK-dependent tables to the `fkCleanup` array and reorder the `cleanupTables` list so child tables are deleted before parents:

**Add to fkCleanup:**
- `invoices` -> `credit_notes` (invoice_id)
- `open_items` -> `open_item_payments` (open_item_id)
- `leads` -> `opportunities` (lead_id)
- `companies` -> `activities` (company_id)
- `contacts` -> `opportunities` (contact_id)
- `salespeople` -> `opportunities` (salesperson_id)
- `warehouses` -> `inventory_cost_layers` (warehouse_id)
- `products` -> `inventory_cost_layers` (product_id)
- `wms_zones` -> `wms_bins` (zone_id)
- `wms_bins` -> `wms_bin_stock` (bin_id)
- `employees` -> `salespeople` (employee_id)
- `locations` -> `employees` (location_id)
- `fiscal_periods` -> `journal_entries` (fiscal_period_id -- handled by RPC)
- `partners` -> `open_items` (partner_id)
- `purchase_orders` -> `supplier_invoices` (purchase_order_id)
- `bom_templates` -> `production_orders` (bom_template_id)

**Reorder cleanupTables** to delete deepest children first:
- `open_item_payments` before `open_items`
- `credit_notes` before `invoices`
- `inventory_cost_layers` before `products`/`warehouses`
- `wms_bin_stock` before `wms_bins`
- `opportunities` and `activities` before `leads`, `companies`, `contacts`
- `salespeople` before `employees`

### 3. Deploy and Invoke

After fixes:
1. Deploy `seed-demo-data`
2. Invoke it to re-seed all data with 2026 dates

## Files Modified

| File | Change |
|---|---|
| Database migration | Fix `force_delete_journal_entries` RPC with correct trigger names |
| `supabase/functions/seed-demo-data/index.ts` | Fix cleanup order -- add missing FK children and reorder deletion sequence |




# Production Module Upgrade

## Current State

The production module has basic BOM management and a completion flow, but it has critical gaps in atomicity, traceability, and real manufacturing features.

## Upgrade Plan

### Phase 1: Atomicity and Data Integrity (Critical)

**1.1 -- Create `complete_production_order` database RPC**

Move the entire completion logic (material consumption, finished goods receipt, WIP journal entry, status update) into a single PostgreSQL function that runs in one transaction. This replaces the current 5+ sequential frontend calls.

The RPC will:
- Validate the order exists and is in `planned` or `in_progress` status
- Check material availability in the selected warehouse before consuming
- Loop through BOM lines, deduct raw materials via `adjust_inventory_stock`
- Add finished goods via `adjust_inventory_stock`
- Create WIP journal entry (D:5100 / P:5000) using resolved account IDs
- Update order status to `completed` with `actual_end` date
- Return success or roll back everything on any failure

**1.2 -- Add auto-generated order numbers**

Add a `order_number` column with a trigger that generates sequential numbers per tenant (format: `PRO-YYYY-NNNN`). Display this instead of UUIDs in the table.

### Phase 2: State Machine and UX

**2.1 -- Enforce status transitions**

Remove the free-form status dropdown from the edit dialog. Instead, add action buttons:
- Draft -> Planned (validates product + BOM are set)
- Planned -> In Progress ("Start Production" button, sets `actual_start`)
- In Progress/Planned -> Completed (existing "Complete & Consume" dialog, now calls the RPC)
- Any non-completed -> Cancelled

**2.2 -- Production Order Detail page**

Create a detail/view page (`/production/orders/:id`) showing:
- Order header info (product, BOM, dates, status timeline)
- BOM materials list with required vs consumed quantities
- Linked journal entry reference
- Inventory movements linked to this order

**2.3 -- Material availability check in Complete dialog**

Before showing the confirm button, query current stock for each BOM material in the selected warehouse. Show a warning table:

```text
Material      | Required | Available | Status
Steel Bar     | 10       | 15        | OK
Bolt M8       | 50       | 30        | INSUFFICIENT
```

Disable the confirm button if any material is insufficient (with override option for admin).

### Phase 3: Enhanced Features

**3.1 -- Partial completion support**

Add a "quantity to complete" field in the Complete dialog (default = remaining). Track `completed_quantity` on the order. Allow multiple completions until total equals planned quantity.

**3.2 -- Scrap/waste recording**

Add a `production_waste` table (order_id, product_id, quantity, reason). Show a "Record Waste" button on in-progress orders. Factor waste into cost calculations.

**3.3 -- BOM versioning**

Instead of delete-all-reinsert on edit, add a `version` column to `bom_templates`. When editing, create a new version and keep old lines linked to old version. Production orders reference the specific BOM version used.

**3.4 -- Production cost summary**

Add a cost breakdown card on the detail page:
- Planned cost (BOM quantities x purchase prices at order creation)
- Actual cost (consumed quantities x actual prices)
- Variance (planned - actual)

---

## Technical Changes Summary

| File | Action |
|------|--------|
| New migration SQL | `complete_production_order` RPC, `order_number` column + trigger, `production_waste` table, BOM version column |
| `src/pages/tenant/ProductionOrders.tsx` | Replace completeMutation with RPC call, add state machine buttons, remove free-form status select, add order number display |
| `src/pages/tenant/ProductionOrderDetail.tsx` (new) | Detail page with materials, journal link, cost summary |
| `src/pages/tenant/BomTemplates.tsx` | Add version tracking on save |
| `src/App.tsx` | Add route for `/production/orders/:id` |
| `src/layouts/TenantLayout.tsx` | No changes needed (nav already has production group) |
| `src/i18n/translations.ts` | Add new keys for availability check, partial completion, waste, etc. |
| `src/integrations/supabase/types.ts` | Update with new tables/columns/RPC |

## Implementation Order

1. Migration: `complete_production_order` RPC + order_number trigger
2. Update `ProductionOrders.tsx`: call RPC, state machine buttons, order numbers
3. Migration: `production_waste` table + BOM version column
4. Create `ProductionOrderDetail.tsx` with materials, costs, and journal link
5. Update `BomTemplates.tsx` with versioning
6. Add translations and route

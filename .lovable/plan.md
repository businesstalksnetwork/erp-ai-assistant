

# Stock Reservation + POS Daily Report Enhancements + WebSettings Verification

## 1. Stock Reservation on Sales Order Confirmation

When a Sales Order status changes to "confirmed", reserve the ordered quantities in `inventory_stock`.

### Database: New RPC function `reserve_stock_for_order`

A new migration creating an RPC that:
- Reads all `sales_order_lines` for the given order
- For each line with a `product_id`, increases `quantity_reserved` on `inventory_stock` (using a default warehouse or the first available warehouse with stock)
- If the order is cancelled after confirmation, a corresponding `release_stock_for_order` RPC reverses the reservation

```text
reserve_stock_for_order(p_tenant_id, p_sales_order_id)
  -> FOR each sales_order_line with product_id
     -> UPDATE inventory_stock SET quantity_reserved = quantity_reserved + line.quantity
        WHERE product_id = line.product_id (pick warehouse with most stock)

release_stock_for_order(p_tenant_id, p_sales_order_id)
  -> Reverse: quantity_reserved = quantity_reserved - line.quantity
```

### Edge function update: `process-module-event/index.ts`

Replace the placeholder at line 161 (`"Stock reservation placeholder"`) with actual logic that calls `reserve_stock_for_order` RPC. Also handle `sales_order.cancelled` to release stock.

### UI update: `SalesOrders.tsx`

When the status changes from non-confirmed to "confirmed", trigger the `process-module-event` edge function with event `sales_order.confirmed`. When changed to "cancelled", trigger `sales_order.cancelled`.

---

## 2. POS Daily Report Enhancements

### Tax Breakdown Section

The `pos_transactions` table stores `tax_amount` and `items` (JSONB with per-item `tax_rate`). Currently the Z-Report shows `tax_breakdown: {}` as empty.

**Changes to `PosDailyReport.tsx`:**
- Parse each transaction's `items` JSONB to extract per-tax-rate totals (e.g., 20% PDV, 10% PDV, 0%)
- Display a **Tax Breakdown** card in the Z-Report section showing:
  - Tax rate | Taxable base | Tax amount | Total
  - One row per distinct rate
- Pass the computed breakdown into `generateReport` mutation instead of `{}`

### Shift-Based Reporting

The `pos_sessions` table has `opened_at` and `closed_at` timestamps plus `cashier_id`. Add a shift summary section:
- Query `pos_sessions` for the selected date/location
- Show per-session: cashier name, open/close times, transaction count, total sales
- Group transactions by `session_id` for the breakdown

### Cash Drawer Reconciliation

Add fields for expected vs actual cash:
- **Expected cash** = cash sales total - cash refunds (already computed)
- Add two inputs: "Opening float" and "Actual cash count" (manual entry)
- Show **Variance** = actual - (opening float + expected cash)
- Store these values in the `pos_daily_reports` record (new columns: `opening_float`, `actual_cash_count`, `cash_variance`)

---

## 3. WebSettings UI Verification

The WebSettings page already has Sync Now, webhook URL, and import stats implemented. No code changes needed -- just visual verification that the components render correctly. This will be confirmed after implementation of items 1 and 2.

---

## Files to Create

None (only a migration file).

## Files to Modify

| File | Changes |
|---|---|
| New migration SQL | `reserve_stock_for_order` and `release_stock_for_order` RPCs; add `opening_float`, `actual_cash_count`, `cash_variance` to `pos_daily_reports` |
| `supabase/functions/process-module-event/index.ts` | Replace stock reservation placeholder with real RPC call; add cancellation handler |
| `src/pages/tenant/SalesOrders.tsx` | Fire `process-module-event` on status change to confirmed/cancelled |
| `src/pages/tenant/PosDailyReport.tsx` | Tax breakdown computation and display; shift summary section; cash reconciliation inputs |
| `src/integrations/supabase/types.ts` | Add new RPC types and `pos_daily_reports` column types |
| `src/i18n/translations.ts` | New keys: taxBreakdown, taxableBase, shiftSummary, cashier, openingFloat, actualCashCount, cashVariance, expectedCash, etc. |

## Technical Notes

### Tax Breakdown Computation

Each `pos_transactions.items` is a JSONB array like:
```text
[{ name, quantity, unit_price, tax_rate: 20, total_amount }, ...]
```

Group by `tax_rate`, sum `unit_price * quantity` as taxable base, compute tax per group:
```text
taxableBase = sum(unit_price * quantity) per tax_rate
taxAmount = taxableBase * (tax_rate / 100)
```

### Stock Reservation Flow

```text
Sales Order created (status: pending)
  -> No stock impact

Status changed to "confirmed"
  -> process-module-event("sales_order.confirmed")
  -> reserve_stock_for_order RPC
  -> inventory_stock.quantity_reserved += ordered qty

Status changed to "cancelled" (from confirmed)
  -> process-module-event("sales_order.cancelled")  
  -> release_stock_for_order RPC
  -> inventory_stock.quantity_reserved -= ordered qty

Status changed to "delivered" + invoice created
  -> Invoice posting already deducts quantity_on_hand via adjust_inventory_stock
  -> Should also release the reservation (quantity_reserved -= qty)
```


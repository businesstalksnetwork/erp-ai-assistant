

# E2E Verification Report -- Remaining Issues

After thorough database schema validation, code path tracing, and cross-referencing all queries against actual table columns, I found **3 remaining bugs** that need fixing. All previously identified critical issues (missing web tables, auth method, order import columns) have been resolved.

---

## Issue 1: `PosTerminal.tsx` queries `salespeople.user_id` -- column does not exist

**File**: `src/pages/tenant/PosTerminal.tsx`, line 43

The auto-salesperson query filters by `.eq("user_id", user.id)`, but `salespeople` has no `user_id` column. Its columns are: `id, tenant_id, employee_id, first_name, last_name, code, email, phone, commission_rate, is_active, role_type, default_location_id`.

**Fix options**:
- Option A: Add a `user_id uuid REFERENCES auth.users(id)` column to `salespeople` via migration, so salespeople can be linked to auth users.
- Option B: Match via `employee_id` by looking up the `employees` table for the user, then matching to `salespeople.employee_id`.

**Recommended**: Option A (add column) -- it is the simplest path and aligns with the intent of auto-detecting the logged-in user's salesperson record.

**Migration**:
```text
ALTER TABLE salespeople ADD COLUMN user_id uuid REFERENCES auth.users(id);
CREATE INDEX idx_salespeople_user_id ON salespeople(user_id);
```

No code change needed in PosTerminal.tsx -- the query will work once the column exists.

---

## Issue 2: `PosDailyReport.tsx` joins on `cashier_id` -- column is `opened_by`

**File**: `src/pages/tenant/PosDailyReport.tsx`, line 56

The query is:
```text
.select("*, profiles:cashier_id(full_name)")
```

But `pos_sessions` has no `cashier_id` column. The correct column is `opened_by`.

**Fix**: Change to:
```text
.select("*, profiles:opened_by(full_name)")
```

This will correctly join the `profiles` table (which has `full_name`) via the `opened_by` FK.

---

## Issue 3: `ProductDetail.tsx` reads `rp.price` -- column is `retail_price`

**File**: `src/pages/tenant/ProductDetail.tsx`, line 175

The retail prices table has column `retail_price`, not `price`. The code reads `Number(rp.price)` which will return `NaN`.

**Fix**: Change `rp.price` to `rp.retail_price` on line 175 (and the margin calculation on line 176).

---

## Verified Working (no issues)

| Component | Status |
|-----------|--------|
| `web_connections`, `web_price_lists`, `web_prices` tables | Created with full RLS |
| `web_sync_logs` FK to `web_connections` | Constraint exists |
| `sales_orders` columns (source, web_connection_id, external_order_id, salesperson_id) | All present |
| `pos_daily_reports` columns (opening_float, actual_cash_count, cash_variance) | All present |
| RPCs: `reserve_stock_for_order`, `release_stock_for_order`, `adjust_inventory_stock` | All exist |
| `web-sync` edge function auth (`getUser`) | Fixed |
| `web-order-import` column mapping (description, line_total) | Fixed |
| `web-order-import` notification with `user_id` | Fixed |
| `SalesOrders.tsx` stock event emission | Correct flow |
| `process-module-event` reserve/release handlers | Correct RPC calls |
| `PosDailyReport.tsx` tax breakdown computation | Correct logic |
| `PosDailyReport.tsx` cash reconciliation | Correct formula |
| `WebSettings.tsx` Sync Now, webhook URL, import stats | All rendered |
| `ProductDetail.tsx` web prices and inventory tabs | Correct queries |
| `profiles` table has `full_name` | Confirmed |

---

## Files to Modify

| File | Change |
|------|--------|
| New migration SQL | Add `user_id` column to `salespeople` |
| `src/pages/tenant/PosDailyReport.tsx` | Line 56: `cashier_id` to `opened_by` |
| `src/pages/tenant/ProductDetail.tsx` | Line 175-176: `rp.price` to `rp.retail_price` |

These are small, surgical fixes. No architectural changes needed.


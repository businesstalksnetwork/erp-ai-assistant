
# Comprehensive E2E Verification Report

## Summary

After thorough inspection of the codebase, database schema, edge functions, and UI components, I found **6 critical issues** and **3 minor issues** that need fixing.

---

## CRITICAL Issues

### 1. Missing Database Tables: `web_connections`, `web_price_lists`, `web_prices`

These three tables are referenced throughout the code but **no migration ever creates them**. This means:
- `WebSettings.tsx` queries `web_connections` -- will fail
- `WebPrices.tsx` queries `web_prices` / `web_price_lists` -- will fail
- `ProductDetail.tsx` queries `web_prices` -- will fail
- `web-sync` edge function queries `web_connections` and `web_prices` -- will fail
- `web-order-import` edge function queries `web_connections` -- will fail
- `web_sync_logs.web_connection_id` FK references `web_connections` which doesn't exist -- migration may have failed

**Fix**: Create a migration with all three tables:
- `web_connections` (id, tenant_id, platform, store_url, api_key, api_secret, access_token, webhook_secret, is_active, last_sync_at, last_error)
- `web_price_lists` (id, tenant_id, web_connection_id, name, currency, is_active)
- `web_prices` (id, tenant_id, web_price_list_id, product_id, price, compare_at_price)

All with RLS policies for tenant isolation.

### 2. `web-sync` Edge Function Uses Non-Existent `auth.getClaims()`

Line 27: `anonClient.auth.getClaims(token)` -- this method does not exist in supabase-js v2. 

**Fix**: Replace with `supabase.auth.getUser(token)` to validate the JWT.

### 3. `ProductDetail.tsx` Queries `retail_prices` with Wrong Column

Line 42: `.eq("tenant_id", tenantId!)` -- but `retail_prices` has no `tenant_id` column. It only has `price_list_id`, `product_id`, etc.

**Fix**: Remove the `.eq("tenant_id", tenantId!)` filter from the retail_prices query, or join through `retail_price_lists` which does have `tenant_id`.

### 4. `web-order-import` Inserts Invalid Columns into `sales_order_lines`

Line 213-214: Inserts `tenant_id` and `product_name` into `sales_order_lines`, but neither column exists. The table has: `sales_order_id, product_id, quantity, unit_price, description, sort_order, tax_rate_id, tax_rate_value, tax_amount, line_total, total_with_tax`.

**Fix**: Map `product_name` to `description`, remove `tenant_id`, and map `total` to `line_total`.

### 5. `web-order-import` Notification Insert Missing Required `user_id`

Line 225-229: Inserts into `notifications` without `user_id`, which is likely required. This will silently fail.

**Fix**: Either query tenant members and create notifications for each, or use the existing `create-notification` edge function which handles multi-user notification dispatch.

### 6. `web_sync_logs` Migration Likely Failed

The migration `20260213085747` tries to create `web_sync_logs` with a FK to `web_connections(id)`, but `web_connections` doesn't exist. This migration would have failed, meaning `web_sync_logs` may also not exist.

**Wait** -- the DB query confirmed `web_sync_logs` does exist. Let me check if it was created without the FK. The `sales_orders` columns (`source`, `web_connection_id`, `external_order_id`) also exist. So the migration partially succeeded or the FK was handled differently.

---

## Minor Issues

### 7. `PosDailyReport.tsx` Session Query Uses Non-Standard Join

Line 56: `.select("*, profiles:cashier_id(full_name)")` -- this assumes a `profiles` table with `full_name`. If the profiles table doesn't have this exact structure, the cashier name will show "---".

### 8. `web-sync` Missing `SUPABASE_ANON_KEY` Environment Variable

Line 24: Uses `Deno.env.get("SUPABASE_ANON_KEY")` -- this is available by default in Supabase edge functions, but the auth flow using `getClaims` is broken anyway (issue #2).

### 9. `SalesOrders.tsx` Stock Event Best-Effort Catch

Line 136: `catch { /* best effort */ }` swallows all errors from stock reservation. If the RPC fails, the user gets no feedback.

---

## What's Working Correctly

| Feature | Status |
|---------|--------|
| Route structure (App.tsx) | All routes properly registered including `/inventory/products/:id` |
| `ProductDetail.tsx` Overview tab | Renders product details correctly |
| `ProductDetail.tsx` Inventory tab | Queries `inventory_stock` and `inventory_movements` correctly |
| Products.tsx clickable links | Product names link to `/inventory/products/:id` |
| `SalesOrders.tsx` salesperson dropdown | Queries and assigns `salesperson_id` correctly |
| `SalesOrders.tsx` stock event emission | Correctly creates `module_events` and invokes `process-module-event` |
| `process-module-event` stock RPCs | Correctly calls `reserve_stock_for_order` / `release_stock_for_order` |
| Database RPCs | `reserve_stock_for_order`, `release_stock_for_order`, `adjust_inventory_stock` all exist |
| `inventory_stock.quantity_reserved` | Column exists |
| `sales_orders` new columns | `source`, `web_connection_id`, `external_order_id`, `salesperson_id` all present |
| `pos_daily_reports` reconciliation columns | `opening_float`, `actual_cash_count`, `cash_variance` all present |
| `PosDailyReport.tsx` tax breakdown | Logic correctly parses items JSONB and groups by tax_rate |
| `PosDailyReport.tsx` cash reconciliation | UI with opening float, expected cash, actual count, variance |
| `PosDailyReport.tsx` shift summary | Queries pos_sessions and groups transactions by session |
| `PosDailyReport.tsx` Z-Report generation | Saves report with tax breakdown and reconciliation data |
| `retail_prices` / `retail_price_lists` tables | Exist with correct schema |
| Edge function registration (config.toml) | All functions registered |
| i18n translations | New keys added for all features |

---

## Fix Plan

### Migration: Create missing web tables and fix FK

```text
CREATE TABLE web_connections (
  id uuid PK DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  platform text NOT NULL DEFAULT 'shopify',
  store_url text NOT NULL,
  api_key text,
  api_secret text,
  access_token text,
  webhook_secret text,
  is_active boolean DEFAULT false,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now()
) + RLS

CREATE TABLE web_price_lists (
  id uuid PK,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  web_connection_id uuid REFERENCES web_connections(id),
  name text NOT NULL,
  currency text DEFAULT 'RSD',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
) + RLS

CREATE TABLE web_prices (
  id uuid PK,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  web_price_list_id uuid REFERENCES web_price_lists(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  price numeric NOT NULL DEFAULT 0,
  compare_at_price numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(web_price_list_id, product_id)
) + RLS

-- Add FK on web_sync_logs if missing
ALTER TABLE web_sync_logs
  ADD CONSTRAINT IF NOT EXISTS fk_web_sync_logs_connection
  FOREIGN KEY (web_connection_id) REFERENCES web_connections(id);

-- Add FK on sales_orders if missing  
ALTER TABLE sales_orders
  ADD CONSTRAINT IF NOT EXISTS fk_sales_orders_web_connection
  FOREIGN KEY (web_connection_id) REFERENCES web_connections(id);
```

### Code Fixes

| File | Fix |
|------|-----|
| `supabase/functions/web-sync/index.ts` | Replace `getClaims()` with `auth.getUser()` for JWT validation |
| `src/pages/tenant/ProductDetail.tsx` | Fix retail_prices query: remove `.eq("tenant_id")`, filter through `price_list_id` join instead |
| `supabase/functions/web-order-import/index.ts` | Fix `sales_order_lines` insert: remove `tenant_id`, rename `product_name` to `description`, rename `total` to `line_total` |
| `supabase/functions/web-order-import/index.ts` | Fix notification: use `create-notification` edge function or insert per-user |

### Files to modify
- New migration SQL file
- `supabase/functions/web-sync/index.ts` (auth fix)
- `supabase/functions/web-order-import/index.ts` (column mapping fix + notification fix)
- `src/pages/tenant/ProductDetail.tsx` (retail_prices query fix)
- `src/integrations/supabase/types.ts` (add web table types)

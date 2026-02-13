

# Product Detail Pricing View + Web Sync Edge Functions + Web Order Import

## Status Check

**Migration for `salesperson_id`**: Already done -- migration `20260212202908` added `salesperson_id` to `quotes`, `sales_orders`, `invoices`, `opportunities`, and `pos_transactions`. No action needed.

---

## Feature 1: Product Detail Page with 3-Tier Pricing View

There is currently no product detail page -- products are only managed via the list view with an inline dialog. We will create a dedicated detail page showing all pricing tiers side-by-side.

### New file: `src/pages/tenant/ProductDetail.tsx`

A tabbed page accessible at `/inventory/products/:id` with:

**Header**: Product name, SKU, barcode, status badge, Edit button

**Tab 1 -- Overview**
- Basic info card: name (EN/SR), SKU, barcode, UOM, costing method, tax rate, description
- Status and default prices (purchase / wholesale sale)

**Tab 2 -- Pricing (all 3 tiers side-by-side)**
- **Wholesale Price**: from `products.default_sale_price` (the base price)
- **Retail Prices**: query `retail_prices` WHERE `product_id = this product` -- show per price list: price list name, retail price, margin vs wholesale
- **Web Prices**: query `web_prices` WHERE `product_id = this product` -- show per price list: connection name, web price, compare-at price, margin vs wholesale
- All in one card with 3 sections, making it easy to compare pricing strategy

**Tab 3 -- Inventory**
- Stock levels per warehouse from `inventory_stock` WHERE `product_id`
- Total on-hand, reserved, available
- Recent movements from `inventory_movements` (last 10)

### Route addition in `App.tsx`
```
<Route path="inventory/products/:id" element={<ProductDetail />} />
```

### Products.tsx update
- Make product name in the table a clickable link to `/inventory/products/:id`

---

## Feature 2: Web Sync Edge Function (Stock + Catalog Push)

### New file: `supabase/functions/web-sync/index.ts`

An edge function that pushes product catalog and stock data to connected web platforms (Shopify, WooCommerce, custom API).

**Request**: `POST { tenant_id, connection_id, sync_type: "full" | "stock_only" | "prices_only" }`

**Logic**:
1. Fetch the `web_connection` record to get platform type, `store_url`, `api_key`, `api_secret`
2. Fetch all `web_prices` for this connection's price lists, joined with `products` for catalog data
3. Fetch `inventory_stock` totals per product (SUM on_hand across warehouses)
4. Based on platform type:
   - **Shopify**: Use Shopify Admin REST API to create/update products and set inventory levels
   - **WooCommerce**: Use WooCommerce REST API (`/wp-json/wc/v3/products`)
   - **Custom API**: POST the payload to the connection's `webhook_url`
5. Log sync results to a new `web_sync_logs` table

### Database: New `web_sync_logs` table (migration)
```
web_sync_logs (
  id uuid PK,
  tenant_id uuid FK,
  web_connection_id uuid FK,
  sync_type text,        -- 'full', 'stock_only', 'prices_only'
  status text,           -- 'success', 'partial', 'failed'
  products_synced int,
  errors jsonb,
  started_at timestamptz,
  completed_at timestamptz
)
```

### UI: Add "Sync" button to `WebSettings.tsx`
- Per connection: "Sync Now" button that calls the edge function
- Show last sync status and timestamp from `web_sync_logs`

---

## Feature 3: Web Order Import (Webhook Ingestion)

### New file: `supabase/functions/web-order-import/index.ts`

A webhook endpoint that receives orders from web platforms and creates Sales Orders.

**Endpoint**: `POST /web-order-import`

**Logic**:
1. Identify the connection by `api_key` header or `connection_id` in payload
2. Parse the order based on platform format:
   - **Shopify**: Parse Shopify webhook payload (`orders/create`)
   - **WooCommerce**: Parse WooCommerce webhook payload
   - **Custom**: Expect a standardized JSON format
3. Map products by SKU or barcode to internal `products.id`
4. Create a `sales_order` with:
   - `source = 'web'`, `web_connection_id`, `status = 'confirmed'`
   - Partner: look up or create from customer email/name
   - Lines: map order items to products with quantities and prices
5. Return order ID for the platform to store as reference

### Database changes (migration)
- `ALTER TABLE sales_orders ADD COLUMN source text DEFAULT 'manual'` -- values: 'manual', 'web', 'pos'
- `ALTER TABLE sales_orders ADD COLUMN web_connection_id uuid REFERENCES web_connections(id)`
- `ALTER TABLE sales_orders ADD COLUMN external_order_id text` -- the platform's order ID

### UI: `WebSettings.tsx` additions
- Show webhook URL per connection (copy-to-clipboard)
- Show recent imported orders count
- Link to Sales Orders filtered by `source = 'web'`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/tenant/ProductDetail.tsx` | Product detail page with 3-tier pricing view |
| `supabase/functions/web-sync/index.ts` | Push catalog/stock to Shopify/WooCommerce |
| `supabase/functions/web-order-import/index.ts` | Receive orders from web platforms |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add route for `/inventory/products/:id` |
| `src/pages/tenant/Products.tsx` | Make product names clickable links |
| `src/pages/tenant/WebSettings.tsx` | Add Sync button, webhook URL display, import stats |
| `src/i18n/translations.ts` | ~20 new keys (pricing tiers, sync, import, etc.) |
| `src/integrations/supabase/types.ts` | Add new table types and column additions |
| `supabase/config.toml` | Register new edge functions |
| New migration SQL | `web_sync_logs` table + `sales_orders` columns |

## Technical Notes

### Edge Function Authentication

- `web-sync`: Called from the app UI with user auth token -- verify JWT = true
- `web-order-import`: Called from external platforms (Shopify/WooCommerce webhooks) -- verify JWT = false, authenticate via API key matching against `web_connections.api_key`

### Shopify API Integration Pattern

```text
POST https://{store}.myshopify.com/admin/api/2024-01/products.json
Headers: X-Shopify-Access-Token: {api_key}

For inventory:
POST https://{store}.myshopify.com/admin/api/2024-01/inventory_levels/set.json
```

### WooCommerce API Integration Pattern

```text
PUT https://{store}/wp-json/wc/v3/products/{id}
Auth: Basic (consumer_key:consumer_secret)
```

### Data Flow After Implementation

```text
Outbound (Sync):
  Products + inventory_stock + web_prices
    -> web-sync edge function
    -> Shopify/WooCommerce API
    -> web_sync_logs (result tracking)

Inbound (Import):
  Shopify/WooCommerce webhook (orders/create)
    -> web-order-import edge function
    -> sales_orders (source='web') + sales_order_lines
    -> Notification to user
```


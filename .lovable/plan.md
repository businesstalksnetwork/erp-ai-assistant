

## Consolidate Web Prices into Products + Move Web Module into Sales

### What Changes

1. **Add `default_web_price` column to `products` table** -- so each product carries its web price directly, just like it already has `default_retail_price` and `default_sale_price`.

2. **Extend the Products list page** (`Products.tsx`) with two new visible columns: **Maloprodajna cena** (retail) and **Web cena** -- so all pricing is visible in one place without needing separate pages.

3. **Extend the Product form dialog** with fields for `default_retail_price` and `default_web_price` -- so users can set all prices when creating/editing a product.

4. **Move Web Settings into the Sales sidebar** -- merge `webNav` items into `salesNav` and remove the standalone "Web prodaja" sidebar group.

5. **Move Web routes under `/sales/`** -- `/web/settings` becomes `/sales/web-settings`, `/web/prices` becomes `/sales/web-prices`.

6. **Update SalesHub** to include Web Settings and Web Prices cards.

7. **Remove standalone `/web` route and `WebHub.tsx`**.

8. **Remove `retail-prices` from Sales nav** since retail prices are now visible directly in Products. The `RetailPrices.tsx` page (price list management) and `WebPrices.tsx` page (web price list management) stay accessible for bulk/list-based pricing but move under inventory.

### Detailed Technical Changes

#### Migration: Add `default_web_price` column
```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_web_price numeric DEFAULT 0 NOT NULL;
```

#### `src/pages/tenant/Products.tsx`
- Add `default_retail_price` and `default_web_price` to the `ProductForm` interface and `emptyForm`
- Add two new columns to the table: "Maloprodajna cena" and "Web cena"
- Add two new fields to the create/edit dialog (in the price row alongside purchase price and sale price -- change grid to 4 or 2x2)
- Include both fields in the save mutation payload
- Add them to the CSV export columns

#### `src/pages/tenant/ProductDetail.tsx`
- Show `default_web_price` in the Overview card alongside other default prices

#### `src/layouts/TenantLayout.tsx`
- Remove the `webNav` array (lines 141-144)
- Remove the `CollapsibleNavGroup` for "Web prodaja" (line 370-372)
- Add web items to `salesNav`:
  - `{ key: "webSettings", url: "/sales/web-settings", icon: Globe, section: "webSales" }`
  - `{ key: "webPrices", url: "/sales/web-prices", icon: Receipt }`
- Move `retailPrices` from `salesNav` to `inventoryNav` with URL `/inventory/retail-prices`

#### `src/App.tsx`
- Change `web/settings` route to `sales/web-settings` (requiredModule: "sales")
- Change `web/prices` route to `sales/web-prices` (requiredModule: "sales")
- Change `sales/retail-prices` route to `inventory/retail-prices` (requiredModule: "inventory")
- Remove the `/web` hub route and `WebHub` lazy import
- Delete `WebHub.tsx`

#### `src/pages/tenant/SalesHub.tsx`
- Add cards for "Web podešavanja" and "Web cene"
- Remove "Maloprodajne cene" card (moved to Inventory)

#### `src/pages/tenant/InventoryHub.tsx`
- Add "Maloprodajne cene" card under a new "Cene" section linking to `/inventory/retail-prices`

#### `src/components/layout/Breadcrumbs.tsx`
- Add `web-settings` and `web-prices` route label mappings
- Update `retail-prices` mapping

### Files Summary

| File | Action |
|------|--------|
| Migration | Add `default_web_price` column |
| `src/pages/tenant/Products.tsx` | Add retail + web price columns and form fields |
| `src/pages/tenant/ProductDetail.tsx` | Show web price in overview |
| `src/layouts/TenantLayout.tsx` | Merge webNav into salesNav, move retail to inventory |
| `src/App.tsx` | Move routes, remove WebHub |
| `src/pages/tenant/SalesHub.tsx` | Add web cards, remove retail card |
| `src/pages/tenant/InventoryHub.tsx` | Add retail prices card |
| `src/components/layout/Breadcrumbs.tsx` | Update route labels |
| `src/pages/tenant/WebHub.tsx` | Delete |




## PRD Implementation Plan: Product-Pricing Unification

This is a large 5-phase effort (~33 subtasks). I'll implement it in sequential rounds matching the PRD phases.

---

### Phase 1: Data Foundation (Round 1)

**Migration — 4 new tables + 3 ALTER statements:**

1. Create `product_categories` table (id, tenant_id, name, name_sr, parent_id self-ref, code, sort_order, is_active) + RLS + indexes
2. Add `products.category_id` FK → `product_categories`
3. Create `purchase_prices` table (product_id, partner_id, unit_cost, currency, purchase_date, quantity, document_ref, document_type CHECK, document_id, warehouse_id, notes) + RLS + indexes
4. Create `wholesale_price_lists` (name, currency, is_active, is_default, valid_from/until, notes) + RLS + trigger
5. Create `wholesale_prices` (price_list_id FK, product_id, price, min_quantity, discount_percent, valid_from/until, UNIQUE constraint) + RLS + indexes
6. ALTER `production_orders` ADD 5 cost columns (planned_material_cost, actual_material_cost, actual_labor_cost, actual_overhead_cost, unit_production_cost)
7. ALTER `bom_lines` ADD `estimated_unit_cost`

**Frontend — Phase 1:**

8. **`ProductCategories.tsx`** — New page: CRUD with collapsible tree view for parent-child hierarchy, inline edit/delete
9. **Route + sidebar** — Add `/inventory/product-categories` route in `inventoryRoutes.tsx`, add nav item in `TenantLayout.tsx` under `coreInventory` section
10. **`Products.tsx`** — Add category picker (Select with categories) to product form dialog, add category filter to products list, make default prices read-only with "(auto)" label
11. **Fix `Nivelacija.tsx`** — Change `default_sale_price` → `default_retail_price` in product query and `updateItem` handler. Auto-fetch `quantity_on_hand` from `inventory_stock` when product + warehouse selected
12. **Fix `WebPrices.tsx`** — Change `price_list_id` → `web_price_list_id` in web_prices queries/upserts

---

### Phase 2: Pricing Center (Round 2)

13. **`PricingCenter.tsx`** — New unified page with 4 tabs:
    - **Tab "Nabavne"**: purchase_prices list with product/supplier filter, timeline LineChart (recharts)
    - **Tab "Veleprodajne"**: wholesale_price_lists + wholesale_prices management (mirror retail UI pattern)
    - **Tab "Maloprodajne"**: Migrated RetailPrices.tsx code
    - **Tab "Web"**: Migrated WebPrices.tsx code (with FK fix)
    - URL param `?product=UUID` filters all tabs
14. **Route** — Add `/inventory/pricing-center` in `inventoryRoutes.tsx`
15. **Sidebar restructure** — Reorganize `inventoryNav` in TenantLayout: rename "coreInventory" → "katalog", add "Kategorije proizvoda", create "cene" section with Centar cena + Kalkulacija + Nivelacija, remove standalone Retail Prices
16. **Sales sidebar** — Remove `webPrices` nav item (now in Pricing Center)
17. **`ProductDetail.tsx`** — Replace Pricing tab content with link to PricingCenter filtered by product

---

### Phase 3: Kalkulacija/Nivelacija Master Data Sync (Round 3)

18. **Kalkulacija post enhancement** — After `post_kalkulacija` RPC, add client-side mutations:
    - INSERT `purchase_prices` per item (document_type: 'kalkulacija')
    - UPDATE `products.default_purchase_price` and `default_retail_price` per item
    - UPSERT `retail_prices` for default retail price list
19. **Nivelacija post enhancement** — After `post_nivelacija`:
    - UPDATE `products.default_retail_price` per item
    - UPSERT `retail_prices` for matching list

---

### Phase 4: Production Cost Flow (Round 4)

20. **`ProductionOrders.tsx`** — Add cost tracking panel (planned vs actual columns in table and detail view)
21. **Production completion UI** — "Završi nalog" button with dialog: enters actual costs, calls `complete_production_order` RPC
22. **Completion flow logic** — On completion:
    - Compute `unit_production_cost = total_cost / completed_qty`
    - INSERT `purchase_prices` (document_type: 'production')
    - UPDATE `products.default_purchase_price` for finished product
23. **BOM cost display** — Show `estimated_unit_cost` on BOM lines (fetched from latest purchase price)

---

### Phase 5: Price Resolution (Round 5)

24. **`src/lib/priceResolver.ts`** — Utility function `resolveProductPrice(productId, tenantId, context)` with fallback chain: specific list → default list → product default
25. **Invoice/Quote/SO** — Use `resolveProductPrice` with wholesale context
26. **POS Terminal** — Use `resolveProductPrice` with retail context for location

---

### Translation keys needed (added incrementally):
`productCategories`, `category`, `pricingCenter`, `purchasePriceHistory`, `wholesalePrices`, `katalog`, `cene`, `plannedCost`, `actualCost`, `unitProductionCost`, `completeOrder`

### Files touched per phase:
- **Phase 1**: 1 migration, `ProductCategories.tsx` (new), `Products.tsx`, `Nivelacija.tsx`, `WebPrices.tsx`, `inventoryRoutes.tsx`, `TenantLayout.tsx`, translations
- **Phase 2**: `PricingCenter.tsx` (new), `inventoryRoutes.tsx`, `TenantLayout.tsx`, `ProductDetail.tsx`, `salesRoutes.tsx`
- **Phase 3**: `Kalkulacija.tsx`, `Nivelacija.tsx`
- **Phase 4**: `ProductionOrders.tsx`, `BomTemplates.tsx`
- **Phase 5**: `priceResolver.ts` (new), `InvoiceForm.tsx`, `PosTerminal.tsx`

Starting with Phase 1 upon approval.


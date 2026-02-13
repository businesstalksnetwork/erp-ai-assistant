

# Rename "Inventar" to "Magacin", "Dokumenti" to "DMS" + Cross-Module Connection Audit

## Part 1: Renames

Simple translation changes:

| Current (SR) | New (SR) | EN stays |
|---|---|---|
| `inventory: "Inventar"` | `inventory: "Magacin"` | "Inventory" (or could change to "Warehouse") |
| `documents: "Dokumenti"` | `documents: "DMS"` | "Documents" (or "DMS") |

These are sidebar nav group labels used in `TenantLayout.tsx` via `t("inventory")` and `t("documents")`.

**Files to modify**: `src/i18n/translations.ts` only (line 1507 for SR inventory, line 1699 for SR documents).

---

## Part 2: Cross-Module Connection Audit

Here is what currently exists and what is missing between modules:

### What IS connected

| From | To | How |
|---|---|---|
| Products | Inventory Stock | `inventory_stock.product_id` -- stock levels per product per warehouse |
| Products | Retail Prices | `retail_prices.product_id` -- retail pricing per location |
| Products | Web Prices | `web_prices.product_id` -- web pricing per connection |
| Products | Invoices | `invoice_lines.product_id` -- sales invoicing |
| Products | POS | `pos_transaction_lines.product_id` -- retail sales |
| Invoices | Inventory | Posting an invoice with a warehouse deducts stock via `adjust_inventory_stock` RPC |
| Goods Receipts | Inventory | GRN receipt adds stock + creates cost layers |
| Production | Inventory | Complete & Consume moves materials out and finished goods in |
| Salespeople | POS | `pos_transactions.salesperson_id` |
| Salespeople | Invoices | `invoices.salesperson_id` |
| Salespeople | Opportunities | `opportunities.salesperson_id` |
| CRM Lead | Opportunity | Lead-to-opportunity conversion pipeline |
| Opportunity | Quote | Cross-module pipeline |
| Quote | Sales Order | Cross-module pipeline |
| Sales Order | Invoice | Cross-module pipeline |
| PO | GRN | Purchase order to goods receipt |
| GRN | Supplier Invoice | 3-way matching |

### What is MISSING (gaps to address)

| Gap | Impact | Priority |
|---|---|---|
| **Web has no link to inventory/stock** | Web prices reference products but there is no stock sync -- a Shopify/WooCommerce store cannot know what is in stock | High |
| **Web has no order import** | Orders from web platforms do not flow into Sales Orders or Invoices | High |
| **POS does not record salesperson on transactions** (UI gap) | The `salesperson_id` FK exists on `pos_transactions` but the POS terminal UI does not let you pick or auto-assign a salesperson | Medium |
| **Salespeople not linked to Quotes** | `quotes` table has no `salesperson_id` column -- wholesale analytics cannot track quote activity per komercijalista | Medium |
| **Sales Orders missing salesperson** | `sales_orders` has no `salesperson_id` -- cannot attribute order revenue to a person | Medium |
| **Web prices not shown on Product detail** | When viewing a product, you cannot see its web price or retail price side-by-side | Low |
| **No inventory reservation for Sales Orders** | Creating a sales order does not reserve stock (`reserved` qty stays 0) | Low |

---

## Proposed Implementation (this round)

### 1. Translations rename (quick)
- SR: `inventory: "Magacin"`, `documents: "DMS"`

### 2. Add `salesperson_id` to `quotes` and `sales_orders` tables
- Migration: `ALTER TABLE quotes ADD COLUMN salesperson_id uuid REFERENCES salespeople(id)`
- Migration: `ALTER TABLE sales_orders ADD COLUMN salesperson_id uuid REFERENCES salespeople(id)`
- Update Quotes.tsx and SalesOrders.tsx to show salesperson dropdown
- Update types.ts

### 3. POS Terminal: auto-assign salesperson
- Query `salespeople` where `user_id = current_user` and `role_type = 'in_store'`
- Auto-set `salesperson_id` on `pos_transactions` when completing a sale
- Show the active salesperson name in the POS header

### 4. Web inventory availability indicator
- On WebPrices.tsx, show current stock level next to each product (read from `inventory_stock`)
- Add a "Stock" column showing total on-hand across all warehouses
- This is a read-only display for now (actual sync to platforms would be a future edge function)

## Files to Create
None.

## Files to Modify

| File | Changes |
|---|---|
| Migration SQL | ALTER `quotes` + `sales_orders`: add `salesperson_id` |
| `src/i18n/translations.ts` | Rename inventory/documents in SR |
| `src/integrations/supabase/types.ts` | Add salesperson_id to quotes/sales_orders types |
| `src/pages/tenant/Quotes.tsx` | Salesperson dropdown in CRUD |
| `src/pages/tenant/SalesOrders.tsx` | Salesperson dropdown in CRUD |
| `src/pages/tenant/PosTerminal.tsx` | Auto-assign in-store salesperson |
| `src/pages/tenant/WebPrices.tsx` | Show stock availability column |

## Technical Notes

### Cross-Module Data Flow (complete picture after fixes)

```text
CRM Pipeline:
  Lead -> Opportunity (salesperson_id) -> Quote (salesperson_id) -> Sales Order (salesperson_id) -> Invoice (salesperson_id)

Retail Pipeline:
  POS Terminal (salesperson_id auto from logged-in user) -> pos_transactions -> inventory deduction

Web Pipeline (current):
  Web Connection -> Web Price Lists -> Web Prices (product_id)
  Missing: stock sync out, order import in

Inventory Flow:
  Purchase Order -> Goods Receipt (+stock, +cost layers) -> Supplier Invoice (3-way match)
  Invoice posting / POS sale -> -stock (adjust_inventory_stock RPC)
  Production complete -> -materials, +finished goods
```

### Future work (not this round)
- Edge function for product/stock sync to Shopify/WooCommerce
- Web order import (create sales orders from platform webhooks)
- Stock reservation on sales order confirmation


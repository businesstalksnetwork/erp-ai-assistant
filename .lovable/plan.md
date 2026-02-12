

# Phase 5: Inventory Management

This phase adds product/item catalog and inventory tracking to the ERP, building on top of the existing warehouses infrastructure.

---

## What gets built

### 1. Products Table (Database)

**products** -- per-tenant product/item catalog
- id, tenant_id, name, name_sr, sku, barcode
- description, unit_of_measure (pcs, kg, l, m, etc.)
- default_purchase_price, default_sale_price
- tax_rate_id (FK to tax_rates, for default tax on this product)
- is_active, created_at, updated_at
- RLS: members can view, admins/accountants can manage, super admins full access

### 2. Inventory Stock Table (Database)

**inventory_stock** -- current stock levels per product per warehouse
- id, tenant_id, product_id (FK), warehouse_id (FK)
- quantity_on_hand, quantity_reserved, quantity_available (computed or trigger-maintained)
- min_stock_level (for low-stock alerts)
- updated_at
- Unique constraint on (product_id, warehouse_id)
- RLS: members can view, admins/accountants can manage

### 3. Inventory Movements Table (Database)

**inventory_movements** -- immutable log of all stock changes
- id, tenant_id, product_id, warehouse_id
- movement_type: "in" / "out" / "adjustment" / "transfer"
- quantity, reference (e.g., invoice number)
- notes, created_by, created_at
- RLS: members can view, admins/accountants can insert

### 4. Products Management Page (`/inventory/products`)

- Table listing all products with search, SKU, price columns
- Add/Edit dialog with full product details
- Default tax rate selector
- Toggle active/inactive
- Delete with confirmation

### 5. Inventory Stock Page (`/inventory/stock`)

- Table showing current stock levels across all warehouses
- Filter by warehouse, product, low-stock only
- Inline stock adjustment (add/remove with reason)
- Low-stock badge when below min_stock_level

### 6. Inventory Movements Page (`/inventory/movements`)

- Chronological log of all stock changes
- Filter by product, warehouse, movement type, date range
- Manual adjustment entry dialog

### 7. Link Products to Invoice Lines

- Add optional `product_id` to `invoice_lines` table
- When adding an invoice line, user can pick a product from a dropdown
- Auto-fills description, unit_price, tax_rate from product defaults
- Manual override still allowed

### 8. Dashboard Low-Stock Alert

- Add a low-stock warning to the pending actions section on the dashboard
- Count of products below their min_stock_level

---

## Routes

| Route | Page |
|-------|------|
| `/inventory/products` | Products CRUD |
| `/inventory/stock` | Stock levels overview |
| `/inventory/movements` | Movement history log |

---

## Files

| Action | File |
|--------|------|
| Migration | `products`, `inventory_stock`, `inventory_movements` tables + RLS; add `product_id` to `invoice_lines` |
| Create | `src/pages/tenant/Products.tsx` |
| Create | `src/pages/tenant/InventoryStock.tsx` |
| Create | `src/pages/tenant/InventoryMovements.tsx` |
| Modify | `src/pages/tenant/InvoiceForm.tsx` -- add product dropdown to line items |
| Modify | `src/pages/tenant/Dashboard.tsx` -- add low-stock alert |
| Modify | `src/App.tsx` -- add 3 inventory routes |
| Modify | `src/layouts/TenantLayout.tsx` -- add Inventory nav group with 3 items |
| Modify | `src/i18n/translations.ts` -- add inventory/product keys (EN + SR) |

---

## Technical notes

- Products table follows the same RLS pattern as chart_of_accounts (admin + accountant roles)
- `inventory_stock` uses a unique constraint on (product_id, warehouse_id) to prevent duplicates
- Stock adjustments insert into `inventory_movements` and update `inventory_stock.quantity_on_hand` in the same transaction
- `quantity_available` = `quantity_on_hand` - `quantity_reserved`
- The product dropdown in InvoiceForm is optional -- users can still type descriptions manually
- Low-stock threshold is per-product via `min_stock_level` (default 0 = no alert)
- All queries are tenant-scoped via RLS
- Navigation gets a new "Inventory" group in the sidebar alongside existing "Menu" and "Accounting" groups


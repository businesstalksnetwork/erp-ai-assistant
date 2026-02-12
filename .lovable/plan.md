

# Phase 7: Purchasing Module (PURCH)

Add a complete procurement workflow -- from purchase orders to goods receipt and supplier invoices -- mirroring the sales pipeline on the buy side. This module integrates with existing Partners (supplier type), Inventory, and the Event Bus.

---

## What Gets Built

### 1. Purchase Orders
Create and manage purchase orders to suppliers with line items, approval workflow, and status tracking (draft, sent, confirmed, received, cancelled).

### 2. Goods Receipt Notes (GRN)
Record incoming goods against purchase orders, automatically adjusting warehouse inventory via `adjust_inventory_stock`.

### 3. Supplier Invoices
Track supplier invoices linked to purchase orders/GRNs for accounts payable, with status tracking (draft, received, approved, paid).

---

## Database (1 migration, 5 new tables)

| Table | Purpose |
|-------|---------|
| `purchase_orders` | PO header: supplier (FK to partners), status, order_date, expected_date, notes, total |
| `purchase_order_lines` | PO line items: product_id, quantity, unit_price, total |
| `goods_receipts` | GRN header: linked to purchase_order, warehouse_id, received_by, received_at, notes |
| `goods_receipt_lines` | GRN lines: product_id, quantity_ordered, quantity_received |
| `supplier_invoices` | AP invoices: linked to purchase_order, supplier (partner), invoice_number, amount, due_date, status |

All tables include tenant_id with RLS policies using `get_user_tenant_ids()`, `updated_at` triggers, and audit triggers on key tables.

### Event Bus Integration
- Emit `purchase_order.confirmed` when PO status changes to confirmed
- Emit `goods_receipt.completed` when a GRN is finalized (triggers inventory stock adjustment)
- Emit `supplier_invoice.approved` for future AP/accounting integration

---

## Frontend (3 new pages)

| Page | Route | Description |
|------|-------|-------------|
| `PurchaseOrders.tsx` | `/purchasing/orders` | CRUD for purchase orders with line items, supplier selection from Partners, status workflow |
| `GoodsReceipts.tsx` | `/purchasing/goods-receipts` | Record received goods against POs, select warehouse, auto-update inventory |
| `SupplierInvoices.tsx` | `/purchasing/supplier-invoices` | Track supplier invoices, link to PO, manage payment status |

All pages follow existing CRUD dialog patterns (consistent with Sales Orders, Quotes, etc.).

---

## Navigation & Routing

- New **Purchasing** sidebar group between CRM and HR with icon `Truck`
- Three menu items: Purchase Orders, Goods Receipts, Supplier Invoices
- Three new routes in `App.tsx`

---

## i18n

Add EN/SR translation keys for:
- Module labels (purchasing, purchaseOrders, goodsReceipts, supplierInvoices)
- Statuses (draft, sent, confirmed, received, approved, paid, cancelled)
- Form fields (supplier, expectedDate, quantityReceived, invoiceAmount, dueDate)

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/..._purchasing_module.sql` | 5 tables, RLS, triggers, event bus seed subscriptions |
| `src/pages/tenant/PurchaseOrders.tsx` | PO management with line items |
| `src/pages/tenant/GoodsReceipts.tsx` | Goods receipt against POs |
| `src/pages/tenant/SupplierInvoices.tsx` | Supplier invoice tracking |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add 3 purchasing routes |
| `src/layouts/TenantLayout.tsx` | Add Purchasing sidebar group |
| `src/i18n/translations.ts` | Add EN/SR keys |
| `src/integrations/supabase/types.ts` | Will auto-update with new table types |

---

## Technical Notes

- Suppliers are existing `partners` with `type = 'supplier'` or `'both'` -- no new supplier table needed
- Goods receipt triggers `adjust_inventory_stock` with `movement_type = 'in'` for the selected warehouse
- Purchase order line items reference `products` table for consistency with sales side
- Event bus subscriptions seeded: `goods_receipt.completed` -> inventory handler for automatic stock-in


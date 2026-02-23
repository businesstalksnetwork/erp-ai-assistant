
## Connect All Modules: Missing Cross-Module Links

### Audit Summary

After reviewing all module pages, database schema, and save logic, here are the **missing connections** that prevent the ERP from working as one unified system.

---

### Category 1: Invoice Form Does NOT Save `partner_id` or `salesperson_id`

The `invoices` table has `partner_id` and `salesperson_id` columns, but `InvoiceForm.tsx` **never includes them in the save payload** (lines 299-318). Only `partner_name`, `partner_pib`, and `partner_address` are saved as denormalized text. This breaks:
- Partner dossier transaction tab (cannot find invoices for a partner)
- CRM revenue attribution per partner
- Salesperson commission tracking
- Aging reports linked to partner accounts

**Fix:** Add `partner_id: selectedPartnerId || null` and a salesperson selector to InvoiceForm.tsx save payload.

---

### Category 2: Sales Orders Missing `legal_entity_id`, `location_id`, `warehouse_id`

The `sales_orders` table has no columns for `legal_entity_id`, `location_id`, or `warehouse_id`. This means:
- Cannot track which legal entity a sales order belongs to (critical for multi-PIB tenants)
- Cannot auto-select warehouse for dispatch note generation
- Stock reservation picks random warehouses instead of the order's assigned warehouse

**Fix:** Add `legal_entity_id`, `location_id`, `warehouse_id` columns to `sales_orders` table, and add selectors to the SalesOrders form.

---

### Category 3: Purchase Orders Missing `legal_entity_id`, `warehouse_id`

Same issue: `purchase_orders` has no `legal_entity_id` or `warehouse_id` columns. This means:
- Cannot track which legal entity issued the purchase order
- Goods receipts created from POs don't inherit a warehouse, forcing manual re-entry

**Fix:** Add `legal_entity_id`, `warehouse_id` columns to `purchase_orders` table. When creating a GRN from PO, auto-populate the warehouse.

---

### Category 4: Goods Receipts Missing `legal_entity_id`, `supplier_id`

The `goods_receipts` table has no `legal_entity_id` or `supplier_id`. When a GRN is created from a PO, only `purchase_order_id` is set. This means:
- Cannot directly query receipts by supplier without joining through PO
- No legal entity tracking for accounting postings

**Fix:** Add `legal_entity_id`, `supplier_id` columns. Auto-populate from linked PO.

---

### Category 5: Quote-to-Sales Order Conversion Drops Product Lines

When a quote is converted to a sales order in `Quotes.tsx`, the conversion copies header data (partner, amount, currency) but **does NOT copy quote_lines to sales_order_lines**. The new SO has a total but zero line items.

**Fix:** Fetch `quote_lines` during conversion and insert them as `sales_order_lines`.

---

### Category 6: Sales Order-to-Invoice Drops Product Lines

When "Create Invoice" is clicked from a sales order, only header data is passed via `location.state`. Invoice line items from `sales_order_lines` are **not carried over**, requiring re-entry of all products.

**Fix:** Fetch `sales_order_lines` and pre-fill `InvoiceForm` lines. Also save `sales_order_id` on the invoice (column exists: `invoices.sales_order_id` -- currently not in schema, would need adding).

---

### Category 7: POS Sessions Location does NOT Auto-Link Warehouse

When opening a POS session, the location's `default_warehouse_id` IS used (correctly wired in PosSessions.tsx line 70). However, the POS terminal does NOT use the location's `default_price_list_id` to look up retail prices. Products always use `default_retail_price` instead of location-specific pricing.

**Fix:** In PosTerminal.tsx, fetch the location's price list and use location-specific retail prices when available, falling back to `default_retail_price`.

---

### Category 8: Production Orders Missing Warehouse/Location Link

Production orders have no `warehouse_id` or `location_id`. The warehouse is only selected at completion time. This means:
- Cannot plan material availability against a specific warehouse in advance
- AI planning has no warehouse context for capacity simulation

**Fix:** Add `warehouse_id` column to `production_orders` and pre-select in the create form.

---

### Implementation Plan

#### Migration 1: Add missing columns

```sql
-- Sales Orders: add legal_entity_id, warehouse_id
ALTER TABLE sales_orders 
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);

-- Purchase Orders: add legal_entity_id, warehouse_id
ALTER TABLE purchase_orders 
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);

-- Goods Receipts: add legal_entity_id, supplier_id
ALTER TABLE goods_receipts 
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES partners(id);

-- Production Orders: add warehouse_id
ALTER TABLE production_orders 
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);
```

#### File Changes

| File | Change |
|------|--------|
| **Migration SQL** | Add missing FK columns to 4 tables |
| **InvoiceForm.tsx** | Save `partner_id`, add salesperson selector, save `salesperson_id` |
| **SalesOrders.tsx** | Add legal entity, warehouse selectors to form; save new columns |
| **PurchaseOrders.tsx** | Add legal entity, warehouse selectors; save new columns |
| **GoodsReceipts.tsx** | Auto-populate `supplier_id` and `legal_entity_id` from linked PO |
| **Quotes.tsx** | Copy `quote_lines` to `sales_order_lines` during conversion |
| **SalesOrders.tsx** (createInvoice) | Pass `sales_order_lines` + `salesperson_id` to InvoiceForm via state |
| **InvoiceForm.tsx** (fromSalesOrder) | Pre-fill invoice lines from sales order lines |
| **ProductionOrders.tsx** | Add warehouse selector to create/edit form |
| **PosTerminal.tsx** | Look up location price list, use location-specific prices |

### What This Fixes

After these changes, the full ERP document flow will be connected:

```
Quote (partner, products, salesperson)
  -> Sales Order (inherits: partner, lines, salesperson, legal entity, warehouse)
    -> Invoice (inherits: partner_id, lines, salesperson, legal entity)
    -> Dispatch Note (inherits: warehouse, partner)
  
Purchase Order (supplier, products, legal entity, warehouse)
  -> Goods Receipt (inherits: supplier, warehouse, legal entity)
  -> Supplier Invoice (inherits: supplier, legal entity, PO link)

POS Session (location -> warehouse -> price list)
  -> POS Terminal (uses location retail prices)

Production Order (product, BOM, warehouse)
  -> Material consumption (from assigned warehouse)
  -> Finished goods (into assigned warehouse)
```

Every entity in the system will know which partner, warehouse, location, legal entity, and salesperson it belongs to -- enabling proper cross-module navigation, reporting, and AI insights.

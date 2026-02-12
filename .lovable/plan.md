

# Phase 8: Returns Module (RET)

Add a complete returns and refunds workflow covering both customer returns (sales side) and supplier returns (purchasing side). This module integrates with existing Sales Orders, Purchase Orders, Inventory, Accounting, and the Event Bus.

---

## What Gets Built

### 1. Return Cases
A central return case record that tracks a return from initiation through inspection to resolution. Supports both customer returns (linked to sales orders/invoices) and supplier returns (linked to purchase orders).

### 2. Return Lines
Individual items being returned with quantities, reason codes, and inspection results (accepted, rejected, partial).

### 3. Credit Notes
Financial documents issued for approved customer returns, creating accounting storno entries. Links back to the original invoice for proper AR adjustment.

### 4. Supplier Return Shipments
Outbound returns to suppliers for defective/incorrect goods, linked to the original purchase order and triggering inventory deductions.

---

## Database (1 migration, 4 new tables)

| Table | Purpose |
|-------|---------|
| `return_cases` | Header: tenant_id, return_type (customer/supplier), source_type (sales_order/purchase_order/invoice), source_id, partner_id, status (draft, inspecting, approved, resolved, cancelled), opened_at, resolved_at, notes |
| `return_lines` | Line items: return_case_id, product_id, quantity_returned, quantity_accepted, reason (defective, wrong_item, damaged, not_needed, other), inspection_status (pending, accepted, rejected), notes |
| `credit_notes` | Customer credit notes: return_case_id, invoice_id (original), credit_number, amount, status (draft, issued, applied), issued_at |
| `supplier_return_shipments` | Supplier returns: return_case_id, purchase_order_id, warehouse_id, shipped_at, tracking_number, status (pending, shipped, acknowledged, credited) |

All tables include tenant_id with RLS policies, updated_at triggers, and audit triggers.

### Event Bus Integration
- `return_case.approved` -- triggers inventory adjustment (stock-in for customer returns to warehouse)
- `credit_note.issued` -- triggers accounting storno (reversal journal entry against original invoice)
- `supplier_return.shipped` -- triggers inventory deduction (stock-out from warehouse)

---

## Frontend (1 new page, unified)

| Page | Route | Description |
|------|-------|-------------|
| `Returns.tsx` | `/returns` | Unified returns management with tabs for Customer Returns / Supplier Returns / Credit Notes. Create return cases, log inspection results, issue credit notes, track supplier return shipments. |

A single page with tab-based navigation keeps the workflow cohesive rather than splitting across multiple pages.

---

## Navigation and Routing

- New **Returns** sidebar group between Purchasing and HR with icon `RotateCcw`
- One menu item: Returns
- One new route in `App.tsx`

---

## i18n

Add EN/SR translation keys for:
- Module labels (returns, returnCases, creditNotes, supplierReturns)
- Statuses (inspecting, approved, resolved, issued, applied, shipped, acknowledged, credited)
- Reason codes (defective, wrongItem, damaged, notNeeded)
- Form fields (returnType, sourceDocument, quantityReturned, quantityAccepted, inspectionStatus, creditAmount)

---

## Edge Function Updates

Add handlers in `process-module-event` for:
- `return_case.approved` with `handler_module = 'inventory'` -- call `adjust_inventory_stock` with `movement_type = 'in'` for accepted return lines
- `credit_note.issued` with `handler_module = 'accounting'` -- placeholder for storno journal entry creation
- `supplier_return.shipped` with `handler_module = 'inventory'` -- call `adjust_inventory_stock` with `movement_type = 'out'` for returned-to-supplier lines

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/..._returns_module.sql` | 4 tables, RLS, triggers, event bus seed subscriptions |
| `src/pages/tenant/Returns.tsx` | Unified returns management with tabs |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add 1 returns route |
| `src/layouts/TenantLayout.tsx` | Add Returns sidebar group |
| `src/i18n/translations.ts` | Add EN/SR keys |
| `supabase/functions/process-module-event/index.ts` | Add return event handlers |

---

## Technical Notes

- Return cases use polymorphic `source_type` + `source_id` to link to sales orders, purchase orders, or invoices
- Partners table is reused (customer or supplier depending on return_type)
- Credit notes reference the original invoice for accounting reconciliation
- Serbian accounting requires "storno" (reversal) entries rather than negative invoices -- the credit note event handler will create reversing journal entries
- Inspection workflow: draft -> inspecting -> approved/cancelled -> resolved (after credit note or supplier return completed)
- Inventory adjustments only happen after inspection approval, not at return initiation



# Phase 15: Cross-Module Pipeline Integrations

## Overview

All modules have individual CRUD, but they operate as isolated silos. This phase connects them into real business workflows by adding conversion actions across the CRM, Purchasing, Production, and Accounting pipelines.

---

## What Gets Built

### 1. CRM Pipeline Conversions

**Lead -> Opportunity**: "Convert to Opportunity" button on Leads page
- Changes lead status to "converted"
- Pre-creates an Opportunity linked to that lead, pre-filling name, partner info
- Navigates user to the Opportunities page

**Opportunity -> Quote**: "Create Quote" button on Opportunities page
- Creates a Quote linked to the opportunity with partner and currency pre-filled
- Navigates to Quotes page

**Quote -> Sales Order**: "Convert to Sales Order" button on Quotes page (only for "accepted" quotes)
- Creates a Sales Order linked to the quote with partner, currency pre-filled
- Updates quote status to "accepted" if not already

**Sales Order -> Invoice**: "Create Invoice" button on Sales Orders page (only for "confirmed" or "delivered" orders)
- Navigates to `/accounting/invoices/new` passing sales order data via URL state
- Pre-fills partner, currency, and line items from the sales order

### 2. Purchasing Pipeline Conversions

**Purchase Order -> Goods Receipt**: "Create GRN" button on Purchase Orders page (for "confirmed"/"sent" POs)
- Opens Goods Receipts page and pre-fills with PO lines (already partially implemented via select dropdown, but needs a direct action button)

**Purchase Order -> Supplier Invoice**: "Create Invoice" button on Purchase Orders page
- Opens Supplier Invoices page with supplier, amount, and currency pre-filled

### 3. Production -> Inventory Consumption

**Complete Production Order**: "Complete and Consume Materials" action
- When marking a production order as "completed", consumes BOM materials from inventory using `adjust_inventory_stock` RPC
- Adds the finished product to inventory (quantity produced)
- Requires selecting a warehouse

### 4. Supplier Invoice -> Accounting

**Approve Supplier Invoice -> Journal Entry**: When marking a supplier invoice as "approved"
- Creates a journal entry debiting expense account, crediting accounts payable
- Similar pattern to customer invoice posting

**Pay Supplier Invoice -> Payment Journal**: When marking as "paid"
- Creates a payment journal entry debiting accounts payable, crediting bank/cash

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/Leads.tsx` | Add "Convert to Opportunity" button per lead row |
| `src/pages/tenant/Opportunities.tsx` | Add "Create Quote" button per opportunity row |
| `src/pages/tenant/Quotes.tsx` | Add "Convert to Sales Order" button for accepted quotes |
| `src/pages/tenant/SalesOrders.tsx` | Add "Create Invoice" button for confirmed/delivered orders |
| `src/pages/tenant/PurchaseOrders.tsx` | Add "Create GRN" and "Create Supplier Invoice" action buttons |
| `src/pages/tenant/ProductionOrders.tsx` | Add warehouse selection dialog and material consumption on completion |
| `src/pages/tenant/SupplierInvoices.tsx` | Add "Approve" and "Mark Paid" actions with journal entry creation |
| `src/i18n/translations.ts` | Add conversion action labels |

---

## Technical Details

### CRM Conversion Pattern

Each conversion button:
1. Creates the target record via Supabase insert
2. Updates the source record status (e.g., lead -> "converted")
3. Shows a success toast with a link/navigation to the created record
4. Uses `useMutation` with query invalidation for both source and target tables

### Production Material Consumption

When a production order is marked "completed":
1. A dialog appears asking for the target warehouse
2. Fetch BOM template lines for the selected BOM
3. For each BOM material line: call `adjust_inventory_stock` with negative quantity (consumption)
4. For the finished product: call `adjust_inventory_stock` with positive quantity (production output)
5. Update production order status to "completed" with actual end date

### Supplier Invoice Journal Entries

Since there is no existing RPC for supplier invoice posting, the journal entry will be created client-side:
1. On "approve": insert a journal entry with:
   - Debit: expense account (or a default "purchases" account from chart_of_accounts)
   - Credit: accounts payable account
2. On "mark paid": insert a journal entry with:
   - Debit: accounts payable
   - Credit: bank/cash account
3. Both auto-post the journal entry

### Navigation with Pre-filled Data

For Sales Order -> Invoice conversion, use React Router's `navigate()` with `state` parameter:
```text
navigate("/accounting/invoices/new", { state: { fromSalesOrder: orderData } })
```
The InvoiceForm component will check `location.state` and pre-fill fields accordingly.

### i18n Keys to Add

convertToOpportunity, createQuote, convertToSalesOrder, createInvoiceFromOrder, createGRN, createSupplierInvoice, completeAndConsume, selectWarehouse, materialsConsumed, approveInvoice, markAsPaidSupplier, conversionSuccess

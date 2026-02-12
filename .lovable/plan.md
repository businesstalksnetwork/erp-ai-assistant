

# Phase 19: Approval Enforcement, Sales Order Accounting & GRN Journals

## Overview

This phase completes the deferred approval workflow enforcement and adds missing accounting integrations for Sales Orders and Goods Receipts, ensuring every state-changing transaction flows through to the General Ledger.

---

## What Gets Built

### 1. Approval Workflow Enforcement (Deferred from Phase 18)

The `approval_workflows` and `approval_requests` tables exist but are never checked before critical actions.

**Implementation**: Create a reusable `useApprovalCheck` hook that:
1. Looks up active approval workflows for the given `entity_type` and tenant
2. If `threshold_amount` is set and the transaction amount exceeds it, blocks the action
3. Checks if an existing approved `approval_requests` record exists for this entity -- if so, proceeds
4. Otherwise, inserts a new `approval_requests` row with status `pending` and shows an "Approval Required" dialog
5. Fires a `approval.requested` module event via `process-module-event` edge function

**Integrate into**:
- `Invoices.tsx` -- before posting (status change to `sent`)
- `SupplierInvoices.tsx` -- before approving
- `PurchaseOrders.tsx` -- before confirming (status change to `confirmed`)

### 2. Goods Receipt Inventory Journal Entries

**Current gap**: GRN completion calls `adjust_inventory_stock` RPC but creates no journal entry.

**Fix**: When a Goods Receipt is marked `completed`, post:
- Debit `1200` (Inventory) / Credit `2100` (AP/Goods Received Not Invoiced)
- Value = quantity_received x product purchase price

### 3. Sales Order to Invoice Conversion Enhancement

**Current gap**: Sales Orders have statuses but no "Convert to Invoice" action and no accounting integration.

**Fix**: Add a "Create Invoice" button on confirmed/shipped Sales Orders that:
- Pre-fills an invoice from SO data (partner, lines, amounts)
- Navigates to the invoice form with pre-populated state

### 4. Quote to Sales Order Flow Validation

**Current gap**: Quotes can be converted to Sales Orders but there's no status validation.

**Fix**: Only allow conversion of quotes with status `accepted`. Show a toast error for other statuses.

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `src/hooks/useApprovalCheck.ts` | New hook -- checks workflows, manages approval_requests, returns gating logic |
| `src/pages/tenant/Invoices.tsx` | Integrate approval check before posting |
| `src/pages/tenant/SupplierInvoices.tsx` | Integrate approval check before approving |
| `src/pages/tenant/PurchaseOrders.tsx` | Integrate approval check before confirming |
| `src/pages/tenant/GoodsReceipts.tsx` | Add journal entry on completion (Debit 1200 / Credit 2100) |
| `src/pages/tenant/SalesOrders.tsx` | Add "Create Invoice" button on confirmed orders |
| `src/pages/tenant/Quotes.tsx` | Validate status before SO conversion |
| `src/i18n/translations.ts` | Add keys for approval dialogs, GRN posting, SO conversion |

No database migration needed -- `approval_requests` table and all required accounts already exist.

---

## Technical Details

### useApprovalCheck Hook

```text
function useApprovalCheck(tenantId, entityType)
  returns {
    checkApproval(entityId, amount, onApproved): void
  }

Logic:
1. Fetch active workflow: approval_workflows WHERE entity_type = X AND is_active = true
2. If no workflow found OR amount < threshold_amount -> call onApproved() immediately
3. Check approval_requests WHERE entity_type = X AND entity_id = Y AND status = 'approved'
   -> If found, call onApproved()
4. Otherwise, insert approval_requests (status: 'pending'), show toast "Approval required", block action
```

### GRN Completion Journal (PRC)

```text
On GoodsReceipt status -> "completed":
For each line with quantity_received > 0:
  value = quantity_received * product.default_purchase_price

Total value = sum of all line values

Debit 1200 (Inventory): total_value
Credit 2100 (AP / Goods Received): total_value
Reference: "GRN-{receipt_number}"
```

### Sales Order -> Invoice Conversion

```text
On "Create Invoice" click (confirmed/shipped SO):
1. Fetch SO lines from sales_order_lines
2. Navigate to /invoices/new with state: {
     fromSO: { partner_id, partner_name, lines, currency, sales_order_id }
   }
3. InvoiceForm pre-fills from this state (same pattern as PO -> Supplier Invoice)
```

### i18n Keys to Add

approvalRequired, approvalPending, approvalSubmitted, awaitingApproval, approvalGranted, createInvoiceFromSO, grnJournalCreated, quoteNotAccepted, convertToInvoice

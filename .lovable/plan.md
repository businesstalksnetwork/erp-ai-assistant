

## v2.4 Round 1 — POS Stock + Credit Notes + SO→Invoice

### Current State

1. **POS stock**: `completeSale` calls `consume_fifo_layers` but never calls `adjust_inventory_stock` — physical stock quantity is not decremented. `processRefund` does neither stock restoration nor FIFO reversal.
2. **Credit notes**: `credit_notes` table already exists (with `invoice_id`, `journal_entry_id`, `subtotal`, `tax_amount`). `CreditDebitNotes.tsx` is a manual amount-entry form — no line-item selection from original invoice, no inventory restoration.
3. **SO→Invoice**: Already implemented in `SalesOrderDetail.tsx` (line 163-188) — navigates to `InvoiceForm` with pre-filled lines. Missing: auto-post option and SO status update after conversion.

### Implementation Plan

**#1 POS inventory stock deduction (PosTerminal.tsx)**
- In `completeSale`, after FIFO consumption loop (line 346-359), add a parallel loop calling `adjust_inventory_stock` with negative quantity for each cart item
- In `processRefund`, after fiscalization succeeds, add `adjust_inventory_stock` with positive quantity to restore stock for each refunded item
- Also add `consume_fifo_layers` reversal consideration (or skip — FIFO layers are consumed, refund creates new receipt layer via goods-receipt pattern)

**#2 Enhanced Credit Note flow (CreditDebitNotes.tsx)**
- Add "Create from Invoice" button that opens invoice picker
- When invoice selected, fetch `invoice_items` and display line-item selector with quantity controls (partial credit)
- Auto-calculate subtotal/tax from selected lines
- On post: call `postWithRuleOrFallback` with reversed DR/CR (already done for manual entry)
- Add `adjust_inventory_stock` for credited product lines to restore inventory
- No new DB tables needed — `credit_notes` already has `invoice_id`, `subtotal`, `tax_amount` columns

**#3 SO→Invoice auto-post + status update (SalesOrderDetail.tsx)**
- Add checkbox "Auto-post invoice" in the conversion flow state passed to `InvoiceForm`
- After conversion, update `sales_orders.status` to `'invoiced'`
- In `InvoiceForm`, detect `fromSalesOrder.autoPost` flag and trigger posting after save

**#4 Update documentation**
- Remove "POS does not yet deduct inventory stock" from `docs/06-sales-purchasing-pos.md`
- Remove "No credit note / return invoice flow" gap
- Remove "Sales order → Invoice conversion does not auto-post" gap

### Files Modified
- `src/pages/tenant/PosTerminal.tsx` — add `adjust_inventory_stock` in sale + refund
- `src/pages/tenant/CreditDebitNotes.tsx` — add invoice line picker, inventory restoration
- `src/pages/tenant/SalesOrderDetail.tsx` — add auto-post flag, status update on conversion
- `docs/06-sales-purchasing-pos.md` — remove resolved known gaps

### No DB migration needed
All required tables and columns already exist.


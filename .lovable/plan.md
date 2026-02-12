

# Deep Implementation: Sidebar Restructure + Accounting Logic Integration

This plan addresses the two core problems: the sidebar navigation is flat/cluttered, and the accounting logic is disconnected (invoices don't create journal entries, inventory adjustments aren't atomic, etc.).

---

## Part 1: Sidebar Restructure

The current sidebar has a "Menu" group that mixes Dashboard, Settings, Users, Audit Log, Tax Rates, and Partners together. Settings sub-pages are duplicated (sidebar + settings page cards). The navigation needs proper grouping.

### New sidebar structure

```text
--- Main ---
  Dashboard

--- Inventory ---
  Products
  Stock Overview
  Movement History

--- Accounting ---
  Chart of Accounts
  Journal Entries
  Invoices
  Fiscal Periods
  General Ledger
  Reports

--- Settings ---
  Company Settings (hub page linking to legal entities, locations, warehouses, etc.)
  Partners
  Tax Rates
  Users
  Audit Log
```

This separates concerns cleanly: Dashboard stands alone, Inventory and Accounting are business modules, and Settings groups all configuration.

---

## Part 2: Invoice-to-Journal Entry Automation

Currently, invoices are created but never generate journal entries. This is the most critical missing link in the accounting flow.

### What happens when an invoice is posted (status changed to "sent")

A journal entry is auto-created with these lines:
- **Debit**: Accounts Receivable (asset account) for the gross total
- **Debit/Credit**: Tax Payable (liability account) for the tax amount
- **Credit**: Revenue account(s) for the net subtotal

### What happens when an invoice is marked "paid"

A second journal entry is created:
- **Debit**: Bank/Cash account (asset)
- **Credit**: Accounts Receivable (asset) -- clears the receivable

### Implementation approach

- Create a **database function** `create_journal_from_invoice(invoice_id uuid)` that:
  1. Reads the invoice + lines
  2. Looks up standard accounts (receivable, revenue, tax payable) from chart_of_accounts by convention codes (e.g., `1200` = Receivable, `6000` = Revenue, `4700` = Tax Payable)
  3. Inserts a journal_entry + journal_lines in a single transaction
  4. Returns the new journal_entry ID
- Call this function from the frontend when invoice status changes to "sent" or "paid"
- Store `journal_entry_id` on the invoice for traceability (new column)

---

## Part 3: Atomic Inventory Operations

Currently, stock adjustments do two separate Supabase calls (insert movement + update stock) without transaction safety.

### Fix

- Create a **database function** `adjust_inventory_stock(p_tenant_id, p_product_id, p_warehouse_id, p_quantity, p_movement_type, p_notes, p_created_by, p_reference)` that:
  1. Inserts into `inventory_movements`
  2. Upserts `inventory_stock` (increment/decrement `quantity_on_hand`) 
  3. All in one transaction
- Update `InventoryStock.tsx` to call this function via `supabase.rpc()` instead of two separate queries

---

## Part 4: Invoice Creates Inventory Movements

When an invoice with product lines is posted ("sent"), automatically create "out" inventory movements for each product line that has a `product_id`. This connects sales to inventory deduction.

### Implementation

- Extend the `create_journal_from_invoice` function (or create a companion `process_invoice_post`) to also loop through invoice lines with `product_id` and call the inventory adjustment function for each
- The user needs to select a default warehouse (or per-line warehouse) for outbound movements

---

## Part 5: Seed Standard Chart of Accounts

New tenants currently have an empty chart of accounts. For the journal automation to work, we need standard accounts. 

### Seed accounts on tenant creation

Create a function `seed_tenant_chart_of_accounts(tenant_id)` triggered on tenant insert, seeding:
- `1200` Accounts Receivable (asset)
- `1000` Cash/Bank (asset)
- `2100` Accounts Payable (liability)
- `4700` Tax Payable (liability)  
- `3000` Equity (equity)
- `6000` Sales Revenue (revenue)
- `7000` Cost of Goods Sold (expense)
- `8000` General Expenses (expense)

---

## Files to change

| Action | File | What |
|--------|------|------|
| Modify | `src/layouts/TenantLayout.tsx` | Restructure sidebar into 4 groups (Main, Inventory, Accounting, Settings) |
| Migration | New SQL migration | Add `journal_entry_id` column to invoices; create `adjust_inventory_stock()` RPC; create `create_journal_from_invoice()` RPC; create `seed_tenant_chart_of_accounts()` function + trigger |
| Modify | `src/pages/tenant/Invoices.tsx` | When changing status to "sent", call `create_journal_from_invoice` RPC; show linked journal entry |
| Modify | `src/pages/tenant/InventoryStock.tsx` | Replace two-query adjustment with single `adjust_inventory_stock` RPC call |
| Modify | `src/i18n/translations.ts` | Add missing keys for new sidebar labels, status messages |
| Modify | `src/integrations/supabase/types.ts` | Update types for new columns and RPC functions |

---

## Technical notes

- The `create_journal_from_invoice` function uses convention-based account codes (1200, 6000, 4700). If accounts don't exist, the function will raise a clear error telling the user to set up their chart of accounts first.
- `adjust_inventory_stock` uses `INSERT ... ON CONFLICT (product_id, warehouse_id) DO UPDATE` to auto-create stock records.
- The invoice-to-inventory flow is optional: only lines with `product_id` set trigger stock movements.
- Journal entries created from invoices are auto-posted (status = 'posted') with a reference back to the invoice number.
- All database functions run as `SECURITY DEFINER` with `SET search_path TO 'public'` for consistency with existing patterns.


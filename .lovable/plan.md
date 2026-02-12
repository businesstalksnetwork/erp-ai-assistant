

# Phase 17: 3-Way Matching, Returns Accounting & Fixed Asset Journals

## Overview

This phase addresses the three most critical remaining PRD gaps: procurement 3-way matching (a hard requirement before supplier invoice approval), returns/credit note accounting entries, and fixed asset depreciation journal entries.

---

## What Gets Built

### 1. 3-Way Matching (PO / GR / Supplier Invoice)

**PRD Reference**: Section 14.3 -- "3-way match PO/GR/Inv pre 'approve'"

**Current problem**: Supplier Invoices can be approved without verifying that quantities and amounts match the Purchase Order and Goods Receipt.

**Implementation**:
- When a Supplier Invoice has a linked `purchase_order_id`, the "Approve" action will:
  1. Fetch the PO lines and GR lines for that PO
  2. Compare: PO ordered qty vs GR received qty vs Invoice qty
  3. Compare: PO unit price vs Invoice unit price (tolerance configurable, default 0)
  4. If mismatches exist, show a warning dialog listing discrepancies and require explicit user confirmation
  5. If no PO is linked, approval proceeds without matching (service/expense invoices)
- Add a visual match status badge on the Supplier Invoice table: "matched", "partial", "unmatched", "n/a"

### 2. Returns & Credit Notes Accounting (PRC 14.4)

**PRD Reference**: Section 14.4 -- Return.Receipt RESTOCK: Debit Inventory / Credit COGS; CreditNote: Debit Revenue / Credit AR

**Current problem**: Returns page has full CRUD with inspection workflow but generates no journal entries or inventory movements when a return is resolved.

**Implementation**:
- When a customer return is marked "resolved" with accepted items:
  - **Inventory**: Call `adjust_inventory_stock` to add accepted quantities back (restock)
  - **Journal Entry** (RESTOCK): Debit `1200` (Inventory) / Credit `7000` (COGS) for cost value
  - **Credit Note Journal**: Debit `4000` (Revenue) + Debit `4700` (Output VAT reversal) / Credit `1200` (AR) for invoice value
- When a supplier return (RMA) is resolved:
  - **Journal Entry**: Debit `2100` (AP) / Credit `1200` (Inventory) for returned goods value

### 3. Fixed Asset Depreciation Journal Entries

**PRD Reference**: Section 6.6 -- "amortizacioni planovi, rashodovanja/prodaje"

**Current problem**: The "Run Depreciation" button creates depreciation records in `asset_depreciations` but never posts journal entries.

**Implementation**:
- After each depreciation run, create a journal entry:
  - Debit `8100` (Depreciation Expense) / Credit `1290` (Accumulated Depreciation)
- On asset disposal (status changed to "disposed"):
  - Debit `1290` (Accumulated Depreciation) + Debit loss account / Credit `1200` (Asset at cost)
  - Calculate gain/loss = (acquisition_cost - accumulated_depreciation - disposal_proceeds)

### 4. Seed Missing Standard Accounts

Add accounts needed by the new posting rules:
- `1290` - Accumulated Depreciation / Ispravka vrednosti - contra-asset
- `8100` - Depreciation Expense / Amortizacija - expense
- `4000` - Revenue / Prihodi od prodaje - revenue (verify exists)
- `1200` - Inventory / Zalihe - asset (verify exists)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/SupplierInvoices.tsx` | Add 3-way matching check before approve; add match status badge |
| `src/pages/tenant/Returns.tsx` | Add journal entry + inventory movement creation on "resolved" |
| `src/pages/tenant/FixedAssets.tsx` | Add journal entries for depreciation runs and disposals |
| `src/lib/journalUtils.ts` | No changes needed -- reuse `createCodeBasedJournalEntry` |
| `src/i18n/translations.ts` | Add keys for matching, returns accounting, depreciation posting |
| Database migration | Seed `1290` and `8100` accounts; verify `1200` and `4000` exist |

---

## Technical Details

### 3-Way Matching Logic

When user clicks "Approve" on a Supplier Invoice that has a `purchase_order_id`:

1. Fetch PO lines: `purchase_order_lines` where `purchase_order_id = X`
2. Fetch GR lines: `goods_receipt_lines` via `goods_receipts` where `purchase_order_id = X` and `status = 'completed'`
3. Group GR lines by `product_id` and sum `quantity_received`
4. For each PO line, compare:
   - `po.quantity` vs `sum(gr.quantity_received)` vs invoice amount (if line-level) or total
   - If qty mismatch > 0, flag as discrepancy
5. Show a confirmation dialog with discrepancy table if any mismatches found
6. User can "Approve Anyway" (with audit note) or "Cancel"

### Returns Accounting Pattern

On customer return "resolved":
```text
// For each accepted return line:
// 1. Restock inventory
adjust_inventory_stock(product_id, warehouse_id, +quantity_accepted)

// 2. COGS reversal journal (at cost)
Debit 1200 (Inventory) / Credit 7000 (COGS)  -- quantity * unit_cost

// 3. Credit note journal (at invoice price)
Debit 4000 (Revenue) / Credit 1200 (AR)  -- quantity * unit_price
Debit 4700 (Output VAT reversal) / Credit 1200 (AR)  -- tax portion
```

### Fixed Asset Depreciation Journal

On depreciation run for asset:
```text
monthly_depreciation = (acquisition_cost - salvage_value) / useful_life_months

Debit 8100 (Depreciation Expense): monthly_depreciation
Credit 1290 (Accumulated Depreciation): monthly_depreciation
Reference: "DEP-{asset_name}-{period}"
```

On disposal:
```text
book_value = acquisition_cost - accumulated_depreciation
loss_or_gain = book_value - disposal_proceeds (future field)

Debit 1290 (Accumulated Depreciation): accumulated_depreciation
Debit 8200 (Loss on Disposal): loss (if any)
Credit 1200 (Fixed Asset at Cost): acquisition_cost
Credit 4200 (Gain on Disposal): gain (if any)
```

### Seeded Accounts (Migration)

Add to `seed_tenant_chart_of_accounts` for all existing tenants:
- `1290` - Ispravka vrednosti / Accumulated Depreciation - asset (contra)
- `8100` - Amortizacija / Depreciation Expense - expense
- `8200` - Gubici od rashodovanja / Loss on Disposal - expense
- `4200` - Dobici od prodaje sredstava / Gain on Disposal - revenue

### i18n Keys to Add

threeWayMatch, matchStatus, matched, partialMatch, unmatched, discrepancyFound, approveAnyway, poQuantity, grQuantity, invoiceQuantity, returnPosted, creditNoteCreated, restockCompleted, depreciationPosted, disposalPosted, accumulatedDepreciation, depreciationExpense


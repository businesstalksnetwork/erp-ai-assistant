

# Phase 17: COMPLETED — 3-Way Matching, Returns Accounting & Fixed Asset Journals

All items implemented. See below for what was built.

## Completed

### 1. 3-Way Matching (Supplier Invoices)
- Approve action now fetches PO lines and GR lines, compares quantities
- Discrepancy dialog shown if mismatches found, user can "Approve Anyway"
- Match status badge column added to table

### 2. Returns Accounting (PRC 14.4)
- Customer return "resolved" → restock inventory via `adjust_inventory_stock` + COGS reversal journal (Debit 1200 / Credit 7000) + credit note journal (Debit 4000 / Credit 1200)
- Supplier return → journal entry (Debit 2100 / Credit 1200)

### 3. Fixed Asset Depreciation Journals
- Depreciation run → journal entry (Debit 8100 / Credit 1290) linked to depreciation record
- Asset disposal → journal entry (Debit 1290 + 8200 / Credit 1200)

### 4. Seeded Accounts
- 1290 (Accumulated Depreciation), 4000 (Revenue), 4200 (Gain on Disposal), 8100 (Depreciation Expense), 8200 (Loss on Disposal)

### 5. i18n
- All keys added in both EN and SR

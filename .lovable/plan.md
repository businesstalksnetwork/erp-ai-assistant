
# Fix Analytics Pages Data Logic

## Root Cause Analysis

After investigating the database and code, I found **3 categories of bugs** causing most analytics pages to show zeros or wrong numbers:

### Bug 1: Hardcoded Account Code Prefixes Don't Match Actual Data
The actual chart of accounts uses these codes: `1200` (AR/asset), `2100` (AP/liability), `4700` (VAT/liability), `6000` (Revenue), `8000` (Expenses).

But several pages hardcode Serbian kontni okvir prefixes like `"24"`, `"20"`, `"54"`, `"50"` which don't match ANY actual account codes. This causes computed values to be zero.

**Affected pages:**
- `WorkingCapitalStress.tsx` -- cash=0, inventory incorrectly mapped, AP missed
- `MarginBridge.tsx` -- COGS=0, depreciation=0, everything lumped into OpEx
- `VatCashTrap.tsx` -- bankBalance=0
- `EarlyWarningSystem.tsx` -- expense code classification misses

### Bug 2: Wrong Column Names in InventoryHealth
`InventoryHealth.tsx` queries `quantity` and `min_level` but the actual columns are `quantity_on_hand` and `min_stock_level`. All stock quantities read as null/0.

### Bug 3: Hardcoded Turnover Ratio
`InventoryHealth.tsx` line 101: `turnoverRatio = (totalValue * 0.7 / totalValue)` -- always returns 0.7 regardless of data. This is a placeholder that was never replaced.

---

## Fixes

### 1. WorkingCapitalStress.tsx
Replace code-prefix-based sub-classification with `account_type` + `name`-based matching:
- Cash: `account_type === "asset"` AND name contains "cash", "bank", "gotovina", "banka"
- Receivables: `account_type === "asset"` AND name contains "receivable" or "potraziv"
- Inventory: `account_type === "asset"` AND name contains "inventor" or "zalih"
- Current liabilities: `account_type === "liability"` (all)
- This ensures it works regardless of account code scheme

### 2. MarginBridge.tsx
Replace code-prefix logic for expense sub-classification:
- COGS: use `is_variable_cost === true` flag (already in the schema)
- Depreciation: match name containing "depreciation", "amortizacija"
- OpEx: everything else with `account_type === "expense"`

### 3. VatCashTrap.tsx
Fix bank balance calculation: instead of matching code prefixes "24"/"20", match asset accounts with names containing "cash", "bank", "gotovina", "banka"

### 4. InventoryHealth.tsx
- Fix column names: `quantity` to `quantity_on_hand`, `min_level` to `min_stock_level`
- Replace hardcoded turnover ratio with actual COGS-based calculation using journal_lines expense data

### 5. EarlyWarningSystem.tsx
Already uses `account_type` for expense detection (works correctly). No changes needed.

---

## Pages That Already Work Correctly
- **CustomerRiskScoring** -- uses invoices/open_items tables directly
- **SupplierDependency** -- uses supplier_invoices table directly
- **PayrollBenchmark** -- uses account_type for revenue, payroll_runs for payroll
- **BusinessPlanning** -- uses account_type for classification

---

## Technical Details

### Name-based matching helper
Create a simple helper function used across affected pages:

```typescript
const nameMatch = (name: string, ...terms: string[]) =>
  terms.some(t => name.toLowerCase().includes(t));
```

### Files to modify

| File | Change |
|---|---|
| `src/pages/tenant/WorkingCapitalStress.tsx` | Replace code prefix logic with account_type + name matching for asset sub-classification and liability detection |
| `src/pages/tenant/MarginBridge.tsx` | Use is_variable_cost for COGS, name matching for depreciation |
| `src/pages/tenant/VatCashTrap.tsx` | Fix bank balance to use name matching instead of code prefixes |
| `src/pages/tenant/InventoryHealth.tsx` | Fix column names (quantity_on_hand, min_stock_level), compute real turnover ratio |

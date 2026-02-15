

# Standardize All Number Formatting to 2 Decimal Places

## Problem

Number formatting is inconsistent across ~50 files. Some use `minimumFractionDigits: 2`, some have no max, some use no decimals at all (e.g., the new Expenses page), and others use `.toFixed()` with varying precision.

## Solution

### 1. Create a shared formatter in `src/lib/utils.ts`

Add a single `fmtNum` helper function:

```typescript
export const fmtNum = (n: number) =>
  n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```

### 2. Replace all inline formatters across ~30 files

Remove per-file `const fmtNum = ...` definitions and `toLocaleString("sr-RS", {...})` calls, importing the shared `fmtNum` from `@/lib/utils` instead.

**Files to update (grouped by pattern):**

**A. Files with local `fmtNum` definitions (replace with import):**
- Dashboard.tsx, Payroll.tsx, Nivelacija.tsx, Kalkulacija.tsx, Kompenzacija.tsx, Deductions.tsx, Allowances.tsx, InvoiceForm.tsx, InventoryCostLayers.tsx, InventoryMovements.tsx, ProductDetail.tsx, PdvPeriods.tsx

**B. Files using inline `.toLocaleString("sr-RS")` without decimals (add 2 decimals):**
- Expenses.tsx (stats, chart tooltip, table cells)
- CompanyDetail.tsx (if numeric, not date)

**C. Files using `.toLocaleString("sr-RS", { minimumFractionDigits: 2 })` without max (add max):**
- Invoices.tsx, ProductionOrderDetail.tsx, ProductionOrders.tsx, InvoiceForm.tsx (inline calls)

**D. Files using `.toFixed()` for display (switch to `fmtNum` for consistent Serbian locale formatting):**
- TrialBalance.tsx (CSV export can keep toFixed)
- BusinessPlanning.tsx, BreakEvenAnalysis.tsx, FinancialRatios.tsx, ProfitabilityAnalysis.tsx, CashFlowForecast.tsx, BudgetVsActuals.tsx

**E. Chart components with inline formatters:**
- RevenueExpensesChart.tsx, CashFlowChart.tsx, TopCustomersChart.tsx, OpportunityPipelineChart.tsx, WinLossChart.tsx, LeadFunnelChart.tsx

### 3. Exceptions (keep as-is)

- Percentage values (e.g., `toFixed(1) + "%"`) -- these are not currency
- Date `.toLocaleString("sr-RS")` calls -- not numeric
- CSV export formatters using `.toFixed(2)` -- these need plain strings, not locale-formatted

## Technical Notes

- The shared `fmtNum` uses Serbian locale (`sr-RS`) with comma as decimal separator per project convention
- All monetary values will display as e.g., `1.234.567,89` instead of `1234568` or `1234567.89`
- No functional changes -- purely display formatting consistency


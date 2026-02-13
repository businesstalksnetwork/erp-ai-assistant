

# Add AI Enhancements to Budget vs Actuals and Cash Flow Forecast

## Task 1: Budget vs Actuals -- AI Anomaly Detection Alerts

### What changes
**File: `src/pages/tenant/BudgetVsActuals.tsx`**

- Compute `overBudgetRows` from the existing `rows` array: filter where `variancePct < -20` (actual exceeds budget by >20%)
- Add an alert banner at the top (below PageHeader, above chart) when over-budget accounts exist, listing the top offenders with their variance percentages
- Use the existing `Alert` and `AlertTriangle` components (same pattern as `CashFlowForecast.tsx`)
- Add the `AiAnalyticsNarrative` component with `contextType: "dashboard"` passing the over-budget account data so the LLM can provide context-aware spending advice
- Data passed to narrative: `{ overBudgetCount, totalBudget, totalActual, topOverBudget: [{code, name, budget, actual, variancePct}] }`

### New imports needed
- `Alert, AlertDescription` from `@/components/ui/alert`
- `AlertTriangle` from `lucide-react`
- `AiAnalyticsNarrative` from `@/components/ai/AiAnalyticsNarrative`

## Task 2: Cash Flow Forecast -- AI Narrative Summary

### What changes
**File: `src/pages/tenant/CashFlowForecast.tsx`**

- Import `AiAnalyticsNarrative`
- Add the component after the projected cash card (bottom of page) with `contextType: "cashflow"`
- Pass forecast KPIs as data: `{ bankBalance, arTotal, apOutstanding, monthlyLoanPayment, projectedCash, hasNegativeMonth, collectionRate }`
- The existing `ai-analytics-narrative` edge function already supports `contextType: "cashflow"` with a tailored prompt

### No edge function changes needed
Both features use existing infrastructure: the `AiAnalyticsNarrative` component and the `ai-analytics-narrative` edge function already handle the `"cashflow"` and `"dashboard"` context types.

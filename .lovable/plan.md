

# Enhance Analytics (Analize) Module: Fix Connections and Add AI Everywhere

## Current State Assessment

### What's Working Well
- Analytics Dashboard, Financial Ratios, Cash Flow Forecast, and Business Planning all have AI narratives
- Navigation is properly structured with 7 analytics sub-pages
- All pages use the centralized `fmtNum` formatter

### Issues Found

**1. BusinessPlanning.tsx uses wrong column names**
The query reads `amount` and `side` from `journal_lines`, but every other analytics page uses `debit` and `credit`. This likely causes the page to show all zeros -- no revenue/expense data loads.

**2. Three analytics pages have NO AI analysis**
- Break-Even Analysis -- no `AiAnalyticsNarrative`
- Profitability Analysis -- no `AiAnalyticsNarrative`  
- Expenses (Rashodi) -- no `AiAnalyticsNarrative`

**3. BudgetVsActuals AI only triggers on anomalies**
It uses `contextType="dashboard"` (generic) and only renders when `overBudgetRows.length > 0`. Should always show AI analysis with a dedicated prompt.

**4. Edge function missing context types**
`ai-analytics-narrative` only has prompts for: `dashboard`, `ratios`, `cashflow`, `planning`. Missing: `breakeven`, `profitability`, `expenses`, `budget`.

## Plan

### 1. Fix BusinessPlanning.tsx query (critical bug)

Replace `amount`/`side` column references with `debit`/`credit` to match the actual schema, consistent with every other analytics page.

### 2. Add 4 new AI context types to edge function

Update `supabase/functions/ai-analytics-narrative/index.ts` to add specialized system prompts:

| Context Type | AI Prompt Focus |
|---|---|
| `budget` | Analyze budget variances, identify spending patterns, suggest corrective actions |
| `breakeven` | Interpret break-even point, contribution margin, cost structure; suggest how to lower BEP |
| `profitability` | Analyze customer/product/cost-center profitability; identify best and worst performers |
| `expenses` | Analyze expense composition, salary-to-revenue ratio, cost trends, optimization opportunities |

### 3. Add AiAnalyticsNarrative to 3 missing pages

**BreakEvenAnalysis.tsx**: Pass break-even point, contribution margin, fixed costs, variable costs, revenue, and whether BEP is above/below current revenue.

**ProfitabilityAnalysis.tsx**: Pass top/bottom customers by margin, overall gross margin, product mix analysis.

**Expenses.tsx**: Pass total expenses by category (salaries, suppliers, operating, depreciation), salary-to-total ratio, month-over-month trends.

### 4. Fix BudgetVsActuals AI to always show

Change from conditional rendering (only on anomalies) to always rendering with `contextType="budget"`, passing full budget vs actual summary data.

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/ai-analytics-narrative/index.ts` | Add 4 new system prompts for budget, breakeven, profitability, expenses |
| `src/pages/tenant/BusinessPlanning.tsx` | Fix query to use debit/credit instead of amount/side |
| `src/pages/tenant/BreakEvenAnalysis.tsx` | Add AiAnalyticsNarrative with breakeven context |
| `src/pages/tenant/ProfitabilityAnalysis.tsx` | Add AiAnalyticsNarrative with profitability context |
| `src/pages/tenant/Expenses.tsx` | Add AiAnalyticsNarrative with expenses context |
| `src/pages/tenant/BudgetVsActuals.tsx` | Change to always-visible AI with dedicated budget context type |


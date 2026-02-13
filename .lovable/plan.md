

# Financial Analytics and AI Predictions Module

## Current Gap

The ERP currently has:
- 4 basic accounting reports (Trial Balance, Income Statement, Balance Sheet, Aging)
- Simple AI insights (overdue invoices, low stock, payroll anomalies)
- Revenue vs Expenses bar chart on dashboard
- Cash flow chart (historical only)

What's completely missing:
- Financial ratio analysis (liquidity, profitability, solvency)
- Cash flow forecasting / AI predictions
- Budget vs Actuals tracking
- Break-even analysis
- Revenue trend forecasting
- Profitability by customer/product/cost center
- Business planning and goal tracking

---

## Plan: New "Analize" (Analytics) Section

### 1. New sidebar navigation group: "Analize" (Analytics)

Add between Accounting and HR in sidebar with these pages:

| Page | Route | Description |
|------|-------|-------------|
| Analytics Dashboard | `/analytics` | KPI summary with financial ratios and AI predictions |
| Financial Ratios | `/analytics/ratios` | Liquidity, profitability, solvency ratios over time |
| Profitability Analysis | `/analytics/profitability` | Margins by customer, product, cost center |
| Cash Flow Forecast | `/analytics/cashflow-forecast` | AI-predicted cash position for next 3-6 months |
| Budget vs Actuals | `/analytics/budget` | Set budgets per account, track variance |
| Break-Even Analysis | `/analytics/break-even` | Fixed/variable cost split, break-even point |
| Business Planning | `/analytics/planning` | Revenue targets, expense goals, scenario modeling |

### 2. Analytics Dashboard (`/analytics`)

Top-level KPI cards:
- Gross Profit Margin %
- Net Profit Margin %
- Current Ratio (current assets / current liabilities)
- Quick Ratio
- Debt-to-Equity
- DSO (Days Sales Outstanding)
- Inventory Turnover

Charts:
- Profit trend (12-month line chart)
- Revenue forecast (historical + AI-predicted dotted line for next 3 months)
- Expense breakdown by account class (donut)
- Month-over-month growth rate

AI Insights section specific to analytics (calls enhanced `ai-insights` edge function with `context: "analytics"`).

### 3. Financial Ratios Page (`/analytics/ratios`)

Calculate from journal entries and chart of accounts:
- **Liquidity**: Current Ratio, Quick Ratio, Cash Ratio
- **Profitability**: Gross Margin, Net Margin, ROA, ROE
- **Efficiency**: Asset Turnover, Inventory Turnover, DSO, DPO
- **Solvency**: Debt-to-Equity, Interest Coverage

Display as cards with sparkline trend charts (last 6 periods).
Color-coded health indicators (green/yellow/red based on industry benchmarks).

### 4. Profitability Analysis (`/analytics/profitability`)

Tabs:
- **By Customer**: Revenue and margin per partner (from invoices + COGS journal lines)
- **By Product**: Revenue, COGS, gross margin per product
- **By Cost Center**: P&L per cost center (from journal lines with cost_center_id)

Each tab has a sortable table + bar chart visualization.

### 5. Cash Flow Forecast (`/analytics/cashflow-forecast`)

- Historical cash flow chart (last 6 months, from invoices + bank statements)
- AI forecast line for next 3 months (using linear regression on historical patterns)
- Accounts Receivable aging as future inflows
- Upcoming loan payments as future outflows
- "What-if" slider: adjust expected collection rate to see impact

### 6. Budget vs Actuals (`/analytics/budget`)

New database table: `budgets`
- `id`, `tenant_id`, `account_id`, `fiscal_year`, `month`, `amount`, `created_at`

UI:
- Set monthly budgets per account (or account group)
- Side-by-side comparison: Budget | Actual | Variance | Variance %
- Variance bar chart by department/cost center
- Traffic light alerts for accounts exceeding budget

### 7. Break-Even Analysis (`/analytics/break-even`)

- Classify expense accounts as Fixed or Variable (toggle in UI, stored in `chart_of_accounts.is_variable_cost` new column)
- Calculate contribution margin
- Break-even point in RSD and units
- Interactive chart showing fixed costs line, variable costs area, revenue line, and intersection

### 8. Business Planning (`/analytics/planning`)

- Set annual revenue/profit targets
- Track progress with gauge charts
- AI-generated recommendations based on current trajectory
- Scenario cards: "If revenue grows 10%, profit would be..."

---

## Technical Details

### New Files

```
src/pages/tenant/AnalyticsDashboard.tsx
src/pages/tenant/FinancialRatios.tsx
src/pages/tenant/ProfitabilityAnalysis.tsx
src/pages/tenant/CashFlowForecast.tsx
src/pages/tenant/BudgetVsActuals.tsx
src/pages/tenant/BreakEvenAnalysis.tsx
src/pages/tenant/BusinessPlanning.tsx
```

### Modified Files

| File | Change |
|------|--------|
| `src/layouts/TenantLayout.tsx` | Add `analyticsNav` group with 7 items between Accounting and HR |
| `src/App.tsx` | Register 7 new routes under `/analytics/*` with `requiredModule="accounting"` |
| `src/config/rolePermissions.ts` | Add `"analytics"` module group (accessible to admin, manager, accountant) |
| `src/i18n/translations.ts` | Add ~40 new translation keys for analytics labels |
| `src/components/layout/GlobalSearch.tsx` | Add analytics pages to search index |
| `supabase/functions/ai-insights/index.ts` | Add analytics-specific insights (margin trends, ratio warnings, forecast) |

### Database Migration

```sql
-- Budget tracking table
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  account_id uuid NOT NULL REFERENCES chart_of_accounts(id),
  fiscal_year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, account_id, fiscal_year, month)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.budgets
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Optional: variable cost flag on chart_of_accounts
ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_variable_cost boolean DEFAULT false;
```

### AI Forecast Logic

The cash flow forecast uses weighted moving average on historical monthly data from journal entries, adjusted by:
- Outstanding AR (invoices in "sent" status, weighted by aging bucket collection probability)
- Scheduled loan payments
- Recurring expense patterns (detected from repeated similar journal entries)

All computation happens client-side from existing data -- no external ML service needed. The edge function provides the narrative insights.

### Suggested Implementation Order

1. Analytics Dashboard + Financial Ratios (highest value, uses existing data)
2. Profitability Analysis (uses existing invoices + journal lines)
3. Cash Flow Forecast (uses existing data + simple prediction)
4. Budget vs Actuals (requires new `budgets` table)
5. Break-Even Analysis (requires `is_variable_cost` column)
6. Business Planning (builds on all above)


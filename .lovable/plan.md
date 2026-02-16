

# New Analytics Modules Implementation

## Overview

Adding 8 new analytics pages under the `/analytics/` route group, plus enhancing the existing Business Planning scenario engine. Each page follows the established pattern: data fetched via `useQuery` from existing Supabase tables, KPI stats bar, charts (recharts), and an AI narrative via `AiAnalyticsNarrative`.

## What Already Exists (SKIPPED)

- **Cost Center / Department Profitability** -- already in ProfitabilityAnalysis "By Cost Center" tab
- **Cash Flow 30/60/90 gap** -- already in CashFlowForecast with AR aging buckets
- **Financial Ratios (current/quick)** -- already in FinancialRatios page

---

## New Pages

### 1. Working Capital & Liquidity Stress (`/analytics/working-capital`)

KPIs: Current Ratio, Quick Ratio, Net Working Capital, Cash Runway (months)

Data sources: `journal_lines` (assets/liabilities by code), `open_items` (AR/AP timing), `bank_statements` (cash position)

Charts:
- Working capital trend (12 months)
- Liquidity gap waterfall: cash + expected AR - due AP - VAT liability per 30/60/90 day window

AI: "Your receivables are delayed 42 days -- risk of VAT cash crunch in April."

### 2. Customer Payment Risk Scoring (`/analytics/customer-risk`)

Data sources: `open_items`, `invoices` (with `paid_at`), `partners`

Per-partner metrics:
- Average Days to Pay
- % Invoices Overdue
- Bad Payer Score (weighted formula: 40% avg late days + 30% overdue rate + 30% outstanding amount)
- Total exposure (open AR)

Table with color-coded risk badges (Low/Medium/High/Critical). Chart: scatter plot of exposure vs. avg days late.

AI: Predict which customers will default, recommend credit limit adjustments.

### 3. Supplier Dependency & Cost Exposure (`/analytics/supplier-risk`)

Data sources: `supplier_invoices`, `purchase_orders`, `partners`

Metrics:
- Top 10 suppliers by spend (bar chart)
- Concentration risk: % of total spend from top 3 suppliers
- YoY price change per supplier (compare invoice amounts for same products)
- Single-source items flag

AI: "Supplier X increased costs 18% YoY -- negotiate or diversify."

### 4. Margin Bridge / Waterfall (`/analytics/margin-bridge`)

Data sources: `journal_lines` with account codes mapped to Serbian kontni okvir classes:
- Class 6 = Revenue
- Class 5 = COGS + Operating expenses (split by code prefix)
- Depreciation (amortizacija) extracted separately

Waterfall chart: Revenue -> COGS -> Gross Profit -> OpEx -> EBITDA -> Depreciation -> Net Profit

Uses recharts `BarChart` with custom positive/negative bar rendering for waterfall effect.

AI: Explain biggest drivers of margin erosion.

### 5. Payroll Burden & Salary Benchmark (`/analytics/payroll-benchmark`)

Data sources: `payroll_runs`, `journal_lines` (salary expense accounts), `employees` (headcount)

KPIs:
- Payroll % of Revenue
- Cost per Employee
- Payroll MoM growth vs Revenue MoM growth

Chart: Dual-axis line chart showing payroll growth vs revenue growth over 12 months.

AI: Warn if wage growth outpaces revenue.

### 6. VAT Cash Trap Detector (`/analytics/vat-trap`)

Data sources: `pdv_periods`, `invoices` (with payment status), `open_items`

Logic:
- VAT output liability (from pdv_periods or calculated from invoices at 20%/10%)
- Cash collected on those invoices (paid invoices only)
- Gap = VAT owed but cash not yet received

KPIs: VAT Liability, Cash Collected, Gap, Gap as % of bank balance

Chart: Stacked bar per PDV period showing liability vs. collected.

AI: "You owe 4.2M PDV but only collected 2.1M -- liquidity risk."

### 7. Inventory Health (`/analytics/inventory-health`)

Data sources: `inventory_stock`, `inventory_movements`, `inventory_cost_layers`, `products`

Metrics:
- Inventory Turnover Ratio (COGS / avg inventory)
- Dead Stock: products with no outbound movement in 180+ days
- Overstock: qty > 3x average monthly consumption
- Total inventory value

Table: Products sorted by days since last movement. Chart: Turnover ratio by product category.

AI: Suggest reorder optimization and liquidation candidates.

### 8. Early Warning System (`/analytics/early-warning`)

Data sources: `journal_entries`, `journal_lines`, `bank_statements`, `invoices`, `audit_log`

Anomaly detection rules (computed client-side):
- Expense account with 200%+ spike vs. 3-month average
- Duplicate payment amounts to same partner within 7 days
- Manual journal postings outside business hours (from audit_log timestamps)
- Entries attempting posting to closed fiscal periods (from audit_log)
- Invoice amounts significantly above historical average for partner

Each anomaly shown as a card with severity badge and details. AI provides narrative summary.

---

## Enhanced: Business Planning Scenario Engine

Expand the existing scenario slider in `BusinessPlanning.tsx` from single revenue-growth variable to multi-variable:
- Revenue growth %
- Payroll inflation %
- Supplier cost change %
- FX rate shock (EUR/RSD %)

Each gets a slider. Projected P&L recalculated with all variables. Best/Base/Worst presets.

---

## Technical Details

### Routing (App.tsx)

Add 8 new routes under the tenant route group, all gated by `requiredModule="analytics"`:

```
/analytics/working-capital
/analytics/customer-risk
/analytics/supplier-risk
/analytics/margin-bridge
/analytics/payroll-benchmark
/analytics/vat-trap
/analytics/inventory-health
/analytics/early-warning
```

### Sidebar Navigation (TenantLayout.tsx)

Expand `analyticsNav` array with new items organized into sections:
- **Financial Health**: Working Capital Stress, Financial Ratios, Profitability, Margin Bridge
- **Risk & Compliance**: Customer Risk, Supplier Risk, VAT Trap, Early Warning
- **Operations**: Inventory Health, Payroll Benchmark
- **Forecasting**: Cash Flow Forecast, Budget vs Actuals
- **Strategic**: Break-Even, Business Planning

### AI Edge Function (ai-analytics-narrative)

Add 8 new system prompts to the `systemPrompts` map:
- `working_capital`, `customer_risk`, `supplier_risk`, `margin_bridge`, `payroll_benchmark`, `vat_trap`, `inventory_health`, `early_warning`

Each prompt tailored to the specific analysis context.

### AiAnalyticsNarrative Component

Extend the `contextType` prop union to include the new types.

### Translations (i18n/translations.ts)

Add EN + SR translations for all new page titles, KPI labels, section headers.

---

## Files to Create

| File | Purpose |
|---|---|
| `src/pages/tenant/WorkingCapitalStress.tsx` | Liquidity stress analysis |
| `src/pages/tenant/CustomerRiskScoring.tsx` | Payment behavior & risk |
| `src/pages/tenant/SupplierDependency.tsx` | Supplier concentration analysis |
| `src/pages/tenant/MarginBridge.tsx` | Revenue-to-profit waterfall |
| `src/pages/tenant/PayrollBenchmark.tsx` | Salary-to-revenue metrics |
| `src/pages/tenant/VatCashTrap.tsx` | PDV liability vs cash |
| `src/pages/tenant/InventoryHealth.tsx` | Turnover & dead stock |
| `src/pages/tenant/EarlyWarningSystem.tsx` | Anomaly detection |

## Files to Modify

| File | Change |
|---|---|
| `src/App.tsx` | Add 8 route imports + Route elements |
| `src/layouts/TenantLayout.tsx` | Expand `analyticsNav` with 8 new items |
| `src/i18n/translations.ts` | Add ~80 translation keys (EN + SR) |
| `src/components/ai/AiAnalyticsNarrative.tsx` | Extend contextType union |
| `supabase/functions/ai-analytics-narrative/index.ts` | Add 8 system prompts |
| `src/pages/tenant/BusinessPlanning.tsx` | Multi-variable scenario engine |

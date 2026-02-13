

# Enhance Cash Flow Forecast Page

## Current State

The page exists with basic functionality:
- 3 KPI cards (Outstanding AR, Monthly Loan Payment, Collection Rate slider)
- One chart combining historical + forecast with solid lines (no visual distinction)
- Weighted moving average forecast for 3 months

## What's Missing (from the approved plan)

1. **AR aging-weighted inflows** -- use bucket probabilities (current: 95%, 30d: 85%, 60d: 70%, 90d: 50%, 90d+: 25%) instead of flat rate
2. **AP aging outflows** -- upcoming payables from `ap_aging_snapshots`
3. **Bank balance** -- current cash position from latest `bank_statements`
4. **Cumulative cash position line** -- running total showing predicted bank balance
5. **Visual distinction** -- dashed lines for forecast months vs solid for historical
6. **Monthly summary table** -- tabular breakdown below the chart
7. **Risk alerts** -- warnings when projected net cash goes negative

## Implementation

### Single file change: `src/pages/tenant/CashFlowForecast.tsx`

**Data fetching additions:**
- Query `ar_aging_snapshots` (latest per tenant) to get bucket breakdown; apply collection probabilities per bucket and spread weighted AR across 3 forecast months
- Query `ap_aging_snapshots` (latest per tenant) for upcoming payables
- Query `bank_statements` (latest by `statement_date`) to get `closing_balance` as current cash position

**New KPI cards (expand from 3 to 5):**
- Current Bank Balance (from bank_statements closing_balance)
- Projected Cash (3 months out = bank balance + cumulative net)
- Keep existing: Outstanding AR, Monthly Loan Payment, Collection Rate slider

**Chart enhancements:**
- Add a `cumulativeCash` data key that starts from bank balance and adds net each month
- Use custom dot renderer to show filled dots for historical, hollow for forecast
- Add an Area fill under the cumulative cash line for visual impact
- Forecast lines rendered with `strokeDasharray="5 5"`

**Summary table below chart:**
- Columns: Month | Inflow | Outflow | Net | Cumulative Cash
- Forecast rows highlighted with a subtle background color

**Risk alerts:**
- If any forecast month has cumulative cash below 0, show a warning banner with AlertTriangle icon

### No database changes needed

All data sources (`ar_aging_snapshots`, `ap_aging_snapshots`, `bank_statements`, `invoices`, `supplier_invoices`, `loans`) already exist.

## Technical Detail

```text
KPI Cards (5 across on lg, wrap on mobile)
+----------------+----------------+----------------+----------------+-------------------+
| Bank Balance   | Outstanding AR | Upcoming AP    | Loan Payment   | Collection Rate   |
| from bank_stmt | from invoices  | from ap_aging  | from loans     | [====slider====]  |
+----------------+----------------+----------------+----------------+-------------------+

Chart (ComposedChart)
- Area: cumulativeCash (light blue fill)
- Line solid: historical inflow/outflow/net
- Line dashed: forecast inflow/outflow/net
- ReferenceLine y=0

Table
| Month   | Inflow    | Outflow   | Net       | Cash Position |
|---------|-----------|-----------|-----------|---------------|
| 2025-10 | 500,000   | 420,000   | 80,000    | 1,280,000     |
| 2025-11 | 480,000   | 410,000   | 70,000    | 1,350,000     |  (forecast bg)
| ...     |           |           |           |               |
```


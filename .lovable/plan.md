

## Fix Dashboard KPIs Showing 0 - Query Overflow Bug

### Root Cause

The dashboard revenue and expenses queries use a **broken multi-step pattern**:

1. Fetch ALL posted journal entry IDs (currently 612+, growing daily)
2. Fetch ALL revenue/expense account IDs
3. Pass both ID arrays into `.in()` filters on `journal_lines`

With 612 UUIDs (each 36 chars), the `.in()` clause generates a URL over **22KB long**. Supabase REST API has URL length limits, causing **silent failures** that return empty results, which the code interprets as `0`.

This is **intermittent** because:
- Sometimes the browser caches a valid result (staleTime = 5 min)
- Page refreshes trigger new queries that hit the URL limit and return 0
- The charts (RevenueExpensesChart) have the same bug but filter by 6-month date range first, so fewer IDs

### Solution

Create a **database RPC function** that computes revenue, expenses, and cash balance in a single server-side query using proper JOINs -- no client-side ID arrays needed.

### Changes

#### 1. New Supabase Migration: `dashboard_kpi_summary` RPC

Create an RPC that returns all 4 KPI values in one call:

```sql
CREATE OR REPLACE FUNCTION dashboard_kpi_summary(_tenant_id uuid)
RETURNS TABLE(revenue numeric, expenses numeric, cash_balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COALESCE((
      SELECT SUM(jl.credit - jl.debit)
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON jl.account_id = coa.id
      WHERE je.tenant_id = _tenant_id
        AND je.status = 'posted'
        AND coa.tenant_id = _tenant_id
        AND coa.account_type = 'revenue'
    ), 0) AS revenue,
    COALESCE((
      SELECT SUM(jl.debit - jl.credit)
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON jl.account_id = coa.id
      WHERE je.tenant_id = _tenant_id
        AND je.status = 'posted'
        AND coa.tenant_id = _tenant_id
        AND coa.account_type = 'expense'
    ), 0) AS expenses,
    COALESCE((
      SELECT SUM(total)
      FROM invoices
      WHERE tenant_id = _tenant_id
        AND status = 'paid'
    ), 0) AS cash_balance;
$$;
```

#### 2. Update `src/pages/tenant/Dashboard.tsx`

Replace the 3 separate broken queries (revenue, expenses, cashBalance) with a **single** `useQuery` that calls the RPC:

```typescript
const { data: kpiData } = useQuery({
  queryKey: ["dashboard-kpi-summary", tenantId],
  queryFn: async () => {
    const { data } = await supabase.rpc("dashboard_kpi_summary", {
      _tenant_id: tenantId!,
    });
    return data?.[0] ?? { revenue: 0, expenses: 0, cash_balance: 0 };
  },
  enabled: !!tenantId,
  staleTime: 1000 * 60 * 5,
});

const revenue = Number(kpiData?.revenue ?? 0);
const expenses = Number(kpiData?.expenses ?? 0);
const cashBalance = Number(kpiData?.cash_balance ?? 0);
```

Remove the 3 old `useQuery` blocks for revenue, expenses, and cashBalance.

#### 3. Fix `RevenueExpensesChart.tsx` - Same `.in()` overflow bug

Replace the multi-step query with a single RPC:

```sql
CREATE OR REPLACE FUNCTION dashboard_revenue_expenses_monthly(
  _tenant_id uuid, _months int DEFAULT 6
)
RETURNS TABLE(month_label text, revenue numeric, expenses numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', CURRENT_DATE) - ((_months - 1) || ' months')::interval,
      date_trunc('month', CURRENT_DATE),
      '1 month'::interval
    )::date AS month_start
  )
  SELECT
    to_char(m.month_start, 'Mon YY') AS month_label,
    COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' THEN jl.credit - jl.debit ELSE 0 END), 0) AS revenue,
    COALESCE(SUM(CASE WHEN coa.account_type = 'expense' THEN jl.debit - jl.credit ELSE 0 END), 0) AS expenses
  FROM months m
  LEFT JOIN journal_entries je ON je.tenant_id = _tenant_id
    AND je.status = 'posted'
    AND je.entry_date >= m.month_start
    AND je.entry_date < (m.month_start + '1 month'::interval)
  LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
  LEFT JOIN chart_of_accounts coa ON jl.account_id = coa.id
    AND coa.tenant_id = _tenant_id
    AND coa.account_type IN ('revenue', 'expense')
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;
```

Then simplify `RevenueExpensesChart.tsx` to call this RPC instead of the 3-step client-side query.

### Files Changed

| File | Change |
|------|--------|
| New migration SQL | Create `dashboard_kpi_summary` and `dashboard_revenue_expenses_monthly` RPCs |
| `src/pages/tenant/Dashboard.tsx` | Replace 3 broken queries with single RPC call |
| `src/components/dashboard/RevenueExpensesChart.tsx` | Replace multi-step query with RPC call |

### Why This Fixes the Zeros

- **No more `.in()` with hundreds of UUIDs** -- the database does the JOIN server-side
- **Single query per widget** instead of 3 sequential queries that can each fail
- **Consistent results** -- the RPC returns data atomically, no race conditions
- **Faster** -- one round-trip instead of 3-6 sequential Supabase calls per KPI

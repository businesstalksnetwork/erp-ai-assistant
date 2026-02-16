
# Fix Business Planning -- Wrong Table Name in Join

## Problem

The Business Planning page shows Revenue YTD = 0 because of two issues:

1. **Wrong table name in Supabase join**: The query uses `accounts:account_id(account_type)` but the table is called `chart_of_accounts`, not `accounts`. PostgREST silently returns `null` for the join, so `account_type` is never read and no lines are classified as revenue or expense.

2. **Year filter**: All demo journal entries are from 2025, but `new Date().getFullYear()` returns 2026. So even after fixing the join, current-year revenue will be 0 (but previous-year data will populate correctly, fixing YoY calculations).

## Fix

In `src/pages/tenant/BusinessPlanning.tsx`, change the Supabase `.select()` join alias from `accounts:account_id(...)` to `chart_of_accounts:account_id(...)`, then update all references from `line.accounts?.account_type` to `line.chart_of_accounts?.account_type`.

### Before
```typescript
.select("debit, credit, accounts:account_id(account_type), journal:journal_entry_id(status, entry_date, tenant_id)")
// ...
if (line.accounts?.account_type === "revenue") {
// ...
} else if (line.accounts?.account_type === "expense") {
```

### After
```typescript
.select("debit, credit, chart_of_accounts:account_id(account_type), journal:journal_entry_id(status, entry_date, tenant_id)")
// ...
if (line.chart_of_accounts?.account_type === "revenue") {
// ...
} else if (line.chart_of_accounts?.account_type === "expense") {
```

### Result

- Previous year revenue/expenses will load correctly (2025 data)
- YoY growth will calculate properly instead of showing -100%
- Expense ratio will reflect real data
- Scenario modeling will project from actual numbers
- AI recommendations will be based on real financials

| File | Change |
|---|---|
| `src/pages/tenant/BusinessPlanning.tsx` | Fix join alias from `accounts` to `chart_of_accounts` and update field references |

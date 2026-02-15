
# Update Demo Data to 2026 and Add Daily Cron Job

## Overview

All demo data is hardcoded to 2025. This plan updates the seed functions to generate data spanning January 2025 through February 2026 (today), and creates a new edge function + cron job that adds fresh daily data automatically so dashboards always show recent activity.

## Changes

### 1. Update `seed-demo-data/index.ts` - Dynamic Date Range

**Replace `dateIn2025()` with `dateInRange()`** that generates dates from Jan 2025 through today (Feb 15, 2026):

```typescript
function dateInRange(monthOffset?: number) {
  const now = new Date();
  const rangeStart = new Date(2025, 0, 1);
  const totalMonths = (now.getFullYear() - 2025) * 12 + now.getMonth() + 1; // ~14
  const m = monthOffset != null ? Math.min(monthOffset, totalMonths - 1) : randInt(0, totalMonths - 1);
  const target = new Date(2025, m, randInt(1, 28), randInt(8, 17), randInt(0, 59));
  if (target > now) target.setDate(now.getDate());
  return target.toISOString();
}
```

**Fiscal periods**: Generate for all months from Jan 2025 through current month (Feb 2026 = 14 periods).

**PDV periods**: Same -- 14 periods instead of 12.

**Invoice/receipt/PO/SO/quote numbers**: Use dynamic year from the generated date (e.g., `FACT-2026-00001`).

**POS sessions**: Generate from Jan 1 2025 through today (not just 365 days of 2025).

**Work logs, attendance**: Generate through today.

**Budgets, sales targets**: Add rows for 2026 months (Jan-Feb).

**Exchange rates**: Add 2026 monthly rates.

**Bank statements**: Generate through current month.

**Aging snapshots**: Generate through current month.

**Annual leave balances**: Add 2026 row per employee.

**Payroll runs**: Add Jan 2026 (paid) and Feb 2026 (draft).

**Holidays**: Add 2026 dates alongside 2025.

### 2. Update `seed-demo-data-phase2/index.ts`

- Holiday dates: add 2026 entries (Nova Godina 2026-01-01, Bozic 2026-01-07, Sretenje 2026-02-15, etc.)
- Payroll parameters: extend `effective_to` to `2026-12-31`
- Attendance: generate through current date, not just Jan 2025
- Leave requests: include `vacation_year: 2026` entries
- Meetings: schedule some in 2026

### 3. Update `seed-demo-data-phase3/index.ts`

- Inventory cost layers: add 2026 layers
- Credit note dates: use 2026 dates for recent ones
- Return case dates: use 2026 dates

### 4. Create `supabase/functions/daily-data-seed/index.ts` - Daily Cron Function

A new edge function that runs daily and adds a small batch of fresh data for today:

- 5-10 new invoices (mix of draft/sent/paid) with today's date
- 2-3 supplier invoices
- 1-2 journal entries (balanced, posted)
- 3-5 POS transactions in today's session
- 1 POS daily report
- 2-5 inventory movements
- 1-2 CRM activities
- Update aging snapshots if month boundary

The function:
- Uses `x-cron-secret` header for auth (same pattern as NBS exchange rates)
- Only creates data for tenants that have existing demo data (checks for tenant with known ID)
- Is idempotent -- checks if today's data already exists before inserting

### 5. Register Cron Job via SQL

Schedule `daily-data-seed` to run at 07:00 CET daily using `pg_cron` + `pg_net`:

```sql
select cron.schedule(
  'daily-data-seed',
  '0 6 * * *',
  $$
  select net.http_post(
    url:='https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/daily-data-seed',
    headers:='{"Content-Type":"application/json","x-cron-secret":"..."}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### 6. Add to `supabase/config.toml`

```toml
[functions.daily-data-seed]
verify_jwt = false
```

## Files to Modify/Create

| File | Change |
|---|---|
| `supabase/functions/seed-demo-data/index.ts` | Replace `dateIn2025()` with dynamic range, extend fiscal/PDV periods to 2026, dynamic year in document numbers, extend POS/work logs/budgets/exchange rates/aging/payroll/holidays |
| `supabase/functions/seed-demo-data-phase2/index.ts` | Add 2026 holidays, extend payroll params, update attendance/leave/meeting dates |
| `supabase/functions/seed-demo-data-phase3/index.ts` | Update cost layer dates, credit note dates, return case dates |
| `supabase/functions/daily-data-seed/index.ts` | **NEW** -- daily incremental data generation |
| `supabase/config.toml` | Add `daily-data-seed` function config |

## Execution Sequence

1. Update all 3 seed functions with 2026-aware date logic
2. Create the new `daily-data-seed` function
3. Deploy all 4 functions
4. Invoke seed-demo-data, then phase2, then phase3 to repopulate
5. Set up the cron job via SQL for daily execution

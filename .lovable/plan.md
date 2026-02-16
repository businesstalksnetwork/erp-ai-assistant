

# Fix Payroll Errors and Improve UX

## Issues Found

1. **"column ec.work_hours_per_week does not exist"** -- The `calculate_payroll_for_run` database function references `ec.work_hours_per_week`, but the actual column in `employee_contracts` is `working_hours_per_week`. This causes payroll calculation to fail.

2. **"duplicate key value violates unique constraint"** -- Creating a payroll run for a month/year that already exists shows a raw database error. The UI should check for existing runs first and show a friendly message.

3. **Translation keys showing raw** -- The parameters card shows raw keys like `effectiveFrom` instead of translated labels. These translations exist but may not render in Serbian mode.

## Changes

### 1. Fix the SQL function (`new migration`)
Create a migration that replaces `calculate_payroll_for_run` with the corrected column name (`working_hours_per_week` instead of `work_hours_per_week`).

### 2. Handle duplicate payroll run gracefully (`src/pages/tenant/Payroll.tsx`)
- In `createMutation.onError`, detect the unique constraint violation and show a user-friendly message like "A payroll run for this month/year already exists" instead of the raw database error.
- Optionally, check existing runs before insert and disable creation if the period already exists.

### 3. Add missing Serbian translations (`src/i18n/translations.ts`)
Verify and add Serbian translations for `effectiveFrom`, `nontaxableAmount`, `minContributionBase`, `maxContributionBase` in the `sr` section.

## Technical Details

**New migration SQL:**
```sql
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_run(p_payroll_run_id uuid)
-- Same function body but line 45 changes:
-- FROM: COALESCE(ec.work_hours_per_week, 40)
-- TO:   COALESCE(ec.working_hours_per_week, 40)
```

**Payroll.tsx error handling:**
```typescript
onError: (e: Error) => {
  if (e.message.includes("payroll_runs_tenant_id_period_month_period_year_key")) {
    toast.error(t("payrollRunAlreadyExists"));
  } else {
    toast.error(e.message);
  }
}
```

**Files to modify:**
- New migration file (fix SQL column reference)
- `src/pages/tenant/Payroll.tsx` (friendly duplicate error)
- `src/i18n/translations.ts` (add Serbian translations for payroll parameter labels + new error key)

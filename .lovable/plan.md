

## v2.1 Remaining — Status Assessment

Items 1-3 are **already fully implemented**:
- efaktura_category per-line in UBL XML: `sef-submit/index.ts` lines 124-125, 160
- SEF PIB validation: `sef-submit/index.ts` lines 482-493 query `sef_registry`
- FIFO in POS: `PosTerminal.tsx` line 349 calls `consume_fifo_layers`

**Item 4 — eBolovanje → Payroll Bridge — needs work.**

The `ebolovanje-submit` edge function already creates an approved `leave_request` with `leave_type='sick_leave'` when a claim is submitted. However, the latest `calculate_payroll_for_run` function (migration `20260225132632`) only deducts for `leave_type='unpaid'` leave requests (line 164). Sick leave days are completely ignored in payroll calculation.

### What needs to change

**Upgrade `calculate_payroll_for_run` SQL function** to:

1. Query approved `leave_requests` where `leave_type IN ('sick_leave', 'maternity_leave')` overlapping the payroll period
2. Calculate employer-paid sick days (first 30 days per Serbian law) at 65% of daily rate
3. Calculate RFZO days (days 31+) — excluded from employer payroll entirely
4. Adjust gross: subtract full daily rate for sick days, add back 65% sick compensation for employer-paid days
5. Store `sick_leave_days` and `sick_leave_compensation` in `payroll_items`

**Add columns to `payroll_items`**:
- `sick_leave_days INTEGER DEFAULT 0`
- `sick_leave_compensation NUMERIC DEFAULT 0`

**Update `Payroll.tsx`** (or `PayrollRunDetail.tsx`) to display the sick leave columns in the payroll items table.

**Add i18n keys** for sick leave labels.

### Technical detail

In the payroll loop, after the existing unpaid leave block (line ~164), add:

```sql
-- Sick leave from eBolovanje bridge
SELECT COALESCE(SUM(days), 0) INTO v_sick_days
FROM leave_requests
WHERE employee_id = v_contract.emp_id
  AND status = 'approved'
  AND leave_type IN ('sick_leave', 'maternity_leave')
  AND start_date <= v_period_end
  AND end_date >= v_period_start;

-- Cap at employer-paid days (30 per Serbian law)
v_employer_sick_days := LEAST(v_sick_days, 30);
v_sick_compensation := v_hourly_rate * 8 * v_employer_sick_days * 0.65;
v_sick_deduction := v_hourly_rate * 8 * v_employer_sick_days;

-- Adjust gross: remove full pay for sick days, add 65% compensation
v_gross := v_gross - v_sick_deduction + v_sick_compensation;
```


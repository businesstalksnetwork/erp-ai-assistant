

# Plan: Complete Profile Page with Missing HR Sections

## What's Missing

The Profile page currently shows Personal Data, Contract, Leave, Attendance, Assets, and Reverses. Missing sections:

1. **Salary Info** — `employee_salaries` table has `amount`, `salary_type`, `amount_type`, `meal_allowance`, `regres`, `start_date` linked by `employee_id`
2. **Deductions** — `deductions` table linked by `employee_id`
3. **Allowances** — `allowances` table linked by `employee_id`
4. **Insurance Records** — `insurance_records` table linked by `employee_id`
5. **Documents** — `documents` table has no `employee_id` column, so we skip this (DMS uses different linking)

## Implementation Tasks

### Task 1: Create `ProfileSalaryCard`
- Query `employee_salaries` for the employee, show current salary (latest by `start_date`)
- Display: amount, salary_type, amount_type, meal_allowance, regres
- Read-only, masked if needed (show last 3 digits or full — employee should see their own salary)

### Task 2: Create `ProfileDeductionsCard`
- Query `deductions` for the employee
- Show active deductions: type, amount, start/end date, status

### Task 3: Create `ProfileAllowancesCard`
- Query `allowances` for the employee
- Show active allowances: type, amount, dates

### Task 4: Create `ProfileInsuranceCard`
- Query `insurance_records` for the employee
- Show insurance info: type, provider, policy number, dates

### Task 5: Update `Profile.tsx`
- Add all 4 new cards below existing HR section
- Order: Personal → Contract → Salary → Allowances → Deductions → Insurance → Leave → Attendance → Assets → Reverses

### Task 6: Translations
- ~15 new keys for salary, deductions, allowances, insurance section headers and field labels

## Affected Files
- **New**: `ProfileSalaryCard.tsx`, `ProfileDeductionsCard.tsx`, `ProfileAllowancesCard.tsx`, `ProfileInsuranceCard.tsx`
- **Modified**: `Profile.tsx`, `translations.ts`


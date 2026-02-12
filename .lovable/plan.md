

# Phase 25B: Comprehensive HR Module Overhaul

## Overview

Transform the basic HR module into a full Serbian labor-law-compliant system. This covers 14 functional areas: enhanced employees (first/last name, termination logic, archiving), organizational structure (position templates, department-positions junction), work logs with bulk entry and calendar view, overtime tracking, night work tracking, annual leave balances with carry-over rules, holidays management, deductions (credit/alimony), allowances, external workers, salary history, insurance records, and comprehensive HR reports.

---

## Current State

The existing HR module has:
- **employees**: `full_name` (single field), basic fields, simple status enum
- **departments**: code + name only, no company link
- **employee_contracts**: salary info per contract
- **attendance_records**: daily check-in/out (will be superseded by work_logs)
- **leave_requests**: basic vacation/sick with approval
- **payroll_runs/payroll_items**: Serbian payroll calculation RPC

**Missing entirely**: work_logs, overtime, night work, annual leave balances, holidays, deductions, allowances, external workers, salary history, insurance, position templates, reports, bulk entry, calendar view.

---

## Part 1: Database Migration

### 1.1 ALTER `employees` -- Split name + add fields

```text
- Rename full_name -> keep for backward compat (computed or kept)
- Add: first_name TEXT, last_name TEXT
- Add: hire_date DATE (alias for start_date)
- Add: termination_date DATE
- Add: early_termination_date DATE (takes priority)
- Add: annual_leave_days INTEGER DEFAULT 20
- Add: slava_date DATE (Serbian patron saint day)
- Add: daily_work_hours NUMERIC DEFAULT 8
- Add: position_template_id UUID FK position_templates
- Add: is_archived BOOLEAN DEFAULT false
- Add: company_id UUID FK legal_entities (nullable)
```

Status logic becomes computed:
- Active: no effective termination date OR date hasn't passed
- early_termination_date takes priority over termination_date

### 1.2 `position_templates` -- Reusable position definitions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| name | text | e.g. "Software Developer" |
| code | text | |
| description | text | nullable |
| is_active | boolean | default true |
| created_at | timestamptz | |

### 1.3 `department_positions` -- M:N junction

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| department_id | uuid FK departments | |
| position_template_id | uuid FK position_templates | |
| headcount | int | default 1 |
| UNIQUE | (department_id, position_template_id) | |

### 1.4 ALTER `departments` -- Add company link

```text
- Add: company_id UUID FK legal_entities (nullable)
```

### 1.5 `work_logs` -- Daily work log entries

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| employee_id | uuid FK employees | |
| date | date | |
| type | text | work_log_type enum values |
| hours | numeric | default 8 |
| note | text | nullable |
| vacation_year | int | nullable, for GO attribution |
| created_by | uuid | nullable |
| created_at | timestamptz | |
| UNIQUE | (employee_id, date) | |

work_log_type values: `workday`, `weekend`, `holiday`, `vacation`, `sick_leave`, `paid_leave`, `unpaid_leave`, `maternity_leave`, `holiday_work`, `slava`

### 1.6 `overtime_hours` -- Monthly summary

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| employee_id | uuid FK employees | |
| year | int | |
| month | int | |
| hours | numeric | supports 0.5 increments |
| tracking_type | text | 'monthly' or 'daily' |
| created_at | timestamptz | |
| UNIQUE | (employee_id, year, month) | |

### 1.7 `overtime_daily_entries` -- Daily detail

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| employee_id | uuid FK employees | |
| date | date | |
| hours | numeric | |
| created_at | timestamptz | |

### 1.8 `night_work_hours` + `night_work_daily_entries`

Same structure as overtime tables. Night hours are **subtracted** from regular hours in reports.

### 1.9 `annual_leave_balances`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| employee_id | uuid FK employees | |
| year | int | |
| entitled_days | numeric | |
| used_days | numeric | default 0 |
| carried_over_days | numeric | default 0 (expire June 30) |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| UNIQUE | (employee_id, year) | |

### 1.10 `holidays`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | nullable (null = national) |
| company_id | uuid FK legal_entities | nullable |
| name | text | |
| date | date | |
| is_recurring | boolean | default false |
| created_at | timestamptz | |

### 1.11 `deductions` + `deduction_payments`

**deductions:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| employee_id | uuid FK employees | |
| type | text | 'credit', 'alimony', 'other' |
| description | text | |
| total_amount | numeric | |
| paid_amount | numeric | default 0 |
| start_date | date | |
| end_date | date | nullable |
| is_active | boolean | default true |
| created_at | timestamptz | |

**deduction_payments:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| deduction_id | uuid FK deductions | |
| amount | numeric | |
| payment_date | date | |
| month | int | |
| year | int | |
| created_at | timestamptz | |

### 1.12 `allowance_types` + `allowances`

**allowance_types:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | nullable (null = system) |
| name | text | |
| code | text | |
| is_active | boolean | default true |

**allowances:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| employee_id | uuid FK employees | |
| allowance_type_id | uuid FK allowance_types | |
| amount | numeric | |
| month | int | |
| year | int | |
| created_at | timestamptz | |
| UNIQUE | (employee_id, allowance_type_id, month, year) | |

### 1.13 `external_work_types` + `engaged_persons` + `external_work_payments`

**external_work_types:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | nullable |
| name | text | |
| code | text | |

**engaged_persons:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| first_name | text | |
| last_name | text | |
| jmbg | text | |
| contract_expiry | date | nullable |
| is_active | boolean | default true |
| created_at | timestamptz | |

**external_work_payments:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| person_id | uuid FK engaged_persons | |
| work_type_id | uuid FK external_work_types | |
| amount | numeric | |
| month | int | |
| year | int | |
| created_at | timestamptz | |

### 1.14 `employee_salaries` -- Salary history

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| employee_id | uuid FK employees | |
| amount | numeric | |
| salary_type | text | 'hourly' or 'monthly' |
| amount_type | text | 'net' or 'gross' |
| meal_allowance | numeric | default 0 |
| regres | numeric | default 0 |
| start_date | date | |
| created_at | timestamptz | |

### 1.15 `insurance_records`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| first_name | text | |
| last_name | text | |
| middle_name | text | nullable |
| jmbg | text | unique per tenant |
| lbo | text | nullable |
| insurance_start | date | |
| insurance_end | date | nullable |
| registration_date | date | |
| employee_id | uuid FK employees | nullable |
| created_at | timestamptz | |
| UNIQUE | (tenant_id, jmbg) | |

### 1.16 ALTER `payroll_items`

Add: `leave_days_deducted`, `leave_deduction_amount`, `working_days`, `actual_working_days`, `dlp_amount` (from Phase 25 plan), plus `overtime_hours`, `night_work_hours`.

### 1.17 ALTER `leave_requests`

Add: `vacation_year` int nullable -- for annual leave balance attribution.

All new tables get RLS policies scoped by tenant_id with admin/hr write access.

---

## Part 2: New Pages (13 new pages)

### 2.1 `src/pages/tenant/WorkLogs.tsx` -- Work Log List
- Table: Employee | Date | Type | Hours | Note
- Filters: employee, date range, type
- Add/Edit dialog
- Link to bulk entry and calendar

### 2.2 `src/pages/tenant/WorkLogsBulkEntry.tsx` -- Bulk Entry
- Select multiple employees + date range
- Grid with rows = employees, columns = dates
- Select work_log_type per cell
- Save all at once (batch upsert)

### 2.3 `src/pages/tenant/WorkLogsCalendar.tsx` -- Calendar View
- Monthly calendar grid per employee
- Color-coded cells by work_log_type
- Click to edit individual entries

### 2.4 `src/pages/tenant/OvertimeHours.tsx` -- Overtime Tracking
- Monthly view or daily detail toggle
- 0.5h increment support
- Filters: employee, year, month

### 2.5 `src/pages/tenant/NightWork.tsx` -- Night Work Tracking
- Same structure as overtime
- Note: night hours subtract from regular in reports

### 2.6 `src/pages/tenant/AnnualLeaveBalances.tsx` -- GO Management
- Per-employee balances by year
- Shows: Entitled, Carried Over, Used, Remaining
- Expired indicator after June 30
- Recalculate button (counts work_logs with type=vacation)

### 2.7 `src/pages/tenant/Holidays.tsx` -- Holiday Management
- National holidays (pre-seeded 2025-2027)
- Company-specific holidays
- isHoliday check utility

### 2.8 `src/pages/tenant/Deductions.tsx` -- Employee Deductions
- CRUD for credit/alimony/other deductions
- Payment tracking per month
- Running balance (total - paid)

### 2.9 `src/pages/tenant/Allowances.tsx` -- Monthly Allowances
- Allowance types management
- Per-employee monthly amounts
- Copy from previous month function

### 2.10 `src/pages/tenant/ExternalWorkers.tsx` -- Engaged Persons
- CRUD for non-employee workers
- Work types management
- Monthly payment tracking

### 2.11 `src/pages/tenant/EmployeeSalaries.tsx` -- Salary History
- Per-employee salary records by start_date
- Auto-carry meal_allowance and regres from previous record
- Filter by "as of" date

### 2.12 `src/pages/tenant/InsuranceRecords.tsx` -- Insurance
- CRUD with bulk import support
- Upsert by JMBG
- Link to employees

### 2.13 `src/pages/tenant/PositionTemplates.tsx` -- Position Templates
- Reusable position definitions
- Link to departments via department_positions

### 2.14 `src/pages/tenant/HrReports.tsx` -- Comprehensive Reports
- 5 tabs: Monthly, Annual, Annual Leave, Salaries, Analytics
- Filters: Year, Month, Department, Position, Employee
- Monthly: work days, weekends, holidays, vacation, sick, paid/unpaid leave, maternity, holiday work, slava -- all in hours
- Overtime and night work columns
- Total = regular + overtime (night subtracted from regular)
- Excel/CSV export
- Annual: 12-month summary
- GO tab: carried over, entitled, used, remaining
- Salaries: filtered by date
- Analytics: absence KPIs + headcount/turnover charts

---

## Part 3: Modify Existing Pages

### 3.1 `Employees.tsx` -- Major overhaul
- Split full_name into first_name + last_name (keep full_name computed)
- Add fields: hire_date, termination_date, early_termination_date, annual_leave_days, slava_date, daily_work_hours, position_template_id, is_archived, company_id
- Status computed from termination dates
- "Include archived" toggle
- Link to salary history, work logs, leave balances

### 3.2 `Departments.tsx` -- Add company link
- Add company_id (legal entity) selector
- Show position templates linked via department_positions

### 3.3 `LeaveRequests.tsx` -- Add vacation_year
- Add vacation_year field for GO attribution
- Show payroll impact indicator

### 3.4 `Payroll.tsx` -- Integrate work logs + overtime + deductions
- Calculate based on work_logs (actual working days)
- Include overtime and night work in calculation
- Show leave deductions
- Deduction amounts from active deductions

---

## Part 4: Update `calculate_payroll_for_run` RPC

Enhanced to:
1. Count actual working days from work_logs
2. Factor in overtime hours (add to gross pro-rata)
3. Subtract night work from regular (to avoid double-counting)
4. Apply leave deductions (unpaid = full deduction, sick first 30d = 65%)
5. Subtract active deduction installments
6. Add allowances to compensation

---

## Part 5: Routes and Navigation

### `App.tsx` -- Add 14 new routes under `/hr/`

```text
hr/work-logs, hr/work-logs/bulk, hr/work-logs/calendar,
hr/overtime, hr/night-work, hr/annual-leave,
hr/holidays, hr/deductions, hr/allowances,
hr/external-workers, hr/salaries, hr/insurance,
hr/position-templates, hr/reports
```

### `TenantLayout.tsx` -- Expand hrNav

Add all new pages to the HR sidebar group.

---

## Part 6: Translations

Add ~80 translation keys covering:
- Work logs: workLog, workday, weekend, holidayWork, slava, bulkEntry, workLogsCalendar
- Overtime/Night: overtimeHours, nightWork, trackingType, dailyTracking, monthlyTracking
- Annual leave: annualLeaveBalance, entitledDays, usedDays, carriedOverDays, expiredAfterJune
- Holidays: nationalHoliday, companyHoliday, isRecurring
- Deductions: deduction, credit, alimonyType, paidAmount, remainingAmount
- Allowances: allowance, allowanceType, copyFromPrevious
- External: engagedPerson, externalWorkType, contractExpiry
- Salaries: salaryHistory, salaryType, hourlyRate, monthlyRate, mealAllowance, regres
- Insurance: insuranceRecord, lbo, insuranceStart, insuranceEnd, registrationDate, bulkImport
- Position templates: positionTemplate
- Reports: monthlyReport, annualReport, annualLeaveReport, salaryReport, hrAnalytics, headcount, turnover
- Employee fields: firstName, lastName, hireDate, terminationDate, earlyTerminationDate, annualLeaveDays, slavaDate, dailyWorkHours, isArchived

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/tenant/WorkLogs.tsx` | Work log list + CRUD |
| `src/pages/tenant/WorkLogsBulkEntry.tsx` | Bulk entry grid |
| `src/pages/tenant/WorkLogsCalendar.tsx` | Calendar view |
| `src/pages/tenant/OvertimeHours.tsx` | Overtime tracking |
| `src/pages/tenant/NightWork.tsx` | Night work tracking |
| `src/pages/tenant/AnnualLeaveBalances.tsx` | GO balances |
| `src/pages/tenant/Holidays.tsx` | Holiday management |
| `src/pages/tenant/Deductions.tsx` | Employee deductions |
| `src/pages/tenant/Allowances.tsx` | Monthly allowances |
| `src/pages/tenant/ExternalWorkers.tsx` | Engaged persons |
| `src/pages/tenant/EmployeeSalaries.tsx` | Salary history |
| `src/pages/tenant/InsuranceRecords.tsx` | Insurance management |
| `src/pages/tenant/PositionTemplates.tsx` | Position templates |
| `src/pages/tenant/HrReports.tsx` | 5-tab HR reports |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/Employees.tsx` | Split names, add all new fields, archive toggle |
| `src/pages/tenant/Departments.tsx` | Add company_id, position templates link |
| `src/pages/tenant/LeaveRequests.tsx` | Add vacation_year field |
| `src/pages/tenant/Payroll.tsx` | Integrate work logs, overtime, deductions |
| `src/layouts/TenantLayout.tsx` | Expand hrNav with ~12 new items |
| `src/App.tsx` | Add ~14 new routes |
| `src/i18n/translations.ts` | ~80 new translation keys |
| `src/integrations/supabase/types.ts` | Regenerated types |

---

## Technical Notes

### Employee Status Logic
```text
function getEffectiveTerminationDate(emp):
  if emp.early_termination_date: return early_termination_date
  if emp.termination_date: return termination_date
  return null

function isActive(emp):
  effDate = getEffectiveTerminationDate(emp)
  return effDate is null OR effDate > today

function wasActiveInPeriod(emp, periodStart, periodEnd):
  hireDate = emp.hire_date
  effDate = getEffectiveTerminationDate(emp) || Infinity
  return hireDate <= periodEnd AND effDate >= periodStart
```

### Work Log Report Calculation
```text
For employee in period (month):
  workdays = count(work_logs where type='workday')
  weekends = count(type='weekend')
  holidays = count(type='holiday')
  vacation = count(type='vacation')
  sick = count(type='sick_leave')
  ... etc for each type

  regular_hours = sum(hours for non-weekend/holiday types)
  overtime = overtime_hours for month
  night = night_work_hours for month

  total = regular_hours - night + overtime
  (night subtracted because those hours are already in regular but tracked separately)
```

### Annual Leave Rules
```text
First year: entitled = (months_worked / 12) * annual_leave_days
Carried over from previous year: expire June 30
Strict rules (per company setting):
  - First 10 days must be consecutive
  - If entitled < 10 days, all must be consecutive
  - Maternity leave exempts from this rule
  - Failure to comply = forfeit carried over days
```

### Holidays Seed Data
```text
Serbian national holidays (non-working):
  Jan 1-2: Nova Godina
  Jan 7: Bozic (Orthodox Christmas)
  Feb 15-16: Sretenje (Statehood Day)
  May 1-2: Praznik Rada
  Nov 11: Dan Primirja
  Easter (moveable): Veliki Petak, Velika Subota, Uskrs, Uskrsnji Ponedeljak
```

### Payroll Integration
```text
Enhanced calculate_payroll_for_run:
1. Get work_logs for period -> actual_working_days
2. Get overtime_hours for period -> overtime
3. Get night_work_hours for period -> night_work
4. daily_rate = gross / working_days_in_month
5. adjusted_gross = daily_rate * actual_working_days + overtime_premium
6. Get active deductions -> monthly_deduction
7. Get allowances for period -> add to compensation
8. Net = adjusted_gross - taxes - contributions - deductions + allowances
```


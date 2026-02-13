

# Employee Detail Page (Dosije Zaposlenog) + Enhanced Employee Form

## What This Does

Transforms the employee module from a simple list-with-dialog into a full employee profile system. Clicking on an employee opens a dedicated detail page with tabs showing all related data: personal info, contracts, salary history, payroll payslips (platna lista), leave requests, work logs, attendance, and deductions. The employee add/edit form is also improved to match the reference design (with Position from templates as a dropdown, Location, and a cleaner layout).

---

## Changes

### 1. Employee Detail Page (`src/pages/tenant/EmployeeDetail.tsx`)

A new page at route `/hr/employees/:id` with a tabbed layout:

**Header**: Employee name, position, department, location, status badge, and an Edit button.

**Tabs**:
- **Licni podaci (Personal Info)**: All employee fields displayed in a read-only card format (name, email, phone, JMBG, address, city, hire date, termination dates, annual leave, slava, daily hours, employment type)
- **Ugovori (Contracts)**: List of `employee_contracts` for this employee, with ability to add new ones inline
- **Plate (Salary History)**: List of `employee_salaries` records for this employee
- **Platne liste (Payslips)**: List of `payroll_items` joined with `payroll_runs` for this employee, with a "Download PDF" button for each that generates a payslip via the `generate-pdf` edge function (extended to support payslip type)
- **Odsustva (Leave Requests)**: `leave_requests` filtered by this employee
- **Evidencija rada (Work Logs)**: `work_logs` filtered by this employee
- **Obustave (Deductions)**: Active `deductions` for this employee

### 2. Enhanced Employee Add/Edit Form

Update the dialog in `Employees.tsx` to match the reference screenshot:
- **Position**: Change from free text `Input` to a `Select` dropdown that pulls from `position_templates` table (already exists with `position_template_id` FK on employees). Keep the free-text `position` field as a fallback label.
- **Location**: Already added -- keep as is
- **Shorter work hours toggle**: Add a toggle for part-time indication (maps to `daily_work_hours < 8`)
- Cleaner 2-column layout matching the reference design

### 3. Payslip PDF Generation

Extend the existing `generate-pdf` edge function to accept a `type: "payslip"` parameter alongside `payroll_item_id`. When called with payslip type, it generates an HTML payslip (platna lista) showing:
- Employee name, JMBG, position, department
- Period (month/year)
- Gross salary breakdown: base, taxes, contributions, deductions, net
- Company info from legal entity

### 4. Employee Table Click Navigation

Change the employee table rows from opening an edit dialog to navigating to the detail page (`/hr/employees/:id`). The "Edit" button moves to the detail page header.

### 5. Route Registration

Add the new route in `App.tsx`:
```text
/hr/employees/:id -> EmployeeDetail
```

---

## Technical Details

### New Files
| File | Purpose |
|------|---------|
| `src/pages/tenant/EmployeeDetail.tsx` | Full employee profile page with tabs |

### Modified Files
| File | Change |
|------|--------|
| `src/App.tsx` | Add route for `/hr/employees/:id` |
| `src/pages/tenant/Employees.tsx` | Row click navigates to detail; position uses dropdown from `position_templates`; add `position_template_id` to form |
| `supabase/functions/generate-pdf/index.ts` | Add payslip PDF generation (type: "payslip") |
| `src/i18n/translations.ts` | Add keys: personalInfo, contracts, salaryHistory, payslips, leaveRequests, workLogs, downloadPayslip, employeeProfile, shorterWorkHours, etc. |

### Employee Detail Page Tab Structure

```text
EmployeeDetail
  |-- Header (name, position, dept, location, status, Edit btn)
  |-- Tabs
       |-- Licni podaci    -> read-only employee fields
       |-- Ugovori         -> employee_contracts WHERE employee_id = :id
       |-- Plate           -> employee_salaries WHERE employee_id = :id
       |-- Platne liste    -> payroll_items JOIN payroll_runs WHERE employee_id = :id
       |-- Odsustva        -> leave_requests WHERE employee_id = :id
       |-- Evidencija rada -> work_logs WHERE employee_id = :id
       |-- Obustave        -> deductions WHERE employee_id = :id
```

### Payslip PDF Flow

```text
User clicks "Download" on a payroll_item
  -> Calls generate-pdf edge function with { type: "payslip", payroll_item_id }
  -> Edge function fetches payroll_item + payroll_run + employee + legal_entity
  -> Returns HTML payslip
  -> Browser opens in new tab for print/save as PDF
```

### Position Template Integration

The `employees` table already has a `position_template_id` column (FK to `position_templates`). The form will:
1. Fetch `position_templates` for the tenant
2. Show a dropdown to select a position template
3. Auto-fill the `position` text field with the template name
4. Store both `position_template_id` (reference) and `position` (display text)




## Connect HR Module: Positions, Contracts, Salaries, and Reports

### Problem

The HR sub-modules work individually but are not cross-linked. Contracts don't know the position, payroll reports can't break down by department, salary changes aren't tied to contracts, and list pages for contracts/salaries don't navigate to employee profiles.

---

### 1. Add `position_template_id` to Employee Contracts

**Migration:** Add column to `employee_contracts` so each contract knows which position the employee is hired for.

```sql
ALTER TABLE employee_contracts
  ADD COLUMN IF NOT EXISTS position_template_id uuid REFERENCES position_templates(id);
```

**EmployeeContracts.tsx:** Add position template selector to the contract form dialog. Show position in the table.

**EmployeeDetail.tsx (contracts tab):** Show position column in contracts table. Auto-fill `position_template_id` from the employee's current position when creating a new contract inline.

---

### 2. Make Contracts and Salaries Pages Navigable

**EmployeeContracts.tsx:**
- Add `useNavigate` and make each table row clickable, navigating to `/hr/employees/{employee_id}`
- Show department and position columns by joining through the employee

**EmployeeSalaries.tsx:**
- Same pattern: row click navigates to employee detail
- Show department and position columns

---

### 3. Add Department Breakdown to HR Reports

**HrReports.tsx:** Currently shows a flat table of employees with hours. Add:
- Department column in the monthly report table
- A new "By Department" tab in analytics showing aggregated hours, overtime, and headcount per department
- A new "By Position" tab showing headcount per position template

To do this, fetch `departments(name)` and `position_templates(name)` via the employee join, and group data client-side.

---

### 4. Show Employee Count on Position Templates

**PositionTemplates.tsx:** Add an "Employees" count column by fetching the count of employees linked to each template. This shows at a glance how many people hold each position.

Query change:
```typescript
supabase.from("position_templates")
  .select("*, employees(count)")
  .eq("tenant_id", tenantId!)
```

---

### 5. Payroll Run Items: Show Department and Position

**Payroll.tsx:** When displaying payroll items for an expanded run, join through `employees` to show department and position. This lets managers see payroll costs by organizational unit.

Query change for `runItems`:
```typescript
supabase.from("payroll_items")
  .select("*, employees(full_name, position, departments(name))")
  .eq("payroll_run_id", expandedRun!)
```

Add "Department" and "Position" columns to the payroll items table.

---

### Files Changed

| File | Change |
|------|--------|
| **Migration SQL** | Add `position_template_id` FK to `employee_contracts` |
| **EmployeeContracts.tsx** | Add position selector to form, show position + department columns, row click navigation |
| **EmployeeSalaries.tsx** | Show department + position columns, row click navigation |
| **EmployeeDetail.tsx** | Show position in contracts tab, auto-fill from employee |
| **HrReports.tsx** | Add department column to monthly table, add "By Department" and "By Position" analytics tabs |
| **PositionTemplates.tsx** | Show employee count per position |
| **Payroll.tsx** | Show department + position in payroll item rows |

### What This Fixes

After these changes, the HR flow is fully connected:

```
Position Templates (headcount per position)
  -> Employee (assigned position, department, location)
    -> Contract (knows position, salary terms)
    -> Salary History (linked to employee profile)
    -> Payroll Run Items (shows department + position)
    -> HR Reports (breakdown by department + position)
```

Every HR list page will navigate to the employee dossier on click. Reports will show organizational breakdowns. Contracts will track which position they're for.

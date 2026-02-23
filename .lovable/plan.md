

## Fix HR Module: Employee Detail, Clickable Employee Links, and Layout Issues

### Problems Found

1. **Employee Detail page shows "Nema rezultata" (blank page)**: The Supabase query uses `departments(name)` without a foreign key hint, but the `employees` table likely has multiple relationships to `departments`. The Employees list page correctly uses `departments!employees_department_id_fkey(name)` -- the detail page must match.

2. **Employee names are plain text strings in 10+ HR pages**: Allowances, Leave Requests, Overtime Hours, Night Work, Deductions, Annual Leave Balances, Work Logs, Attendance, Insurance Records, and HR Reports all show employee names as flat text. None navigate to the employee profile when clicked.

3. **HR Reports page scrolls horizontally past the sidebar**: The monthly report table has many columns and the `overflow-auto` on the card content doesn't constrain properly within the layout, causing the entire page to scroll sideways.

---

### Fix 1: Employee Detail Query

**File: `EmployeeDetail.tsx`**

Change the employee query from:
```typescript
.select("*, departments(name), locations(name), position_templates(name)")
```
to:
```typescript
.select("*, departments!employees_department_id_fkey(name), locations(name), position_templates(name)")
```

This matches the pattern already used in `Employees.tsx` and resolves the ambiguous FK error.

---

### Fix 2: Make Employee Names Clickable Links to Profile

In all HR pages that show employee names, replace the plain text with a clickable link that navigates to `/hr/employees/{employee_id}`.

**Pages to update (10 files):**

| Page | Current | Fix |
|------|---------|-----|
| `Allowances.tsx` | `a.employees?.full_name` | Wrap in clickable link to `/hr/employees/{a.employee_id}` |
| `LeaveRequests.tsx` | `r.employees?.full_name` | Same pattern |
| `OvertimeHours.tsx` | `r.employees?.full_name` | Same pattern |
| `NightWork.tsx` | `r.employees?.full_name` | Same pattern |
| `Deductions.tsx` | `d.employees?.full_name` | Same pattern |
| `AnnualLeaveBalances.tsx` | `b.employees?.full_name` | Same pattern |
| `WorkLogs.tsx` | `l.employees?.full_name` | Same pattern |
| `Attendance.tsx` | `r.employees?.full_name` | Same pattern |
| `InsuranceRecords.tsx` | `r.first_name` / `r.last_name` | Show linked employee name if `employee_id` exists |
| `HrReports.tsx` | `r.name` in monthly table | Make clickable to `/hr/employees/{r.id}` |

Each employee name will be rendered as a styled link:
```tsx
<span
  className="text-primary hover:underline cursor-pointer font-medium"
  onClick={(e) => { e.stopPropagation(); navigate(`/hr/employees/${id}`); }}
>
  {name}
</span>
```

Pages using `ResponsiveTable` will update the `render` function. Pages using raw `<Table>` will update the `<TableCell>` content. Each page will import `useNavigate` from react-router-dom.

---

### Fix 3: HR Reports Layout Overflow

**File: `HrReports.tsx`**

The page content overflows the sidebar. Fix by:
- Adding `overflow-hidden` to the root container
- Ensuring the monthly report table's parent has `max-w-full overflow-x-auto` so only the table scrolls horizontally, not the entire page
- Adding `min-w-0` to prevent flex children from expanding beyond their container

---

### Files Changed Summary

| File | Change |
|------|--------|
| `EmployeeDetail.tsx` | Fix FK hint in departments join query |
| `Allowances.tsx` | Add `useNavigate`, make employee name a clickable link |
| `LeaveRequests.tsx` | Same |
| `OvertimeHours.tsx` | Same |
| `NightWork.tsx` | Same |
| `Deductions.tsx` | Same |
| `AnnualLeaveBalances.tsx` | Same |
| `WorkLogs.tsx` | Same |
| `Attendance.tsx` | Same |
| `InsuranceRecords.tsx` | Same (use employee_id when available) |
| `HrReports.tsx` | Make names clickable + fix horizontal overflow layout |



# ERP-AI Implementation Roadmap

## ✅ Phase 1: Data Foundation (COMPLETE)
- Annual leave balances table & seeding
- Leave requests table with status workflow
- Profile leave card displaying balances

## ✅ Phase 2: Employee Self-Service Leave (COMPLETE)
- `pending_days` column, `requested_by`, `rejection_reason` on leave tables
- RLS policies for employee self-service (insert own, cancel own pending)
- `validate_leave_request` RPC (date validation, overlap check, balance check)
- `submit_leave_request` RPC (validate + insert + increment pending_days)
- `handle_leave_request_status_change` trigger (auto-balance on status transitions)
- LeaveRequestDialog, LeaveRequestHistory, useLeaveRequest hook
- ProfileLeaveCard updated with pending_days display & request button

---

## Phase 3: Manager/HR Leave Approval

### 3.1 Goal
HR managers and team leads can approve/reject leave requests. Integrates with existing approval workflow engine.

### 3.2 Schema Changes (Migration)
- Add `leave_request` to approval_workflows entity_type options (data, not schema)
- Add approval workflow seed for leave_request entity type

### 3.3 Frontend Changes

| File | Purpose |
|------|---------|
| `src/pages/tenant/LeaveManagement.tsx` | Full leave management page: pending requests table with approve/reject, filters by department/status/date |
| `src/components/hr/LeaveCalendarView.tsx` | Calendar heatmap showing team leave overlap for managers |

### 3.4 Modified Files

| File | Change |
|------|--------|
| `src/pages/tenant/PendingApprovals.tsx` | Show leave request details (employee name, dates, type, days) when entity_type = 'leave_request' |
| `src/pages/tenant/EmployeeDetail.tsx` | Add approve/reject actions on leave tab for managers |
| Navigation/routing | Add LeaveManagement route under HR module |

### 3.5 Logic
- When manager approves via PendingApprovals or LeaveManagement, update leave_request status → trigger handles balance
- Rejection requires reason (stored in `rejection_reason`)
- Email/notification to employee on status change

---

## Phase 4: Attendance & Time Tracking Enhancements

### 4.1 Goal
Link attendance records with leave requests for accurate monthly reporting.

### 4.2 Schema Changes
- `attendance_records`: add `leave_request_id UUID REFERENCES leave_requests(id)` (nullable)
- Auto-generate attendance records (status='on_leave') when leave is approved

### 4.3 Frontend Changes

| File | Purpose |
|------|---------|
| `src/components/hr/MonthlyAttendanceSummary.tsx` | Monthly summary: working days, leave days by type, overtime, absences |
| `src/components/hr/AttendanceCalendar.tsx` | Visual calendar with color-coded day status (present, leave, holiday, absent) |

### 4.4 Modified Files

| File | Change |
|------|--------|
| Attendance page | Integrate leave data into attendance views |
| Payroll calculation | Factor approved leave days into payroll (paid vs unpaid leave) |

---

## Phase 5: Leave Policy & Configuration

### 5.1 Goal
Configurable leave policies per tenant — accrual rules, carryover limits, probation restrictions.

### 5.2 Schema Changes

**`leave_policies`** — new table:
- `id`, `tenant_id`, `name`, `leave_type`
- `annual_entitlement` (default days per year)
- `max_carryover` (max days carried to next year)
- `accrual_method` (annual | monthly | none)
- `requires_approval` (boolean)
- `min_days_advance` (minimum days before start_date to request)
- `max_consecutive_days`
- `probation_months` (months before eligible)
- `is_active`

### 5.3 Frontend Changes

| File | Purpose |
|------|---------|
| `src/pages/tenant/LeavePolicies.tsx` | CRUD for leave policies with responsive table |
| `src/components/hr/LeaveEntitlementBulkUpdate.tsx` | Bulk update annual entitlements based on policy |

### 5.4 Logic
- validate_leave_request checks policy constraints (advance notice, max consecutive, probation)
- Year-end job: auto-calculate carryover based on policy.max_carryover
- Bulk entitlement generation for new fiscal year

---

## Phase 6: Public Holidays & Work Calendar

### 6.1 Goal
Serbian public holiday calendar management, automatic workday calculation.

### 6.2 Schema Changes

**`public_holidays`** — new table:
- `id`, `tenant_id`, `name`, `name_sr`, `date`, `year`, `is_recurring`, `is_active`

**`work_calendars`** — new table:
- `id`, `tenant_id`, `year`, `working_days_config` (JSONB: which weekdays are working)
- `total_working_days`, `generated_at`

### 6.3 Frontend Changes

| File | Purpose |
|------|---------|
| `src/pages/tenant/PublicHolidays.tsx` | Manage public holidays with Serbian defaults pre-seeded |
| `src/components/hr/WorkCalendarView.tsx` | Yearly work calendar visualization |

### 6.4 Logic
- Leave day calculation excludes weekends and public holidays
- Update validate_leave_request to use work calendar for accurate day counting
- Seed Serbian public holidays (Božić, Uskrs, 1. maj, etc.)

---

## Phase 7: Reporting & Analytics Dashboard

### 7.1 Goal
Comprehensive HR leave analytics for management decision-making.

### 7.2 Frontend Changes

| File | Purpose |
|------|---------|
| `src/pages/tenant/reports/LeaveAnalytics.tsx` | Leave utilization rates, trends by department, type breakdown charts |
| `src/components/hr/LeaveBalanceSummaryTable.tsx` | All employees' current balances in one view with export |
| `src/components/hr/AbsenteeismReport.tsx` | Absenteeism patterns, Bradford Factor scoring |

### 7.3 Logic
- Aggregate queries on leave_requests with department joins
- Export to Excel (existing xlsx dependency)
- Charts using recharts (existing dependency)

---

## Implementation Order & Dependencies

```
Phase 3 (Manager Approval) — depends on Phase 2 ✅
  ↓
Phase 4 (Attendance Link) — depends on Phase 3
  ↓
Phase 5 (Leave Policies) — independent, can parallel with Phase 4
  ↓
Phase 6 (Holidays & Calendar) — depends on Phase 5
  ↓
Phase 7 (Reports) — depends on all above
```

## Database Migrations Summary

| # | Migration | Phase |
|---|-----------|-------|
| 1 | `leave_approval_integration` — approval workflow for leave, LeaveManagement page | 3 |
| 2 | `attendance_leave_link` — attendance_records.leave_request_id, auto-generate trigger | 4 |
| 3 | `leave_policies` — leave_policies table with RLS | 5 |
| 4 | `public_holidays_work_calendar` — public_holidays + work_calendars tables | 6 |

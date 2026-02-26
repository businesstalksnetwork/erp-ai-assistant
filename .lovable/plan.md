

# Plan: Enhanced Profile + Ghost Employees + Connection Review

## Current State Analysis

### Document Signing
The system uses **token-based name confirmation** via `ReversSignature.tsx` — employees receive a unique `/sign/:token` link, review asset details, and confirm with their name or reject with a reason. The `send-revers-notification` edge function handles email delivery via Resend. This is functional but not a cryptographic digital signature — it's an acknowledgment workflow.

### Profile Page Gaps
`Profile.tsx` currently shows: account info, display name, password, POS PIN, notification preferences. It does **not** show any HR data even though `employees.user_id` exists and could link the logged-in user to their employee record.

### Ghost Employee Concept
`employees` table has a `user_id` column but no mechanism to mark super admin employee records as hidden from HR lists, reports, and headcounts.

---

## Database Changes

```sql
-- Add ghost flag to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_ghost boolean DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN employees.is_ghost IS 'Ghost employees (super admins) are excluded from HR lists, reports, and headcounts but can access full employee features via Profile';
```

## Implementation Tasks

### Task 1: Add `is_ghost` Column + Filter All HR Queries

- Migration adds `is_ghost` to `employees`
- Update all HR list queries (Employees.tsx, HrReports.tsx, WorkLogs, Attendance, LeaveRequests, Salaries, Deductions, Contracts, InsuranceRecords, PayrollBenchmark, Offboarding, etc.) to add `.eq("is_ghost", false)` filter
- Ghost employees still appear in admin asset assignment dropdowns and profile lookups

### Task 2: Expand Profile Page with HR Data

When the logged-in user has a linked employee record (`employees.user_id = auth.uid()`), show additional cards:

- **Lični podaci** (Personal): name, JMBG (masked), address, city, phone, email, department, position, location
- **Ugovor** (Contract): employment type, start date, hire date, termination date, contract details from `employee_contracts`
- **Godišnji odmor** (Leave): annual leave days, used days (from `leave_requests` where approved), remaining balance
- **Evidencija prisustva** (Attendance): current month summary from `attendance_records`
- **Imovina** (Assets): list of assigned assets (reuse `EmployeeAssetsTab`)
- **Reversi** (Reverses): pending signature reverses with direct sign/reject actions
- **Dokumenta** (Documents): employee-linked DMS documents

All read-only except pending reverses which allow signing.

### Task 3: Create Ghost Employee Records for Super Admins

- Add a utility in Settings or a migration seed that creates ghost employee records for the two super admin users (aleksandar@, nikola@) with `is_ghost = true` and `user_id` linked
- These records allow super admins to test the full Profile experience

### Task 4: Translations

~20 new keys for profile HR sections (personalData, contractInfo, leaveBalance, attendanceSummary, ghostEmployee, etc.)

## Affected Files

- **Migration**: 1 (add `is_ghost` column)
- **Modified**: `Profile.tsx` (major expansion), `Employees.tsx`, `HrReports.tsx`, and ~12 other HR list pages (add ghost filter)
- **New components**: `ProfileHrCard.tsx` (personal data), `ProfileLeaveCard.tsx`, `ProfileAttendanceCard.tsx`, `ProfileReversesCard.tsx`
- **Translations**: `translations.ts`

## Flow

```text
Regular employee logs in → Profile shows full HR data (read-only)
Super admin logs in → Profile shows HR data via ghost employee record
HR pages (Employees list, reports, payroll) → Ghost employees excluded
Asset assignment dropdowns → Ghost employees included (for testing)
```


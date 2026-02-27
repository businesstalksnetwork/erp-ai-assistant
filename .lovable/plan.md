

## Phase 2: Employee Self-Service Leave — Implementation Plan

### 2.1 Schema Changes (Migration)

**`annual_leave_balances`** — add `pending_days NUMERIC NOT NULL DEFAULT 0`

**`leave_requests`** — add:
- `requested_by UUID REFERENCES auth.users(id)` (who submitted)
- `rejection_reason TEXT`

**New RLS policies on `leave_requests`:**
- Employees can INSERT their own leave requests (employee's `user_id = auth.uid()`)
- Employees can UPDATE own pending requests to `cancelled` status only

### 2.2 Validation RPC: `validate_leave_request`

Server-side function that checks:
- `end_date >= start_date`
- No overlapping pending/approved requests for same employee
- For `vacation` type: sufficient balance (entitled + carried_over - used - pending >= days)
- Returns `{valid, days, error?}` as JSONB

### 2.3 Submit RPC: `submit_leave_request`

- Validates via `validate_leave_request`, inserts row, increments `pending_days` for vacation type
- Returns the new request ID

### 2.4 Auto-balance Trigger: `handle_leave_request_status_change`

On `leave_requests` status change:
- `pending → approved`: decrement pending_days, increment used_days
- `pending → rejected`: decrement pending_days
- `pending → cancelled`: decrement pending_days
- `approved → cancelled`: decrement used_days

### 2.5 New Files

| File | Purpose |
|------|---------|
| `src/components/profile/LeaveRequestDialog.tsx` | Dialog: leave_type select, date pickers, auto-calc days, balance display, reason textarea |
| `src/components/profile/LeaveRequestHistory.tsx` | Table of user's own requests with status badges + cancel button for pending |
| `src/hooks/useLeaveRequest.ts` | Hook: validate, submit, cancel, query own requests |

### 2.6 Modified Files

| File | Change |
|------|--------|
| `src/components/profile/ProfileLeaveCard.tsx` | Add "Zatraži odsustvo" button → opens LeaveRequestDialog. Show pending_days |
| `src/pages/tenant/Profile.tsx` | Add LeaveRequestHistory below ProfileLeaveCard in Overview tab |

### Database migrations (1)
1. `add_leave_self_service` — pending_days column, requested_by + rejection_reason columns, RLS policies, validate + submit RPCs, auto-balance trigger

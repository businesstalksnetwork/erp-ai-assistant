

## Bug Fix Plan: 7 Issues

### Issue Analysis

| # | Bug | Status | Fix |
|---|-----|--------|-----|
| 1 | Leave notification missing | Real | Insert into `notifications` table after successful `submitMutation` in `useLeaveRequest.ts` |
| 2 | `as any` casts on table names | Real, limited | Cannot edit `types.ts` (auto-generated). Will note for user to regenerate types. No code fix possible. |
| 3 | `attendance_records` in KpiWidget | Real | Add try-catch around the query so it fails gracefully instead of silently |
| 4 | PersonalTasksWidget `as any` on mutate | Real | Fix typing on `saveTaskEdits` — cast properly with typed mutation signature |
| 5 | IosConfirmations `SelectItem value=""` | Real | Change to `value="__all__"` and handle in logic |
| 6 | AopPositions `get_aop_report` as any | Real, limited | Same as #2 — types not generated. Cannot fix without regeneration. |
| 7 | `process_pos_sale_v2` / `complete_production_order_v2` | Not found | These functions do not exist in the codebase. Frontend already calls the original versions. No action needed. |

---

### Step 1 — Leave Notification (useLeaveRequest.ts)

In `submitMutation.onSuccess`, insert a notification to the `notifications` table for the employee's manager/HR. Requires fetching the employee's `reports_to` or falling back to tenant-level HR notification. Pattern: insert row with `category: "hr"`, `type: "info"`, `title: "New leave request"`.

### Step 2 — IosConfirmations SelectItem fix

Line 249: change `<SelectItem value="">` to `<SelectItem value="__all__">`. Update form initialization and `createMutation` to treat `"__all__"` as null/empty for `legal_entity_id`.

### Step 3 — KpiWidget attendance safety

Wrap the `attendance_records` query (line 86-89) in a try-catch, returning `{ value: 0 }` on error so the widget doesn't break if the table query fails.

### Step 4 — PersonalTasksWidget typing

Replace `updateTask.mutate(updates as any)` on line 157 with a properly typed call. The mutation already accepts `Partial<UserTask> & { id: string }`, so just type the `updates` object correctly instead of using `Record<string, unknown>`.

### Step 5 — Types regeneration note

After implementation, inform user that `as any` casts on `aop_positions`, `ios_confirmations`, `user_tasks`, `user_daily_tasks` table names require Supabase types regeneration — which happens automatically on next schema change or can be triggered manually.


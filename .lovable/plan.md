

## Fix Plan: 6 Remaining Items

### Analysis Summary

| # | Item | Assessment | Action |
|---|------|-----------|--------|
| 1 | Leave notification in LeaveRequests.tsx approve/reject | Missing — approve/reject mutations don't notify employee | Add notification dispatch to both `approveMutation.onSuccess` and `rejectMutation.onSuccess` |
| 2 | Regenerate Supabase types | Needed — many `as any` casts on tables/RPCs not in types | Create a no-op migration to trigger type regeneration |
| 3 | Frontend v2 RPC switch | **Not applicable** — `process_pos_sale_v2` and `complete_production_order_v2` do not exist anywhere in codebase or DB. Frontend already calls originals correctly. | No action needed |
| 4 | Widget shortcut editor | New feature — `WidgetShortcutEditor.tsx` doesn't exist yet | Create component allowing per-widget shortcut customization in edit mode |
| 5 | Mobile reorder arrows | Already implemented in `CustomizableDashboard.tsx` lines 118-145 | Already done — no action needed |
| 6 | AI daily digest personalization | Partially done — already passes `user.id`, fetches role, filters sections by `ROLE_SECTIONS[userRole]` | Already implemented in edge function. No action needed. |

### Actual work: 3 items

---

### Step 1 — Leave approve/reject notifications (LeaveRequests.tsx)

In `approveMutation.onSuccess`: invoke `create-notification` edge function targeting the employee who submitted the request, with title "Zahtev odobren" / message including dates.

In `rejectMutation.onSuccess`: same pattern, title "Zahtev odbijen", include rejection reason in message.

Need to look up the request's `employee_id` from the mutation context — pass the full request row to mutation, or capture it via `onMutate`.

### Step 2 — Trigger Supabase type regeneration

Create a no-op migration (`SELECT 1;`) to force the auto-generated `types.ts` to refresh. This will add `user_tasks`, `user_daily_tasks`, `aop_positions`, `ios_confirmations`, and all missing RPCs to the generated types, eliminating most `as any` casts automatically.

### Step 3 — Widget shortcut editor

Create `WidgetShortcutEditor.tsx`:
- Small dialog/popover accessible from widget edit mode (gear icon on `QuickActionsWidget`)
- Lists current shortcuts with delete button
- "Add shortcut" form: label + path (from a preset list or free text)
- Saves to `dashboard_widget_layouts` table's existing config or a new `shortcuts` JSON column
- Only applies to `quick_actions` widget type

Register in `WidgetContainer.tsx`: show gear icon in edit mode for widgets that support shortcuts (`quick_actions`).

### Technical Details

- Notification dispatch reuses the existing `create-notification` edge function pattern already in `useLeaveRequest.ts`
- Type regeneration is automatic on migration — no manual steps needed
- Shortcut editor stores data in the widget layout's existing config, avoiding schema changes


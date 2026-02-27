

## Fix Plan: 7 Dashboard & Notification Issues

### Issue 1 & 2 — Leave notification targeting too broad + wrong entity_id

**Files:** `useLeaveRequest.ts`, `LeaveRequests.tsx`

**useLeaveRequest.ts (submit):**
- Change `target_user_ids: "all_tenant_members"` → query `user_roles` for users with HR-related roles (admin, hr_manager) in this tenant, pass their user_ids as array
- Change `entity_id: employeeId` → use the returned request UUID from `submit_leave_request` RPC (it returns the new request id as string)

**LeaveRequests.tsx (approve/reject):**
- Change `target_user_ids: "all_tenant_members"` → target only the employee's `user_id` (look up from `employees` table using `request.employee_id`)
- `entity_id: request.id` is already correct here

### Issue 3 — leave_balance widget shows attendance instead of leave balance

**File:** `WidgetRenderer.tsx` line 65

Change `<KpiWidget metricKey="attendance" />` → `<KpiWidget metricKey="leave_balance" />`

Add a new `leave_balance` case in `KpiWidget.tsx` that queries `leave_balances` table (or computes from leave policies minus used days).

### Issue 4 — 4x redundant dashboard_kpi_summary RPC calls

**File:** `KpiWidget.tsx`

Consolidate `revenue`, `expenses`, `profit`, `cash_balance` cases to share a single query key `["dashboard-kpi-summary", tenantId]`. Use a shared hook or merge cases:
- Create a shared `useQuery` for `dashboard_kpi_summary` with `queryKey: ["dashboard-kpi-summary", tenantId]` — React Query will deduplicate automatically
- Each KPI case just extracts its field from the cached result

### Issue 5 — as any casts

Already addressed by type regeneration migration. No additional action needed this round.

### Issue 6 — WidgetShortcutEditor labels not i18n'd

**File:** `WidgetShortcutEditor.tsx`

Replace hardcoded Serbian strings with `t()` calls:
- `"Prečice"` → `t("shortcuts")`
- `"Nema prilagođenih prečica..."` → `t("noCustomShortcuts")`
- `"Dodaj iz predefinisanih"` → `t("addFromPresets")`
- `"Izaberi..."` → `t("select")`
- `"Naziv"` → `t("name")`
- `"Putanja"` → `t("path")`
- `"Otkaži"` → `t("cancel")`
- `"Dodaj"` → `t("add")`
- `"Prilagođena prečica"` → `t("customShortcut")`

Add missing keys to `translations.ts` for both EN and SR.

PRESET_SHORTCUTS labels should also use `t()` keys instead of hardcoded Serbian.

### Issue 7 — process_pos_sale_v2 / complete_production_order_v2

**Not applicable.** These v2 RPCs do not exist in the database or codebase. The frontend correctly uses `process_pos_sale` and `complete_production_order`. No action needed.

### Files Modified

1. `src/hooks/useLeaveRequest.ts` — targeted notification + correct entity_id
2. `src/pages/tenant/LeaveRequests.tsx` — target employee only on approve/reject
3. `src/components/dashboard/widgets/WidgetRenderer.tsx` — fix leave_balance mapping
4. `src/components/dashboard/widgets/KpiWidget.tsx` — deduplicate RPC + add leave_balance case
5. `src/components/dashboard/widgets/WidgetShortcutEditor.tsx` — i18n all labels
6. `src/i18n/translations.ts` — add shortcut editor keys + leave_balance


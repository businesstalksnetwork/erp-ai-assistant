

## PRD v2.5 — Status & Next Steps

### Already Complete (from previous work)
- **Phase 1** (Data Foundation): `manager_id`, `org_level`, `employee_locations`, 15 expanded roles — all done
- **Phase 2** (Leave Self-Service): Leave requests, validation RPCs, balance triggers, approval flow — all done

### Remaining Phases (in order)

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 3 | Customizable Dashboard Widgets | ~28h | **Not started** |
| 4 | Notification & AI Personalization | ~8h | **Not started** |
| 5 | GL Posting Improvements (POS COGS + Production rules) | ~8h | **Not started** |
| 6 | Overtime Cap & APR AOP Positions | ~10h | **Not started** |
| 7 | Integration & Polish | ~6h | **Not started** |

### Recommended order
**Phase 3 first** (biggest impact — customizable dashboard replacing static role dashboards), then Phases 4–6 in parallel, Phase 7 last.

---

### Phase 3 Implementation Plan: Customizable Dashboard Widgets

**Step 1 — Database migration**
- Create `dashboard_widget_configs` table (user_id, tenant_id, widget_id, position_index, width, height, is_visible, config_json)
- RLS: users manage own configs
- Create `seed_default_dashboard(p_user_id, p_tenant_id, p_role)` RPC with role-specific default layouts (20+ widget presets per the PRD)

**Step 2 — Widget registry & hook**
- Create `src/config/widgetRegistry.ts` with all 27 widget definitions (id, titleKey, defaultSize, requiredModule, category, defaultShortcuts)
- Create `src/hooks/useDashboardLayout.ts` — fetch/save configs via TanStack Query, auto-seed defaults on first load, filter by `canAccess()`, expose `addWidget`, `removeWidget`, `updateLayout`, `availableWidgets`

**Step 3 — Widget components (extract from existing dashboards)**
- `KpiWidget.tsx` — generic KPI card accepting metric config
- `PendingActionsWidget.tsx` — extracted from AdminDashboard
- `QuickActionsWidget.tsx` — configurable shortcut buttons
- `LeaveBalanceWidget.tsx` — wraps ProfileLeaveCard for dashboard
- `TodaySalesWidget.tsx` — extracted from StoreDashboard
- `LowStockAlertWidget.tsx` — extracted from StoreDashboard
- `PendingLeaveWidget.tsx` — pending leave from direct reports
- Chart widgets: `RevenueExpensesChart`, `InvoiceStatusChart`, `CashflowChart`, `TopCustomersChart`, `PayrollCostChart`

**Step 4 — Dashboard shell**
- Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Create `CustomizableDashboard.tsx` — 12-column CSS grid, DndContext + SortableContext, edit mode toggle
- Create `WidgetContainer.tsx` — card wrapper with drag handle, remove (X), settings gear, shortcut buttons
- Create `WidgetPickerDialog.tsx` — categorized tabs, only shows permitted + not-yet-added widgets

**Step 5 — Widget shortcuts**
- Create `WidgetShortcutEditor.tsx` — add/remove shortcuts stored in `config_json`
- Default shortcuts from registry, max 3 per widget

**Step 6 — Dashboard page swap**
- Replace `Dashboard.tsx` to render `CustomizableDashboard` instead of role-switch
- Keep old role dashboards as reference/fallback
- Mobile: single column, no drag, up/down arrows for reorder


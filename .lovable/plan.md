

## Phase 3: Per-Role Dashboards — 6 Specialized Views

### Current State
- Single `TenantDashboard` for all roles showing financial KPIs, charts, AI widgets, pending actions
- Role available via `useTenant().role` (from `tenant_members`)
- Existing dashboard widgets in `src/components/dashboard/` are reusable

### Architecture
Keep the single `/dashboard` route and `Dashboard.tsx` as a router that renders the appropriate dashboard component based on `role`. No new routes needed.

```text
Dashboard.tsx (router)
  ├─ role=admin/super_admin  → AdminDashboard (current full view)
  ├─ role=manager            → ManagerDashboard
  ├─ role=accountant         → AccountantDashboard
  ├─ role=sales              → SalesDashboard
  ├─ role=hr                 → HrDashboard
  └─ role=store/user         → StoreDashboard
```

### Step 1: Refactor Dashboard.tsx into role router

Convert `Dashboard.tsx` to a thin switcher that reads `role` from `useTenant()` and lazy-loads the matching dashboard component. Move current full dashboard content to `AdminDashboard.tsx`.

### Step 2: Create 6 dashboard components in `src/components/dashboard/roles/`

Each dashboard reuses existing widgets + adds role-specific KPIs and quick actions:

**AdminDashboard** — Current full dashboard (moved from Dashboard.tsx). All KPIs, all charts, all pending actions, module health, AI briefing.

**ManagerDashboard** — Revenue/expenses/profit KPIs, pending approvals count, team performance summary, top customers chart, revenue chart, quick actions for approvals and reports.

**AccountantDashboard** — Revenue/expenses/cash balance/profit KPIs, draft journal entries count, overdue invoices, invoice status chart, cash flow chart, cashflow forecast, compliance deadlines, quick actions for journal entry and invoice creation.

**SalesDashboard** — Sales-specific KPIs (active quotes, confirmed orders, monthly revenue, pipeline value from CRM), top customers chart, revenue chart, quick actions for new quote/lead/invoice.

**HrDashboard** — Employee count, payroll cost trend, upcoming payroll deadlines, pending leave requests count, payroll cost widget, quick actions for HR modules.

**StoreDashboard** — POS fiscal receipt status, low stock alerts, today's sales count/total, inventory alerts, quick actions for POS and inventory.

### Step 3: Role-specific KPI queries

Each dashboard defines its own KPI queries relevant to that role. Reuse existing queries where applicable (e.g., `dashboard_kpi_summary` RPC for financial roles). Add lightweight new queries for:
- Sales pipeline value (from `opportunities` table)
- Employee count (from `employees` table)
- Today's POS sales (from `pos_sessions`/`invoices`)

### Step 4: Translations

Add SR/EN keys for new dashboard labels: `salesDashboard`, `hrDashboard`, `storeDashboard`, `managerDashboard`, `accountantDashboard`, `employeeCount`, `pipelineValue`, `todaySales`, etc.

### Files to create
- `src/components/dashboard/roles/AdminDashboard.tsx`
- `src/components/dashboard/roles/ManagerDashboard.tsx`
- `src/components/dashboard/roles/AccountantDashboard.tsx`
- `src/components/dashboard/roles/SalesDashboard.tsx`
- `src/components/dashboard/roles/HrDashboard.tsx`
- `src/components/dashboard/roles/StoreDashboard.tsx`

### Files to modify
- `src/pages/tenant/Dashboard.tsx` — becomes role router
- `src/i18n/translations.ts` — new keys

### Technical Details
- All dashboards lazy-loaded via `React.lazy` for code splitting
- Each dashboard self-contained with its own queries (no shared query bloat)
- `WelcomeHeader` and export CSV reused across all dashboards
- Super admin always gets AdminDashboard
- Fallback: unknown roles get StoreDashboard (minimal view)



# Two Separate Problems — Analytics Missing

## Problem 1: Uniprom tenant has no `analytics` module enabled

Looking at the database, Uniprom has these modules enabled:
`accounting, crm, documents, hr, inventory, pos, production, purchasing, returns, sales, web`

**`analytics` is completely missing from this list.**

In `TenantLayout.tsx` line 398–400, the Analytics sidebar section is wrapped in:
```tsx
{canAccess("analytics") && (
  <CollapsibleNavGroup ... />
)}
```

Since `analytics` is not in Uniprom's `tenant_modules`, `canAccess("analytics")` returns `false` → the entire Analytics nav group is invisible.

**Fix:** Enable the `analytics` module for Uniprom tenant via a SQL migration that inserts the missing row into `tenant_modules`.

## Problem 2: Super Admin sidebar has no "Analytics" page link

The `superAdminNav` array in `src/layouts/SuperAdminLayout.tsx` (lines 30–37) only contains:
- dashboard → `/super-admin/dashboard`
- tenants → `/super-admin/tenants`
- modules → `/super-admin/modules`
- users → `/super-admin/users`
- monitoring → `/super-admin/monitoring`
- integrations → `/super-admin/integrations`

There is no "Analytics" entry. However, looking at `App.tsx` lines 184–193, there is also **no super-admin analytics route registered** — so we need to both add the nav item AND potentially create a super-admin analytics page, OR link to the tenant analytics page.

The most practical fix is to add a link in the super admin sidebar that navigates to the platform monitoring page (which has analytics-like data), OR add a dedicated super-admin analytics overview. Looking at the existing `PlatformMonitoring` page, it already covers system-level analytics.

The cleanest solution: **Add an "Analytics" nav item in the Super Admin sidebar that links to an existing analytics overview.** Since super admins also have access to the tenant app (via the "ERP Dashboard" button in the header), we add a link to `/analytics` in the super admin header or sidebar.

## Implementation Plan

### Fix 1 — Enable `analytics` module for Uniprom (Database Migration)

Create migration file: `supabase/migrations/[timestamp]_enable_analytics_uniprom.sql`

```sql
INSERT INTO tenant_modules (tenant_id, module_id, is_enabled)
SELECT 
  t.id,
  md.id,
  true
FROM tenants t
CROSS JOIN module_definitions md
WHERE t.name = 'Uniprom'
  AND md.key = 'analytics'
  AND NOT EXISTS (
    SELECT 1 FROM tenant_modules tm 
    WHERE tm.tenant_id = t.id AND tm.module_id = md.id
  );
```

This will make Analytics appear in Uniprom's sidebar immediately after the page reloads (the `usePermissions` hook re-fetches on tenant change).

### Fix 2 — Add "Analytics" link to Super Admin sidebar

In `src/layouts/SuperAdminLayout.tsx`, add a `BarChart3` import and a new entry to `superAdminNav`:

```tsx
import { LayoutDashboard, Building2, Puzzle, Users, Activity, Plug, LogOut, BarChart3 } from "lucide-react";

const superAdminNav = [
  { key: "dashboard" as const, url: "/super-admin/dashboard", icon: LayoutDashboard },
  { key: "tenants" as const, url: "/super-admin/tenants", icon: Building2 },
  { key: "modules" as const, url: "/super-admin/modules", icon: Puzzle },
  { key: "users" as const, url: "/super-admin/users", icon: Users },
  { key: "monitoring" as const, url: "/super-admin/monitoring", icon: Activity },
  { key: "integrations" as const, url: "/super-admin/integrations", icon: Plug },
  { key: "analytics" as const, url: "/super-admin/analytics", icon: BarChart3 },  // NEW
];
```

Then add a new route in `App.tsx`:
```tsx
<Route path="analytics" element={<SuperAdminAnalytics />} />
```

And create a new page `src/pages/super-admin/Analytics.tsx` — a platform-wide analytics overview showing:
- Total revenue across all tenants (from `invoices` table, grouped by tenant)
- Module adoption rates (how many tenants use each module)
- Active tenant activity (last login, recent audit log entries)
- System-wide KPIs: total invoices, total journal entries, total employees across platform

### Files to Change

| File | Change |
|---|---|
| `supabase/migrations/[ts]_enable_analytics_uniprom.sql` | Enable `analytics` module for Uniprom |
| `src/layouts/SuperAdminLayout.tsx` | Add `analytics` entry to `superAdminNav` + import `BarChart3` |
| `src/App.tsx` | Import new page + add `/super-admin/analytics` route |
| `src/pages/super-admin/Analytics.tsx` | New page — platform-wide analytics overview |

### What the Super Admin Analytics Page Will Show

- **Platform Summary Cards**: Total tenants, total active users, total modules enabled
- **Module Adoption Chart**: Bar chart of how many tenants have each module enabled
- **Tenant Activity Table**: Each tenant, last activity date, number of journal entries, invoice count
- **Top Tenants by Volume**: Sorted by invoice/transaction count

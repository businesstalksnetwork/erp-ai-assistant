

# Phase 12: Role-Based Access Control (RBAC)

Restrict which modules, pages, and actions each tenant user can see based on their `tenant_members.role`. Currently all authenticated tenant members see every sidebar item and can access every route -- this phase enforces per-role visibility and access control.

---

## Current State

- Roles already exist: `super_admin`, `admin`, `manager`, `accountant`, `sales`, `hr`, `user`
- `tenant_members` stores each user's role within their tenant
- `module_definitions` / `tenant_modules` controls which modules are enabled per tenant (Super Admin feature)
- RLS policies already restrict data access by role (e.g., only `admin`/`accountant` can write invoices)
- **Missing**: Frontend does not filter sidebar items or routes by role -- every user sees everything

---

## What Gets Built

### 1. Role-to-Module Permission Map
A configuration that defines which roles can access which sidebar groups/routes:

| Role | Accessible Modules |
|------|-------------------|
| `admin` | Everything |
| `manager` | Dashboard, CRM, Purchasing, Inventory, Returns, Production, Documents, Reports |
| `accountant` | Dashboard, Accounting (all), Reports, Settings (tax rates, currencies, fiscal periods) |
| `sales` | Dashboard, CRM (all), Inventory (read-only view), Documents |
| `hr` | Dashboard, HR (all), Documents |
| `user` | Dashboard, Documents, POS |

### 2. `usePermissions` Hook
A new hook that combines the user's tenant role with the module permission map to expose:
- `canAccess(module: string): boolean` -- checks if the current user's role allows access to a module
- `allowedNavGroups` -- filtered navigation groups for the sidebar
- `role` -- the user's current tenant role

### 3. Sidebar Filtering
`TenantLayout.tsx` uses `usePermissions` to show only the sidebar groups the user's role permits. Hidden groups are simply not rendered (not greyed out).

### 4. Route Guard Enhancement
`ProtectedRoute.tsx` gains a `requiredModule` prop. Routes wrapped with this check redirect unauthorized users to `/dashboard` with a toast message.

### 5. Settings Access Control
Settings section is restricted: only `admin` sees Users, Approval Workflows, Business Rules. `accountant` sees Tax Rates, Currencies, Fiscal Periods. Others see only Company Settings (read-only).

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/usePermissions.ts` | Permission hook with role-to-module mapping |
| `src/config/rolePermissions.ts` | Static configuration map defining role access to sidebar groups and route prefixes |

## Files to Modify

| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Filter all nav arrays through `usePermissions` before rendering |
| `src/components/ProtectedRoute.tsx` | Add optional `requiredModule` prop with redirect logic |
| `src/App.tsx` | Add `requiredModule` to tenant routes |
| `src/hooks/useTenant.ts` | Extend to also return the user's role within the tenant |
| `src/i18n/translations.ts` | Add EN/SR keys for "access denied" messages |

---

## Technical Details

### Role Permission Config (`src/config/rolePermissions.ts`)

```text
rolePermissions = {
  admin:      [all groups],
  manager:    [dashboard, crm, purchasing, inventory, returns, production, documents, reports, pos],
  accountant: [dashboard, accounting, reports, settings-partial],
  sales:      [dashboard, crm, inventory, documents],
  hr:         [dashboard, hr, documents],
  user:       [dashboard, documents, pos],
}
```

Each entry maps to sidebar group keys (e.g., "accounting", "crm", "hr") and route prefixes (e.g., "/accounting/", "/crm/").

### `usePermissions` Hook

- Reads role from `useTenant()` (extended to return `role` alongside `tenantId`)
- Looks up allowed groups in the static config
- Exposes `canAccess(groupKey)` and pre-filtered nav arrays
- Falls back to `user` permissions if role is unknown

### Sidebar Filtering in TenantLayout

Each nav group (accountingNav, crmNav, hrNav, etc.) is conditionally rendered based on `canAccess(groupKey)`. The settings nav items are individually filtered since different roles see different settings pages.

### Route Protection

`ProtectedRoute` gets an optional `requiredModule` string prop. When present, it checks `canAccess(requiredModule)` and redirects to `/dashboard` with a toast if denied. This prevents direct URL navigation to restricted pages.

### `useTenant` Extension

The hook already queries `tenant_members` -- extend it to also return the user's `role` from the same query (no additional database call needed).

---

## Security Notes

- This is **frontend-only enforcement** layered on top of the existing RLS policies that already restrict data access at the database level
- Even if a user bypasses the frontend guard, RLS prevents unauthorized data reads/writes
- The permission map is intentionally kept simple (static config) rather than database-driven, to avoid complexity -- Super Admins already control module visibility via `tenant_modules`
- No new database tables or migrations are needed for this phase


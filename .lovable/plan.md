

# Super Admin Module Management Review

## Issues Found

### 1. Missing `assets` module definition in database (CRITICAL)
The `assets` module is defined in `rolePermissions.ts` and gated in `TenantLayout.tsx` via `canAccess("assets")`, but there is **no row** in the `module_definitions` table with `key = 'assets'`. This means:
- Super admins cannot enable/disable Assets for any tenant
- Non-super-admin users will **never** see the Assets module (because `usePermissions` checks `enabledModuleKeys` from `tenant_modules` joined with `module_definitions`, and the join returns nothing)
- Only super admins see Assets currently (they bypass the tenant module check)

**Fix**: Insert `assets` into `module_definitions` with appropriate sort_order, then seed `tenant_modules` rows for existing tenants that should have it enabled.

### 2. `web` module visibility inconsistency (MINOR)
The `web` module exists in `module_definitions` and `rolePermissions`, but web sales routes are protected with `requiredModule="sales"` (not `"web"`). The sidebar shows web items inside the Sales nav group. `canAccess("web")` is only checked in `Settings.tsx` to conditionally show a link. This means enabling/disabling `web` in super admin only affects one settings link — the actual web routes are gated by `sales`. This is debatable but worth noting.

### 3. No `analytics` module definition (POTENTIAL ISSUE)
Let me verify — `analytics` key IS in `module_definitions` based on the DB query results. Confirmed it's there. No issue.

### 4. Module enable/disable correctly propagates to tenant frontend
The flow works correctly:
- Super admin toggles `tenant_modules.is_enabled` in `ModuleManagement.tsx`
- `usePermissions` hook fetches `tenant_modules` joined with `module_definitions` where `is_enabled = true`
- `TenantLayout` calls `canAccess("module_key")` to show/hide sidebar nav groups
- Routes use `<ProtectedRoute requiredModule="...">` for server-side gating
- Query has `staleTime: 5 min`, so changes take up to 5 minutes to reflect (or on page refresh)

## Plan

### Step 1: Add `assets` module to `module_definitions`
SQL migration:
```sql
INSERT INTO module_definitions (key, name, description, sort_order)
VALUES ('assets', 'Assets & Fleet', 'Fixed assets registry, depreciation, fleet management', 11);
```

### Step 2: Seed `tenant_modules` for existing tenants
Enable `assets` for all tenants that currently have most modules enabled (or all tenants):
```sql
INSERT INTO tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, md.id, true
FROM tenants t
CROSS JOIN module_definitions md
WHERE md.key = 'assets'
ON CONFLICT (tenant_id, module_id) DO NOTHING;
```

### Step 3: No code changes needed
The existing `canAccess("assets")` check in `TenantLayout.tsx`, the `assets` routes in `assetsRoutes.tsx`, and the `rolePermissions.ts` config already correctly reference the `"assets"` key. Once the DB row exists, everything connects automatically.

## Summary
One critical gap: `assets` missing from `module_definitions`. Two-statement migration fixes it. Everything else (CRM, Sales, POS, Inventory, Purchasing, Production, Returns, Analytics, Accounting, HR, Documents) is properly connected between super admin module management and tenant-facing visibility.


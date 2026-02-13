

# Wire Module Management to Tenant Visibility

## The Problem

The super admin Module Management page (`/super-admin/modules`) correctly saves toggle state to the `tenant_modules` database table, but **nothing on the tenant side reads it**. The `usePermissions()` hook only checks the hardcoded `rolePermissions` config -- it never queries `tenant_modules`.

**Result:** Turning off "CRM" for a tenant in the admin panel has zero effect. The tenant still sees CRM in the sidebar and can access all CRM routes.

## Root Cause

```text
CURRENT FLOW (broken):

Super Admin toggles module OFF
       |
       v
tenant_modules.is_enabled = false   <-- saved to DB
       |
       X  (nothing reads this)

usePermissions() --> rolePermissions (hardcoded) --> canAccess("crm") = true
       |
       v
Sidebar shows CRM, routes accessible
```

## Key Mapping Mismatch

The DB `module_definitions.key` values don't fully align with the frontend `ModuleGroup` type:

| DB key       | Frontend ModuleGroup | Status      |
|-------------|---------------------|-------------|
| crm          | crm                  | Match       |
| sales        | sales                | Match       |
| accounting   | accounting           | Match       |
| inventory    | inventory            | Match       |
| hr           | hr                   | Match       |
| web          | web                  | Match       |
| pos          | pos                  | Match       |
| production   | production           | Match       |
| dms          | documents            | MISMATCH    |
| (none)       | purchasing           | MISSING     |
| (none)       | returns              | MISSING     |

## Solution

### 1. Add missing module definitions to the database

Insert two new rows into `module_definitions`:
- `purchasing` ("Purchasing")
- `returns` ("Returns")

Rename `dms` key to `documents` (or add a mapping).

### 2. Update `usePermissions()` to intersect role permissions with tenant modules

The hook will:
1. Fetch enabled `tenant_modules` for the current tenant (with module key via join)
2. Intersect with the role-based permissions
3. A module is accessible only if BOTH the role allows it AND the tenant has it enabled

```text
FIXED FLOW:

usePermissions()
       |
       +-- rolePermissions[effectiveRole]  --> Set A (role allows)
       |
       +-- tenant_modules (DB query)       --> Set B (tenant has enabled)
       |
       v
canAccess(module) = A.has(module) AND B.has(module)
```

### 3. Handle edge cases

- **Super admins** bypass tenant module checks (they need to see everything for support)
- **Settings, dashboard** are always available (not toggleable modules)
- **Loading state** -- don't flash content while tenant_modules query loads
- **Cache** -- use React Query with reasonable staleTime so sidebar doesn't flicker

## Technical Changes

### Migration SQL
- Insert `purchasing` and `returns` into `module_definitions`
- Update `dms` key to `documents` (and update any existing `tenant_modules` references)

### `src/hooks/usePermissions.ts`
- Add a React Query call to fetch `tenant_modules` joined with `module_definitions` for the current tenant
- Build a Set of enabled module keys
- Update `canAccess()` to check both role AND tenant module enablement
- Super admin bypasses tenant module check
- Always allow `dashboard` and `settings` (core modules)

### `src/pages/super-admin/ModuleManagement.tsx`
- No changes needed (already works correctly with DB)

### `src/layouts/TenantLayout.tsx`
- No changes needed (already uses `canAccess()` which will now be properly wired)

## Implementation Order

1. Database migration: add missing module_definitions + fix dms/documents key
2. Update `usePermissions.ts`: add tenant_modules query + intersection logic
3. Test: toggle a module off in super admin, verify tenant sidebar hides it


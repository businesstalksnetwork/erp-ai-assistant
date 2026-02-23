

# Super Admin: Enter Any Tenant

## Problem
Currently, `useTenant` only fetches tenants where the logged-in user is an active member of `tenant_members`. A super admin can only see tenants they've been explicitly added to (e.g., "AI IT Development"), but cannot enter other tenants like "Uniprom".

## Solution
Modify `useTenant` to detect when the user is a super admin and fetch ALL tenants from the `tenants` table instead of filtering by membership. The super admin gets an implicit "admin" role for any tenant they select.

---

## Technical Changes

### 1. `src/hooks/useTenant.ts`
- Import `useAuth` to get `isSuperAdmin`
- Add a second query: when `isSuperAdmin` is true, fetch all tenants from the `tenants` table (not `tenant_members`)
- When super admin, map each tenant to `{ tenantId, tenantName, role: "admin" }`
- When regular user, keep the existing `tenant_members` query
- Merge logic: use the super admin tenant list when `isSuperAdmin`, otherwise use the membership list

### 2. `src/components/TenantSelector.tsx`
- No changes needed -- it already renders all tenants from the `useTenant()` hook and calls `switchTenant()`. Once useTenant returns all tenants for super admins, the selector will show them all automatically.

### 3. `src/hooks/usePermissions.ts`
- Already handles super admins correctly: `isSuperAdmin` bypasses tenant module checks (line 49: `if (isSuperAdmin) return true`), so no changes needed.

---

## How It Works After the Change

1. Super admin logs in and goes to `/dashboard`
2. The TenantSelector dropdown in the header shows ALL tenants (AI IT Development, Uniprom, and any future ones)
3. Super admin picks any tenant from the dropdown
4. All tenant-scoped queries automatically use the selected tenant ID
5. All modules are accessible (existing `usePermissions` logic already grants full access to super admins)


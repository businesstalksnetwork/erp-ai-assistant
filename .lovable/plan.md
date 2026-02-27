

## Phase 2: Enhanced RBAC — Expanded Roles + Action-Level Permissions + RLS Data Scoping

### Current State

- **Roles**: `app_role` enum with 8 values: `super_admin`, `admin`, `manager`, `accountant`, `sales`, `hr`, `store`, `user`
- **Permission model**: Hardcoded in `src/config/rolePermissions.ts` — maps roles to module groups (coarse module-level access)
- **RLS**: Most tables use `get_user_tenant_ids(auth.uid())` for tenant isolation; a few sensitive tables (HR, payroll) additionally check `role IN ('admin', 'hr')` inline
- **No action-level permissions** (e.g., can view but not edit/delete)
- **No custom permissions per tenant** — all tenants share the same static role→module map
- **No data scoping** (e.g., sales rep sees only their own deals, store user sees only their location)

### Plan

#### Step 1: Database — New permissions infrastructure

Create migration with:

1. **`tenant_role_permissions` table** — per-tenant, per-role, per-module action grants:
   ```
   id uuid PK
   tenant_id uuid FK → tenants NOT NULL
   role app_role NOT NULL
   module text NOT NULL          -- e.g. 'sales', 'crm', 'hr'
   action text NOT NULL          -- 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export'
   allowed boolean DEFAULT true
   UNIQUE(tenant_id, role, module, action)
   ```
   RLS: tenant members can SELECT; admins can ALL.

2. **`data_scope` column on `tenant_members`** — enum `('all', 'department', 'own')` DEFAULT `'all'`:
   - `all` — sees all tenant data (current behavior)
   - `department` — sees data linked to their department(s)
   - `own` — sees only records they created / are assigned to

3. **Security-definer helper functions**:
   - `has_action_permission(p_user_id uuid, p_tenant_id uuid, p_module text, p_action text) → boolean` — checks `tenant_role_permissions`; falls back to hardcoded defaults if no row exists (backward compatible)
   - `get_member_data_scope(p_user_id uuid, p_tenant_id uuid) → text` — returns the data_scope value
   - `get_member_department_ids(p_user_id uuid, p_tenant_id uuid) → uuid[]` — returns department IDs for department-scoped filtering

4. **Seed default permissions** for all existing tenants by materializing the current `rolePermissions` config into `tenant_role_permissions` rows with actions `['view','create','edit','delete']`.

#### Step 2: Frontend — `usePermissions` hook upgrade

Extend `usePermissions.ts`:
- Fetch `tenant_role_permissions` for the user's role + tenant (alongside existing `tenant_modules` query)
- Expose `canPerform(module: ModuleGroup, action: Action): boolean` in addition to existing `canAccess(module)`
- `canAccess` becomes `canPerform(module, 'view')` internally
- Expose `dataScope: 'all' | 'department' | 'own'` from `tenant_members`
- Update `useTenant.ts` to also fetch `data_scope` from `tenant_members`

#### Step 3: Frontend — Permission-aware UI guards

- Create `<ActionGuard module="sales" action="create">` wrapper component that hides children if user lacks the action permission
- Apply `ActionGuard` to key mutation buttons across modules: Create, Edit, Delete, Approve, Export
- Disable/hide buttons rather than showing errors

#### Step 4: Settings UI — Role Permission Management page

New page at `/settings/role-permissions`:
- Matrix grid: roles (columns) × modules (rows) × actions (checkboxes)
- Admins can customize which actions each role can perform within their tenant
- Include a "Reset to Defaults" button
- Add data scope selector per role (all / department / own)

#### Step 5: RLS hardening — Data scope enforcement

Update RLS policies on key data tables to respect `data_scope`:
- Tables: `invoices`, `orders`, `crm_contacts`, `crm_deals`, `inventory_transactions`
- Pattern: existing tenant isolation PLUS:
  - If scope = `'own'` → `created_by = auth.uid()` or `assigned_to = auth.uid()`
  - If scope = `'department'` → record's `department_id` IN user's department IDs
  - If scope = `'all'` → current behavior (tenant-wide)
- Use the security-definer helpers to avoid recursion

#### Step 6: Navigation & route guards

- Update `ProtectedRoute` to accept optional `requiredAction` prop
- Update sidebar items to use `canPerform(module, 'view')` for visibility
- Add translations for new UI labels

### Technical Details

- **Backward compatibility**: If no rows exist in `tenant_role_permissions` for a tenant, the system falls back to the current hardcoded `rolePermissions` map — no breaking change for existing tenants.
- **Performance**: `tenant_role_permissions` query is cached with 5min staleTime (same as modules). The security-definer functions use `STABLE` marking for query planner optimization.
- **Data scope enum**: Added as a Postgres enum `data_scope_type` with values `('all', 'department', 'own')`.
- **Super admins**: Always bypass all permission checks (both action-level and data-scope), consistent with current architecture.


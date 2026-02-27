

## Phase 1: Data Foundation — Implementation Plan

This is the first phase of the PRD v2.5 upgrade. Nothing from this PRD has been implemented yet. Phase 1 has three parts.

### 1.1 Add `manager_id` + `org_level` to employees

**Database migration:**
- Add `manager_id UUID` (self-referencing FK) and `org_level INT DEFAULT 3` to `employees`
- Create indexes on both columns
- Create `get_direct_reports(p_manager_id)` and `get_all_subordinates(p_manager_id)` recursive SQL functions

**Frontend changes:**
- `src/pages/tenant/EmployeeDetail.tsx` — add manager picker (select from employees in same tenant) and org_level dropdown (0=CEO, 1=Director, 2=Manager, 3=Staff) in the edit form
- `src/pages/tenant/Profile.tsx` — show manager name from employee join

### 1.2 `employee_locations` junction table

**Database migration:**
- Create `employee_locations` table with `employee_id`, `location_id`, `is_primary`
- Enable RLS with tenant isolation policy
- Create trigger `ensure_single_primary_location` to enforce one primary per employee
- Migrate existing `employees.location_id` data into the junction table

### 1.3 Expand `app_role` enum from 7 → 15 roles

**Database migration:**
- Add 11 new enum values: `finance_director`, `hr_manager`, `hr_staff`, `sales_manager`, `sales_rep`, `store_manager`, `cashier`, `warehouse_manager`, `warehouse_worker`, `production_manager`, `production_worker`, `viewer`

**Frontend changes:**

- `src/config/rolePermissions.ts` — extend `TenantRole` union type with all 15 roles, add module permission mappings per the PRD table
- `src/config/roleNotificationCategories.ts` — add new roles to the category mapping (finance_director → all, hr_manager/hr_staff → hr+approval, sales_manager/sales_rep → invoice, etc.)
- `src/pages/tenant/Dashboard.tsx` — extend role switch to map new roles to existing dashboard components (finance_director→Accountant, hr_manager/hr_staff→HR, sales_manager/sales_rep→Sales, store_manager/cashier→Store, warehouse_manager/warehouse_worker→Store, production_manager/production_worker→Manager, viewer→Store)
- `src/pages/tenant/RolePermissions.tsx` — extend ROLES array with all 15 roles

### Files to create
- None (all changes to existing files)

### Files to modify
- `src/config/rolePermissions.ts`
- `src/config/roleNotificationCategories.ts`
- `src/pages/tenant/Dashboard.tsx`
- `src/pages/tenant/RolePermissions.tsx`
- `src/pages/tenant/EmployeeDetail.tsx`
- `src/pages/tenant/Profile.tsx`

### Database migrations (3 separate)
1. `add_employee_manager_hierarchy` — manager_id, org_level, indexes, helper functions
2. `create_employee_locations` — junction table, RLS, trigger, data migration
3. `expand_app_role_enum` — 11 new enum values


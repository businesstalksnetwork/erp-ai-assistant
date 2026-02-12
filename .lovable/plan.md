

# Phase 1.5: Super Admin Panel — Functional Implementation

## What we're building
Making the Super Admin panel fully operational so you can onboard tenants, manage their modules, and view platform-wide users.

---

## 1. Create Tenant Onboarding Wizard

A multi-step dialog/wizard triggered by the "Create Tenant" button on the Tenant Management page.

**Step 1 — Company Info**
- Tenant name, slug (auto-generated from name)
- Plan selection (basic, professional, enterprise)
- Status (default: trial)

**Step 2 — Legal Entity**
- Company name, PIB (tax ID), maticni broj (registration number)
- Address, city, country
- Auto-linked to the new tenant

**Step 3 — Initial Admin User**
- Email, full name, password
- Creates a Supabase auth user + profile + user_roles (admin) + tenant_members entry
- This will be done via an Edge Function (since creating auth users requires the service role key)

**Step 4 — Confirmation**
- Summary of everything, then create all records

### Technical details
- New component: `src/components/super-admin/CreateTenantWizard.tsx`
- New edge function: `supabase/functions/create-tenant/index.ts` — handles user creation (requires service_role key) and seeds initial data
- The wizard uses a multi-step form with state management via useState

---

## 2. Module Management — Per-Tenant Toggle

Upgrade the existing Module Management page to:
- Add a tenant selector dropdown at the top
- Show all module_definitions with toggle switches per selected tenant
- Toggling writes to/deletes from `tenant_modules` table
- Show plan-based presets (Basic/Professional/Enterprise) as quick-apply buttons

### Technical details
- Edit: `src/pages/super-admin/ModuleManagement.tsx`
- Fetch tenants for dropdown, fetch tenant_modules for selected tenant
- Toggle calls upsert/delete on tenant_modules

---

## 3. User Management — Platform-Wide Table

Upgrade the User Management page to show:
- All users from `profiles` table with their roles and tenant memberships
- Search/filter by name, email, tenant
- Show which tenant(s) each user belongs to
- Role badges

### Technical details
- Edit: `src/pages/super-admin/UserManagement.tsx`
- Join profiles + user_roles + tenant_members + tenants

---

## 4. Tenant Management — View/Edit/Suspend

Add functionality to existing Tenant Management page:
- **View** button opens a detail panel showing: legal entities, users, enabled modules, usage stats
- **Edit** button opens edit dialog for plan, status, settings
- **Suspend/Activate** toggle with confirmation dialog

### Technical details
- New components: `TenantDetailDialog.tsx`, `EditTenantDialog.tsx`
- Status change updates tenants table

---

## 5. Super Admin Dashboard — Live Metrics

Wire up the dashboard cards with real data:
- Total tenants count from `tenants` table
- Active users count from `profiles` table
- Recent activity from `audit_log` table
- System health as static "Healthy" for now

### Technical details
- Edit: `src/pages/super-admin/Dashboard.tsx`
- Use Supabase queries with `.count()` and recent audit log entries

---

## 6. Edge Function: create-tenant

```
POST /create-tenant
Body: { tenant_name, plan, legal_entity: {...}, admin_user: { email, password, full_name } }
```

This function:
1. Creates the tenant record
2. Creates the legal entity linked to tenant
3. Creates auth user via `supabase.auth.admin.createUser()`
4. Creates profile, user_roles (admin), and tenant_members records
5. Seeds default module_definitions into tenant_modules based on plan

Requires: `SUPABASE_SERVICE_ROLE_KEY` secret

---

## Files to create/modify

| Action | File |
|--------|------|
| Create | `src/components/super-admin/CreateTenantWizard.tsx` |
| Create | `src/components/super-admin/TenantDetailDialog.tsx` |
| Create | `src/components/super-admin/EditTenantDialog.tsx` |
| Create | `supabase/functions/create-tenant/index.ts` |
| Modify | `src/pages/super-admin/TenantManagement.tsx` |
| Modify | `src/pages/super-admin/ModuleManagement.tsx` |
| Modify | `src/pages/super-admin/UserManagement.tsx` |
| Modify | `src/pages/super-admin/Dashboard.tsx` |
| Modify | `src/i18n/translations.ts` (new keys for wizard, dialogs) |

---

## Order of implementation
1. Edge function (create-tenant) — backend first
2. Create Tenant Wizard — uses the edge function
3. Module Management per-tenant toggles
4. User Management table
5. Tenant detail/edit dialogs
6. Dashboard live metrics


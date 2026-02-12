

# Fix: Create "AI IT Development" Tenant and Link Bogdan as Admin

## Problem

- User `bogdan@aiitdevelopment.com` (ID: `7b279f18-...`) exists with `super_admin` + `user` roles
- **No tenants exist** in the database -- the tenants table is completely empty
- **No tenant membership** exists for Bogdan -- he has no organization assigned
- The Super Admin dashboard correctly shows 0 tenants and 1 user, but there's no "AI IT Development" organization in the system

## Solution

Run SQL to seed the tenant, link Bogdan as its admin, and add the `admin` role.

### Step 1: Create the "AI IT Development" tenant

Insert into the `tenants` table with status `active` and an appropriate plan.

### Step 2: Add Bogdan as tenant admin

Insert into `tenant_members` linking Bogdan's user ID to the new tenant with role `admin` and status `active`.

### Step 3: Add `admin` user role

Bogdan currently has roles `super_admin` and `user`. Add the `admin` role so he has full organization-level access.

### Step 4: Create a legal entity (optional but consistent)

Insert a basic `legal_entities` row for the tenant so the organization setup is complete.

---

## Technical Details

Three SQL INSERT statements will be executed:

1. **tenants** -- `name: "AI IT Development"`, `slug: "ai-it-development"`, `plan: "enterprise"`, `status: "active"`
2. **tenant_members** -- `tenant_id: (new tenant)`, `user_id: 7b279f18-...`, `role: "admin"`, `status: "active"`
3. **user_roles** -- `user_id: 7b279f18-...`, `role: "admin"` (if not already present)
4. **legal_entities** -- `tenant_id: (new tenant)`, `name: "AI IT Development"`, `country: "RS"`

No code changes are needed -- this is purely a data seeding issue. After the inserts, the Super Admin dashboard will show the tenant, and Bogdan will see the tenant dashboard when navigating to `/dashboard`.


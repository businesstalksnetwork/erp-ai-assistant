

# Unify Companies and Partners Into a Single Entity

## The Current Problem

The ERP has two tables representing the same real-world concept (a business entity/firma):

- **`partners`** (11,125 records) -- the master table used by all transactional modules: Invoices, Purchase Orders, Supplier Invoices, Quotes, Sales Orders, Returns, Loans, Open Items, Kompenzacija, Leads, Opportunities
- **`companies`** (50 records) -- a CRM-only table with categories, contacts, and activities. Has a `partner_id` FK back to `partners`, confirming they represent the same entity

The user creates a "company" in CRM and a "partner" in accounting/nabavka -- but these are the same firm. Suppliers (dobavljaci) in the Partners page (type="supplier") are exactly the same suppliers used in Purchase Orders.

## Solution: Make CRM Pages Use `partners` as the Single Source of Truth

We do NOT drop the `companies` table (that would break existing CRM data). Instead, we migrate CRM functionality to work with `partners` and keep `companies` as a thin bridge for categories/activities during transition.

### Phase 1: Enhance `partners` Table

Add missing CRM fields to the `partners` table via migration:
- `display_name` (text, nullable) -- friendly name
- `website` (text, nullable)
- `notes` (text, nullable)
- `status` (text, default 'active') -- replaces is_active for consistency

### Phase 2: Create Partner-Linked CRM Tables

Create new linking tables that reference `partners` instead of `companies`:
- `partner_category_assignments` (partner_id, category_id, tenant_id) -- mirrors company_category_assignments
- Update `activities` table to support `partner_id` alongside `company_id`
- Update `contact_company_assignments` to support `partner_id` alongside `company_id`

### Phase 3: Update CRM Pages

**Companies.tsx** -- Rewrite to query `partners` instead of `companies`:
- Show all partners with category filters
- Add type filter (customer / supplier / both) -- this is the key differentiator
- Suppliers (dobavljaci) become just partners filtered by type="supplier"
- The "Add Company" dialog becomes "Add Partner" and creates in `partners`
- PIB lookup stays the same
- Categories still work via new `partner_category_assignments`

**CompanyDetail.tsx** -- Rewrite to show a partner's detail:
- Overview tab shows partner data from `partners`
- Contacts tab queries `contact_company_assignments` (or new partner link)
- Activities tab queries `activities` by partner_id
- Add a "Transactions" tab showing linked invoices, POs, quotes (huge CRM value)

**Partners.tsx** -- Remove or redirect to the unified Companies/Partners page:
- The standalone Partners page becomes redundant
- Redirect `/partners` to `/crm/companies` (or rename the route)

**CrmDashboard.tsx** -- Update company count query to use `partners`

**Contacts.tsx / ContactDetail.tsx** -- Update company selectors to show partners

### Phase 4: Navigation and Naming

- Rename "Companies" in the sidebar to "Partners" or "Business Partners" (Poslovni partneri)
- Remove the separate "Partners" menu item from Accounting nav
- Add type-based views: "Customers" = partners where type in (customer, both), "Suppliers" = partners where type in (supplier, both)

### Phase 5: Data Migration

- For each existing `companies` row that has a `partner_id`, migrate categories and activities to reference the partner
- For companies without a `partner_id`, create a corresponding partner record and link them
- Migrate `contact_company_assignments` to reference partners

## Files to Change

1. **New migration** -- Add columns to `partners`, create `partner_category_assignments`, add `partner_id` to activities/contacts if needed
2. **`src/pages/tenant/Companies.tsx`** -- Rewrite to query `partners` table with category support
3. **`src/pages/tenant/CompanyDetail.tsx`** -- Rewrite to show partner detail with transactions tab
4. **`src/pages/tenant/Partners.tsx`** -- Redirect to unified page or remove
5. **`src/pages/tenant/CrmDashboard.tsx`** -- Update count query
6. **`src/pages/tenant/Contacts.tsx`** -- Update company selector to show partners
7. **`src/pages/tenant/ContactDetail.tsx`** -- Update company references
8. **`src/App.tsx`** -- Update routes
9. **Navigation/sidebar** -- Update menu items

## What We Do NOT Change

- The `partners` table structure stays backward-compatible (only adding new columns)
- All existing FK references from invoices, POs, quotes, etc. keep working
- The `companies` table stays in the DB (not dropped) for data safety
- Existing partner data (11,125 records) is untouched

## Technical Notes

- The `partners.type` field already distinguishes customer/supplier/both -- this is exactly what "dobavljaci from nabavka" means
- Purchase Orders already use `partners.id` via `supplier_id` FK -- suppliers are already partners
- The `companies.partner_id` FK proves these were designed to be linked from the start
- ProBusinessManagement uses a separate `crm_partners` table because it's a project management tool, not an ERP -- that pattern doesn't apply here


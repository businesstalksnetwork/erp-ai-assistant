

# Phase 2: Tenant Admin Settings — CRUD Sub-Pages

Build out the settings pages that Tenant Admins use to configure their organization. The Settings page already links to these routes, but the pages don't exist yet.

---

## What gets built

### 1. Legal Entities Management (`/settings/legal-entities`)
- Table listing all legal entities for the tenant
- Add/Edit dialog: name, PIB, maticni broj, address, city, postal code, country
- Delete with confirmation
- Data from `legal_entities` table (RLS already configured)

### 2. Locations Management (`/settings/locations`)
- Table of offices, shops, etc.
- Add/Edit dialog: name, type (office/shop/branch), address, city
- Active/Inactive toggle
- Data from `locations` table

### 3. Warehouses Management (`/settings/warehouses`)
- Table of warehouses with optional location link
- Add/Edit dialog: name, code, linked location (dropdown), active toggle
- Data from `warehouses` table

### 4. Sales Channels (`/settings/sales-channels`)
- Table: name, type (retail/wholesale/web/marketplace)
- Add/Edit dialog
- Data from `sales_channels` table

### 5. Cost Centers (`/settings/cost-centers`)
- Table: code, name, active status
- Add/Edit dialog
- Data from `cost_centers` table

### 6. Bank Accounts (`/settings/bank-accounts`)
- Table: bank name, account number, currency, primary flag
- Add/Edit dialog with legal entity selector
- Data from `bank_accounts` table

### 7. Placeholder pages for API Configuration and Business Rules
- `/settings/integrations` — placeholder with "Coming soon" card
- `/settings/business-rules` — placeholder with "Coming soon" card

---

## Shared pattern

All CRUD pages follow the same pattern:
- A reusable data table with search
- Add button opens a Dialog form
- Edit/Delete actions per row
- Toast notifications on success/error
- Uses `useQuery` and `useMutation` from TanStack Query
- Tenant scoping handled automatically by RLS

---

## Routing

Add all new routes under the existing TenantLayout in `App.tsx`:
```
/settings/legal-entities
/settings/locations
/settings/warehouses
/settings/sales-channels
/settings/cost-centers
/settings/bank-accounts
/settings/integrations
/settings/business-rules
```

---

## i18n

Add translation keys for all new page titles, form labels, and messages in both English and Serbian.

---

## Files

| Action | File |
|--------|------|
| Create | `src/pages/tenant/LegalEntities.tsx` |
| Create | `src/pages/tenant/Locations.tsx` |
| Create | `src/pages/tenant/Warehouses.tsx` |
| Create | `src/pages/tenant/SalesChannels.tsx` |
| Create | `src/pages/tenant/CostCenters.tsx` |
| Create | `src/pages/tenant/BankAccounts.tsx` |
| Create | `src/pages/tenant/Integrations.tsx` |
| Create | `src/pages/tenant/BusinessRules.tsx` |
| Modify | `src/App.tsx` — add routes |
| Modify | `src/i18n/translations.ts` — add keys |

## Technical notes

- Each page needs the user's tenant ID. We'll get it from `tenant_members` via `useAuth` user ID, or add a `useTenant` hook that fetches the active tenant membership.
- All queries use `supabase.from("table").select("*").eq("tenant_id", tenantId)`.
- Mutations use `.insert()`, `.update()`, `.delete()` with appropriate tenant scoping.
- A new `src/hooks/useTenant.ts` hook will be created to fetch and cache the current user's tenant ID.


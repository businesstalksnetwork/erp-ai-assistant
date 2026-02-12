

# Phase 23: Complete CRM Module Overhaul

## Overview

Replace the current basic CRM (partners + simple leads/opportunities) with a full-featured CRM system including Companies with PIB lookup, Contacts with many-to-many company links, enhanced Leads with contact linking, Kanban Opportunities, Meetings with calendar, Activities timeline, and a CRM Dashboard.

---

## Current State

- **Partners table**: Simple CRUD with name/PIB/type (customer/supplier/both) -- no categories, no contacts
- **Leads table**: Basic with `name`, `email`, `company` (free text), `source`, `status` -- tenant-scoped, no contact FK
- **Opportunities table**: Basic with `title`, `value`, `stage`, `partner_id`, `lead_id` -- no Kanban, no `closed_at`
- **Quotes/Sales Orders**: Exist and work, linked to partners/opportunities
- **No tables for**: `companies`, `company_categories`, `contacts`, `contact_company_assignments`, `meetings`, `meeting_types`, `meeting_participants`, `activities`

---

## Implementation Plan

Due to the massive scope, this will be split into **3 sub-phases** implemented sequentially in one go:

### Sub-Phase A: Database Schema + Companies + Contacts

**Migration SQL** -- Create all new tables:

| Table | Key Fields |
|-------|-----------|
| `companies` | tenant_id, legal_name, display_name, pib, maticni_broj, is_internal, status, email, phone, website, address, city, postal_code, country |
| `company_categories` | tenant_id, name, name_sr, code (unique per tenant), color, parent_id, is_system, sort_order |
| `company_category_assignments` | company_id, category_id |
| `contacts` | tenant_id, first_name, last_name, email, phone, type (customer/supplier/prospect), seniority_level, function_area, company_name (legacy), address, city, postal_code, country, website, notes |
| `contact_company_assignments` | contact_id, company_id, job_title, department, is_primary |
| `meetings` | tenant_id, title, description, scheduled_at, duration_minutes, location, communication_channel, status, meeting_type_id, notes |
| `meeting_types` | tenant_id, name, name_sr, color |
| `meeting_participants` | meeting_id, contact_id, employee_id, company_id, is_organizer, is_internal |
| `activities` | tenant_id, type, description, company_id, contact_id, lead_id, opportunity_id, meeting_id |

- All tables get RLS policies scoped to tenant_id
- Seed system company_categories: supplier, customer, partner, investor, contractor, subcontractor
- Update `leads` table: add `first_name`, `last_name`, `job_title`, `contact_id` FK
- Update `opportunities` table: add `contact_id` FK, `closed_at`, `description`
- Migrate existing `partners` data: create a view or keep partners table as-is and link companies to it via a migration that copies partner data into companies

**Decision**: Keep the existing `partners` table for backward compatibility with invoices/POs/supplier invoices. The new `companies` table is the CRM entity. A `partner_id` FK on `companies` links them when needed for accounting documents.

### Sub-Phase B: UI Pages

**New pages to create:**

1. **CRM Dashboard** (`src/pages/tenant/CrmDashboard.tsx`)
   - Stats cards: total leads, leads by status, open opportunity pipeline value, total contacts, conversion rate
   - Quick links to Leads, Opportunities, Contacts, Companies

2. **Companies List** (`src/pages/tenant/Companies.tsx`)
   - Table with search, category filter (hierarchical)
   - Stats: contacts count, meetings count per company
   - Add/Edit dialog with PIB auto-lookup
   - Category assignment via checkboxes

3. **Company Detail** (`src/pages/tenant/CompanyDetail.tsx`)
   - Tabs: Overview (editable), Contacts, Meetings, Activities
   - Contact tab shows linked contacts from `contact_company_assignments`
   - Activities tab shows recent activity log entries

4. **Contacts List** (`src/pages/tenant/Contacts.tsx`)
   - Table with multi-select filters (type, seniority, function area)
   - Shows linked companies as clickable badges
   - Add/Edit with company combobox

5. **Contact Detail** (`src/pages/tenant/ContactDetail.tsx`)
   - Editable info, linked companies (add/remove), related leads, related opportunities

6. **Enhanced Leads** (`src/pages/tenant/Leads.tsx`) -- Rewrite
   - Add first_name/last_name split, job_title, contact_id link
   - Inline status change from table row
   - Convert to Opportunity creates contact if needed

7. **Kanban Opportunities** (`src/pages/tenant/Opportunities.tsx`) -- Rewrite
   - 5-column Kanban board (qualification, proposal, negotiation, closed_won, closed_lost)
   - Each column shows count + total RSD value
   - Cards are clickable
   - Auto-set `closed_at` on stage change to closed_won/closed_lost

8. **Opportunity Detail** (`src/pages/tenant/OpportunityDetail.tsx`)
   - Quick stage-change buttons
   - Create Quote action
   - Related contact, lead info

9. **Meetings** (`src/pages/tenant/Meetings.tsx`)
   - Table + upcoming cards + stats (today, this week, upcoming, completed)
   - Filters: search, status, communication channel
   - Add/Edit dialog with participant selection

### Sub-Phase C: Edge Function + Integrations

1. **company-lookup Edge Function** (`supabase/functions/company-lookup/index.ts`)
   - Input: `{ pib: string }`
   - Validates 9-digit format
   - Calls Checkpoint.rs API: `https://api.checkpoint.rs/api/VratiSubjekt?PIB={pib}&token={CHECKPOINT_API_TOKEN}`
   - Returns: `{ found, legal_name, pib, maticni_broj, address, city, postal_code, country }`

2. **Routing updates** (`src/App.tsx`)
   - Add routes: `/crm` (dashboard), `/crm/companies`, `/crm/companies/new`, `/crm/companies/:id`, `/crm/contacts`, `/crm/contacts/new`, `/crm/contacts/:id`, `/crm/leads` (rewrite), `/crm/leads/:id`, `/crm/opportunities` (rewrite), `/crm/opportunities/:id`, `/crm/meetings`

3. **Sidebar updates** (`src/layouts/TenantLayout.tsx`)
   - Replace current CRM nav with: Dashboard, Companies, Contacts, Leads, Opportunities, Meetings, Quotes, Sales Orders

4. **i18n translations** for all new CRM labels in both EN and SR

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/phase23_crm.sql` | Full schema: 9 new tables, lead/opportunity alterations, RLS, seed data |
| `src/pages/tenant/CrmDashboard.tsx` | CRM overview dashboard |
| `src/pages/tenant/Companies.tsx` | Companies list with filters + PIB lookup |
| `src/pages/tenant/CompanyDetail.tsx` | Company detail with tabs |
| `src/pages/tenant/Contacts.tsx` | Contacts list with multi-select filters |
| `src/pages/tenant/ContactDetail.tsx` | Contact detail with company links |
| `src/pages/tenant/Meetings.tsx` | Meetings list + calendar cards |
| `src/pages/tenant/OpportunityDetail.tsx` | Opportunity detail with stage buttons |
| `supabase/functions/company-lookup/index.ts` | PIB lookup via Checkpoint.rs API |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/Leads.tsx` | Rewrite: first_name/last_name, contact_id, inline status change |
| `src/pages/tenant/Opportunities.tsx` | Rewrite: Kanban board, closed_at auto-set |
| `src/App.tsx` | Add all new CRM routes |
| `src/layouts/TenantLayout.tsx` | Update CRM sidebar nav items |
| `src/i18n/translations.ts` | Add ~80 new CRM translation keys |
| `src/config/rolePermissions.ts` | No change needed (crm module already exists) |

---

## Technical Details

### Database Schema (Key Tables)

```text
companies (
  id uuid PK DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  legal_name text NOT NULL,
  display_name text,
  pib varchar(9),
  maticni_broj varchar(8),
  is_internal boolean DEFAULT false,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  email text, phone text, website text,
  address text, city text, postal_code text, country text DEFAULT 'Srbija',
  partner_id uuid REFERENCES partners(id),  -- link to legacy partners for accounting
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

contacts (
  id uuid PK DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  first_name text NOT NULL,
  last_name text,
  email text, phone text,
  type text DEFAULT 'prospect' CHECK (type IN ('customer','supplier','prospect')),
  seniority_level text CHECK (seniority_level IN ('c_level','executive','senior_manager','manager','senior','mid','junior','intern')),
  function_area text CHECK (function_area IN ('management','sales','marketing','finance','hr','it','operations','legal','procurement','production','other')),
  address text, city text, postal_code text, country text,
  website text, notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

contact_company_assignments (
  id uuid PK, contact_id uuid FK, company_id uuid FK,
  job_title text, department text, is_primary boolean DEFAULT false,
  tenant_id uuid FK, assigned_at timestamptz DEFAULT now()
)

meetings (
  id uuid PK, tenant_id uuid FK,
  title text NOT NULL, description text,
  scheduled_at timestamptz NOT NULL, duration_minutes int DEFAULT 60,
  location text,
  communication_channel text CHECK (... IN ('in_person','video_call','phone_call','email','hybrid')),
  status text DEFAULT 'scheduled' CHECK (... IN ('scheduled','in_progress','completed','cancelled')),
  meeting_type_id uuid FK -> meeting_types,
  notes text, created_at, updated_at
)

activities (
  id uuid PK, tenant_id uuid FK,
  type text NOT NULL, description text,
  company_id uuid FK, contact_id uuid FK,
  lead_id uuid FK, opportunity_id uuid FK,
  meeting_id uuid FK,
  created_at timestamptz DEFAULT now()
)
```

### Leads Table Alterations

```text
ALTER TABLE leads ADD COLUMN first_name text;
ALTER TABLE leads ADD COLUMN last_name text;
ALTER TABLE leads ADD COLUMN job_title text;
ALTER TABLE leads ADD COLUMN contact_id uuid REFERENCES contacts(id);
-- Migrate existing data: SET first_name = name WHERE first_name IS NULL
UPDATE leads SET first_name = name WHERE first_name IS NULL;
```

### Opportunities Table Alterations

```text
ALTER TABLE opportunities ADD COLUMN contact_id uuid REFERENCES contacts(id);
ALTER TABLE opportunities ADD COLUMN closed_at timestamptz;
ALTER TABLE opportunities ADD COLUMN description text;
```

### Kanban Board Pattern

```text
5 columns: qualification | proposal | negotiation | closed_won | closed_lost
Each column:
  - Header: stage name + count badge + total RSD value
  - Cards: title, partner/contact name, value, probability, expected close date
  - Click -> navigate to /crm/opportunities/:id
```

### Company PIB Lookup Flow

```text
1. User types 9-digit PIB in Companies form
2. Frontend calls edge function: POST /company-lookup { pib }
3. Edge function checks Checkpoint.rs API
4. Returns company data -> auto-fills form fields
5. User confirms and saves
```

### Contact Type Auto-Inference

```text
When a contact is linked to a company:
  - Fetch company's category codes
  - If codes include 'supplier'/'contractor'/'subcontractor' -> type = 'supplier'
  - If codes include 'customer' -> type = 'customer'
  - Otherwise -> type = 'prospect'
  - Type field becomes read-only when company is selected
```

### CRM Dashboard Queries

```text
- Leads count (total) + by status breakdown
- Open opportunities: filter out closed_won/closed_lost, sum value
- Contacts count
- Conversion rate: (converted leads / total leads) * 100
- Quick action links to each CRM sub-module
```


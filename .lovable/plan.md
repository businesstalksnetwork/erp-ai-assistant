

# Audit: Settings Pages CRUD and Seed Data Status

## Summary of Findings

I reviewed all settings pages referenced from the Settings hub. Here is the status of each:

### Pages with Full CRUD -- No Action Needed

| Page | Table | Has Add | Has Edit | Has Delete | Seed Data |
|------|-------|---------|----------|------------|-----------|
| Legal Entities | `legal_entities` | Yes | Yes | Yes | 3 rows |
| Locations | `locations` | Yes | Yes | Yes | 3 rows |
| Warehouses | `warehouses` | Yes | Yes | Yes | 3 rows |
| Cost Centers | `cost_centers` | Yes | Yes | Yes | 5 rows |
| Bank Accounts | `bank_accounts` | Yes | Yes | Yes | 1 row |
| Tax Rates | `tax_rates` | Yes | Yes | No (edit only) | 8 rows |
| Payroll Parameters | `payroll_parameters` | Yes | Yes | Yes | 3 rows |
| Integrations | `sef/ebol/eotp_connections` | Yes | Yes | Toggle | N/A (config) |
| Business Rules | `tenant_settings` | Save form | Save form | N/A | Settings JSON |
| Opportunity Stages | `opportunity_stages` | Yes | Yes | Yes | 6 rows |
| Discount Approval Rules | `discount_approval_rules` | Yes | Yes | Yes | 0 rows |
| Approval Workflows | `approval_workflows` | Yes | Yes | Yes | 0 rows |
| Data Protection | `data_subject_requests` | Yes | Complete | N/A | 0 rows |
| Posting Rules | `posting_rule_catalog` | Yes (just added) | Yes | N/A | 20 rows |
| DMS Settings | `document_categories` etc. | Yes (just added) | Yes | Yes | Just seeded |
| Partner Categories | `company_categories` | Yes | Yes | Yes | Seeded |
| Accounting Architecture | N/A (visual flowchart) | N/A | N/A | N/A | N/A |
| Event Monitor | `domain_events` | N/A (read-only log) | Retry action | N/A | 0 rows |
| Audit Log | `audit_log` | N/A (read-only log) | N/A | N/A | Generated |
| AI Audit Log | `ai_audit_log` | N/A (read-only log) | N/A | N/A | Generated |
| Legacy Import | N/A (upload wizard) | N/A | N/A | N/A | N/A |

### Pages with Issues

**1. Currencies -- Add button is disabled (line 66)**
- The "Add" button has `disabled` prop hardcoded to `true`: `<Button size="sm" disabled>`
- There is no add/edit dialog at all -- it's read-only
- Has 5 rows of seed data and NBS import works, but users cannot manually add or edit currencies
- **Fix needed**: Add CRUD dialog for currencies (code, name, symbol, is_base, is_active)

**2. Approval Workflows -- no seed data (0 rows)**
- Full CRUD UI exists and works correctly
- Empty by default -- users see "No results" with no guidance
- **Fix needed**: Seed default workflows (e.g., Invoice approval above threshold, Journal entry approval, Purchase order approval)

**3. Discount Approval Rules -- no seed data (0 rows)**
- Full CRUD UI exists and works correctly
- Empty by default
- **Fix needed**: Seed default rules (e.g., admin: 50% max, manager: 20%, sales: 10%, user: 5%)

**4. Location Types -- no seed data (0 rows)**
- CRUD exists inside the Locations page (Manage Types dialog)
- Empty by default, so the Location Type selector in the add/edit dialog shows nothing
- **Fix needed**: Seed default types (Kancelarija/Office, Prodavnica/Shop, Magacin/Warehouse, Proizvodnja/Production)

## Proposed Plan

### Migration: Seed missing default data

Seed for all existing tenants + add to `seed_dms_defaults` trigger (or create new trigger):

**Location Types** (4 types):
- Kancelarija (office) -- no warehouse, no sellers
- Prodavnica (shop) -- has warehouse, has sellers
- Magacin (warehouse) -- has warehouse, no sellers
- Proizvodnja (production) -- has warehouse, no sellers

**Approval Workflows** (3 defaults):
- Invoice approval (entity_type: invoice, threshold: 500000, min_approvers: 1, roles: [admin, manager])
- Journal entry approval (entity_type: journal_entry, threshold: 1000000, min_approvers: 1, roles: [admin, accountant])
- Purchase order approval (entity_type: purchase_order, threshold: 200000, min_approvers: 1, roles: [admin, manager])

**Discount Approval Rules** (4 defaults):
- admin: max 50%, no approval needed
- manager: max 20%, approval above 15%
- sales: max 10%, approval above 5%
- user: max 5%, approval above 3%

### Currencies page: Enable CRUD

- Remove `disabled` from Add button
- Add Dialog with fields: code, name, symbol, is_base (switch), is_active (switch)
- Add Edit button to each table row
- Add save mutation (insert/update to `currencies` table)

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Seed location_types, approval_workflows, discount_approval_rules |
| `src/pages/tenant/Currencies.tsx` | Enable Add button, add CRUD dialog with edit capability |


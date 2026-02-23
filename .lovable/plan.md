

# CRM Phase 1: Account Tiering, Dormancy Detection, Contact Roles & Credit Status

## Overview

Add four CRM intelligence features to the existing partner/company system: automatic account tiering based on invoice revenue, dormancy detection with auto-task creation, contact roles per account, and live credit status display.

---

## 1. Database Migration

### New columns on `partners`
- `account_tier` TEXT (A/B/C/D) DEFAULT NULL -- computed tier
- `tier_revenue_12m` NUMERIC DEFAULT 0 -- cached trailing 12-month revenue
- `tier_updated_at` TIMESTAMPTZ -- when tier was last calculated
- `last_invoice_date` DATE -- cached for dormancy detection
- `dormancy_status` TEXT DEFAULT 'active' -- 'active', 'at_risk', 'dormant'
- `dormancy_detected_at` TIMESTAMPTZ

### New column on `contact_company_assignments`
- `role` TEXT DEFAULT NULL -- e.g. 'decision_maker', 'influencer', 'champion', 'end_user', 'billing', 'technical'

### New table: `crm_tasks`
For storing auto-generated and manual CRM tasks (dormancy alerts, follow-ups, etc.):
- `id` UUID PK
- `tenant_id` UUID NOT NULL
- `partner_id` UUID REFERENCES partners
- `title` TEXT NOT NULL
- `description` TEXT
- `task_type` TEXT NOT NULL (dormancy_alert, follow_up, manual)
- `status` TEXT DEFAULT 'open' (open, in_progress, completed, dismissed)
- `priority` TEXT DEFAULT 'medium' (low, medium, high, urgent)
- `due_date` DATE
- `assigned_to` UUID (user id)
- `created_at`, `updated_at` TIMESTAMPTZ
- RLS: tenant members can manage

### Database function: `calculate_partner_tiers`
A PL/pgSQL function that:
1. For each partner in a tenant, sums `invoices.total` WHERE `invoice_date >= now() - interval '12 months'` AND `status IN ('sent','paid','posted')`
2. Ranks partners by revenue: Top 20% = A, next 30% = B, next 30% = C, bottom 20% = D
3. Updates `account_tier`, `tier_revenue_12m`, `tier_updated_at`

### Database function: `detect_partner_dormancy`
A PL/pgSQL function that:
1. For each active partner, finds the max `invoice_date` from invoices
2. Updates `last_invoice_date`
3. Applies tier-specific thresholds:
   - Tier A: >60 days = at_risk, >120 days = dormant
   - Tier B: >90 days = at_risk, >180 days = dormant
   - Tier C/D: >120 days = at_risk, >240 days = dormant
4. Creates a `crm_tasks` record (type: dormancy_alert) when status transitions to at_risk or dormant (avoiding duplicates)

---

## 2. Edge Function: `crm-tier-refresh`

A callable edge function that invokes `calculate_partner_tiers` and `detect_partner_dormancy` for a given tenant. Can be triggered manually from CRM Dashboard or scheduled via cron.

---

## 3. UI Changes

### A. Companies List (`Companies.tsx`)
- Add tier badge column (A/B/C/D) with color coding (A=emerald, B=blue, C=amber, D=gray)
- Add dormancy status indicator (green dot = active, yellow = at_risk, red = dormant)
- Add tier filter to the filter bar

### B. Company Detail (`CompanyDetail.tsx`)
- **Account Health Card** (new card in overview tab):
  - Account tier badge with 12-month revenue
  - Dormancy status with last invoice date
  - Credit status: outstanding balance vs credit limit (from summing unpaid invoices)
  - Credit utilization progress bar (green <70%, amber 70-90%, red >90%)
- **Contact Roles**: In the contacts tab, show role badge next to each contact and allow editing the role via a dropdown

### C. CRM Dashboard (`CrmDashboard.tsx`)
- Add "Accounts at Risk" card showing partners with dormancy_status = 'at_risk' or 'dormant'
- Add "Tier Distribution" mini chart (count of A/B/C/D)
- Add "Refresh Tiers" button that calls the edge function

### D. CRM Tasks Widget
- New small card on CRM Dashboard showing open CRM tasks (dormancy alerts)
- Click navigates to partner detail

---

## 4. Contact Role Assignment

### On `contact_company_assignments`
Add a `role` column with these predefined values:
- `decision_maker` -- Final purchasing authority
- `influencer` -- Influences decisions
- `champion` -- Internal advocate
- `end_user` -- Uses the product/service
- `billing` -- Handles invoices/payments
- `technical` -- Technical contact
- `primary` -- Primary point of contact

### UI: Contact role editing
- In CompanyDetail contacts tab: add a role dropdown per contact
- In Contacts form (dialog): add role field when company is selected

---

## 5. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Migration SQL | Create | New columns, table, functions |
| `supabase/functions/crm-tier-refresh/index.ts` | Create | Edge function to trigger tier calculation |
| `src/pages/tenant/CompanyDetail.tsx` | Modify | Add Account Health card, contact roles, credit status |
| `src/pages/tenant/Companies.tsx` | Modify | Add tier/dormancy columns and filters |
| `src/pages/tenant/CrmDashboard.tsx` | Modify | Add at-risk accounts, tier distribution, tasks widget |
| `src/pages/tenant/Contacts.tsx` | Modify | Add role field in contact form |
| `src/i18n/translations.ts` | Modify | Add translations for tiers, roles, dormancy |

---

## Technical Notes

- **Credit status** is computed client-side by summing unpaid invoices (`status IN ('sent','overdue')`) for a partner -- no new DB column needed
- **Tier calculation** uses `NTILE(10)` or `PERCENT_RANK()` window functions for percentile-based ranking
- **Dormancy thresholds** are hardcoded initially but could be moved to `tenant_settings` later
- **No cron setup** in this phase -- manual trigger via button. Cron can be added as a follow-up
- All new columns have defaults so existing data is unaffected
- RLS on `crm_tasks` follows the standard tenant-member pattern


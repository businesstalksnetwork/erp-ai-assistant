
# Settings — Complete Gap Analysis & Upgrade Plan

## Current State Summary

After reviewing all Settings-related pages, routes, and the sidebar navigation, here is a full inventory of what exists, what's broken/incomplete, and what's missing entirely.

---

## GAP 1: Settings Hub Page — Missing Important Sections

The `/settings` hub card grid is missing several pages that already exist and have routes registered:

**Currently shown in the Settings hub:**
- Organization: Legal Entities, Locations, Warehouses, Cost Centers
- Finance: Bank Accounts, Tax Rates, Posting Rules, Accounting Architecture, Payroll Parameters
- Operations: Users, API Configuration (Integrations), Business Rules, Sales Channels, Web Sales (conditional), Legacy Import, AI Audit Log

**Already built but NOT linked from the Settings hub:**
- `Currencies` → `/settings/currencies` (full page exists, route exists, sidebar has it — but NOT in hub)
- `Approval Workflows` → `/settings/approvals` (full page exists, route exists, sidebar has it — but NOT in hub)
- `Pending Approvals` → `/settings/pending-approvals` (full page exists — but NOT in hub)
- `Audit Log` → `/settings/audit-log` (full page exists — but NOT in hub)
- `Event Monitor` → `/settings/events` (full page exists — but NOT in hub)
- `Departments` → `/hr/departments` (exists but technically a settings-level concept)

**Action:** Add 5 missing cards to the Settings hub under appropriate sections.

---

## GAP 2: Sidebar Settings Nav — Missing Items

The `settingsNav` in `TenantLayout.tsx` (lines 205–215) only shows 9 items:
- companySettings, taxRates, currencies, users, approvalWorkflows, pendingApprovalsPage, integrations, auditLog, eventMonitor

**Missing from sidebar settings nav** (routes and pages exist):
- `Payroll Parameters` → `/settings/payroll-parameters` — just added via PRD upgrade but NOT in sidebar
- `AI Audit Log` → `/settings/ai-audit-log` — just added via PRD upgrade but NOT in sidebar
- `Legacy Import` → `/settings/legacy-import` — exists but NOT in sidebar
- `Business Rules` → `/settings/business-rules` — exists but NOT in sidebar
- `Posting Rules` → `/settings/posting-rules` — exists but NOT in sidebar

**Action:** Add 5 missing items to `settingsNav` in `TenantLayout.tsx`.

---

## GAP 3: PostingRules Page — Empty Because of Missing Tenant Scope in DB Query

Looking at `PostingRules.tsx` line 33-36, it queries `posting_rule_catalog` filtered by `tenant_id`. However, based on the screenshot the user shared (which shows an empty/broken state), the `posting_rule_catalog` table likely has no records because it's never seeded per-tenant. The page itself is structurally complete but has no data.

**Action:** Add a migration that seeds default `posting_rule_catalog` entries for all existing tenants (same as what gets seeded on new tenant creation). Also add a "Seed Defaults" button to the PostingRules page UI.

---

## GAP 4: Settings Hub — Inconsistent Grouping

The current Settings hub groups items as "Organization", "Finance", "Operations". Several items are in wrong groups or the groupings are confusing:
- "Posting Rules" is in Finance but it's really a finance/accounting bridge — ok
- "Legacy Import" is in Operations but feels like a one-time utility — it belongs in a new "Data" section
- There's no "Compliance & Audit" section for Audit Log, AI Audit Log, Event Monitor

**Action:** Reorganize into 4 clear sections:
1. **Organization** — Legal Entities, Locations, Warehouses, Cost Centers, Currencies
2. **Finance** — Bank Accounts, Tax Rates, Posting Rules, Accounting Architecture, Payroll Parameters
3. **Operations** — Users, Approval Workflows, Business Rules, Sales Channels, Web Sales, Integrations
4. **Audit & Data** — Audit Log, AI Audit Log, Event Monitor, Legacy Import

---

## GAP 5: Missing Translations

The Settings hub uses `t("organization")`, `t("finance")`, `t("operations")` but these keys may not exist in translations (they use `as any` casting as a workaround). The new section headings also need translations.

**Action:** Add missing translation keys for settings section headings in both English and Serbian.

---

## Implementation Plan

### Files to Modify

| File | Change |
|---|---|
| `src/pages/tenant/Settings.tsx` | Add 5 missing page cards, reorganize into 4 sections |
| `src/layouts/TenantLayout.tsx` | Add 5 missing items to `settingsNav` |
| `src/i18n/translations.ts` | Add missing translation keys for settings sections |
| `src/pages/tenant/PostingRules.tsx` | Add "Seed Defaults" button for empty state |
| `supabase/migrations/` | Seed `posting_rule_catalog` for existing tenants |

### Details

**Settings.tsx** — New 4-section layout:
```
Organization (5 cards):
  Legal Entities, Locations, Warehouses, Cost Centers, Currencies [NEW]

Finance (5 cards):
  Bank Accounts, Tax Rates, Posting Rules, Accounting Architecture, Payroll Parameters

Operations (5 cards):
  Users, Approval Workflows [NEW], Business Rules, Sales Channels, Integrations

Audit & Data (5 cards):
  Audit Log [NEW], AI Audit Log, Event Monitor [NEW], Legacy Import, Pending Approvals [NEW]
```

**TenantLayout.tsx settingsNav** — Add these 5 entries:
- `{ key: "payrollParameters", url: "/settings/payroll-parameters", icon: Calculator }`
- `{ key: "aiAuditLog", url: "/settings/ai-audit-log", icon: ShieldCheck }`
- `{ key: "legacyImport", url: "/settings/legacy-import", icon: Upload }`
- `{ key: "businessRules", url: "/settings/business-rules", icon: FileText }`
- `{ key: "postingRules", url: "/settings/posting-rules", icon: BookOpen }`

**translations.ts** — Add keys:
- `organization`, `finance`, `operations`, `auditData` (section headings)
- `payrollParameters`, `aiAuditLog`, `legacyImport`, `pendingApprovalsPage`, `auditLog`, `eventMonitor` (if missing)

**PostingRules.tsx** — When no rules exist, show a "Seed Default Rules" button that calls a Supabase function or inserts default rules.

**Migration** — Seed `posting_rule_catalog` rows for all tenants that have 0 rules:
```sql
INSERT INTO posting_rule_catalog (tenant_id, rule_code, description, debit_account_code, credit_account_code)
SELECT t.id, r.rule_code, r.description, r.debit_account_code, r.credit_account_code
FROM tenants t
CROSS JOIN (VALUES
  ('pos_cash_receipt', 'POS Cash Receipt', '2430', NULL),
  ('pos_card_receipt', 'POS Card Receipt', '2431', NULL),
  ('pos_revenue', 'POS Revenue', NULL, '6010'),
  ('pos_output_vat', 'POS Output VAT', NULL, '2470'),
  ('pos_cogs', 'POS COGS', '5010', NULL),
  ('invoice_ar', 'Invoice AR', '2040', NULL),
  ('invoice_revenue', 'Invoice Revenue', NULL, '6000'),
  ('invoice_output_vat', 'Invoice Output VAT', NULL, '4700'),
  ('payroll_gross_exp', 'Payroll Gross Expense', '5400', NULL),
  ('payroll_net_payable', 'Payroll Net Payable', NULL, '2720'),
  ('payroll_tax', 'Payroll Tax Payable', NULL, '4810'),
  ('payroll_bank', 'Payroll Bank Payment', '2720', '2431')
) AS r(rule_code, description, debit_account_code, credit_account_code)
WHERE NOT EXISTS (
  SELECT 1 FROM posting_rule_catalog prc WHERE prc.tenant_id = t.id
);
```

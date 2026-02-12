

# Phase 7: Business Rules Engine + Dashboard Charts

## Overview

Two remaining gaps: the Business Rules page is a placeholder, and the Dashboard has KPI cards but no visual charts despite `recharts` being installed. This phase builds both.

---

## Part 1: Business Rules

Business Rules are tenant-level configuration settings that control system behavior. Instead of a generic rules engine, we implement concrete, useful settings.

### What gets configured

**Auto-numbering sequences:**
- Invoice number format and next sequence (e.g., `INV-2026-{seq}`, next: 42)
- Journal entry number format and next sequence (e.g., `JE-{seq}`)

**Default account mappings:**
- Default Receivable Account (used when posting invoices)
- Default Revenue Account
- Default Tax Payable Account
- Default Cash/Bank Account (used when marking invoices paid)
- Default COGS Account (for inventory cost tracking)

**General settings:**
- Default currency (RSD, EUR, USD)
- Fiscal year start month (January, April, July, October)
- Require approval for journal entries over a threshold amount
- Auto-post invoices (skip draft stage)

### Database

Create a `tenant_settings` table:
- `id`, `tenant_id` (unique), `settings` (JSONB)
- One row per tenant, JSONB stores all configuration
- RLS: tenant members can read, admins can update
- Seed default settings when a tenant is created (extend the existing seed trigger)

### Frontend (`/settings/business-rules`)

- Card-based layout with sections: Numbering, Default Accounts, General
- Each section has inline-editable fields
- Account dropdowns pull from `chart_of_accounts`
- Save button persists the entire settings object
- Validation: account codes must exist, sequence numbers must be positive

---

## Part 2: Dashboard Charts

Add two charts to the Dashboard using `recharts` (already installed):

**Revenue vs Expenses (last 6 months):**
- Bar chart with monthly revenue and expense totals
- Data comes from existing journal_lines queries, grouped by month
- Uses `BarChart` from recharts

**Invoice Status Distribution:**
- Pie/donut chart showing count of invoices by status (draft, sent, paid, cancelled)
- Simple query on `invoices` table grouped by status
- Uses `PieChart` from recharts

### Layout

Charts go in a new row between the KPI cards and the AI Insights card on the Dashboard.

---

## Files

| Action | File | What |
|--------|------|------|
| Migration | New SQL migration | `tenant_settings` table + RLS + default seed in tenant creation trigger |
| Rewrite | `src/pages/tenant/BusinessRules.tsx` | Full settings UI with numbering, default accounts, general config |
| Modify | `src/pages/tenant/Dashboard.tsx` | Add Revenue/Expenses bar chart and Invoice Status pie chart |
| Modify | `src/i18n/translations.ts` | Add keys for business rules labels and chart labels (EN + SR) |

---

## Technical Details

- `tenant_settings` uses a single JSONB column to avoid schema changes when adding new settings. Default structure:
```json
{
  "invoice_prefix": "INV",
  "invoice_next_seq": 1,
  "journal_prefix": "JE",
  "journal_next_seq": 1,
  "default_receivable_account_id": null,
  "default_revenue_account_id": null,
  "default_tax_account_id": null,
  "default_cash_account_id": null,
  "default_cogs_account_id": null,
  "default_currency": "RSD",
  "fiscal_year_start_month": 1,
  "journal_approval_threshold": null,
  "auto_post_invoices": false
}
```
- The monthly revenue/expense chart query groups `journal_lines` by `entry_date` month for the last 6 months, filtering by account type (revenue vs expense)
- Chart colors follow the existing theme: `text-accent` for revenue, `text-destructive` for expenses
- The tenant creation seed trigger is extended to also insert a default `tenant_settings` row




# Sidebar Restructure: Move Partners to CRM + Comprehensive Settings

## Problem

Partners (customers/suppliers) are currently under Settings, but they belong in a CRM/Sales module. Settings should focus purely on organization configuration. Tax Rates also belongs in Settings as it's configuration, not a business entity.

## New Sidebar Structure

```text
--- Main ---
  Dashboard

--- CRM ---
  Partners (moved from /settings/partners to /crm/partners)

--- Inventory ---
  Products
  Stock Overview
  Movement History

--- Accounting ---
  Chart of Accounts
  Journal Entries
  Invoices
  Fiscal Periods
  General Ledger
  Reports

--- Settings ---
  Company Settings (hub: legal entities, locations, warehouses, sales channels, cost centers, bank accounts, integrations, business rules)
  Tax Rates
  Users
  Audit Log
```

## Changes

### 1. Route update (`App.tsx`)
- Change `/settings/partners` to `/crm/partners`

### 2. Sidebar restructure (`TenantLayout.tsx`)
- Remove Partners from `settingsNav`
- Add new `crmNav` group with Partners
- Keep Tax Rates in Settings (it's configuration)

### 3. Settings hub page (`Settings.tsx`)
- Add Tax Rates and Users cards to the settings hub so all org config is accessible from one page
- Keep existing cards (legal entities, locations, warehouses, etc.)

### 4. Translations (`translations.ts`)
- Add "crm" key for the new sidebar group label (EN: "CRM", SR: "CRM")

### 5. Partners page (`Partners.tsx`)
- Update any internal navigation references from `/settings/partners` to `/crm/partners`

## Technical Details

| File | Change |
|------|--------|
| `src/layouts/TenantLayout.tsx` | Add `crmNav` array, move Partners there, add CRM sidebar group |
| `src/App.tsx` | Change route from `settings/partners` to `crm/partners` |
| `src/pages/tenant/Settings.tsx` | Add Tax Rates + Users cards to the hub |
| `src/i18n/translations.ts` | Add "crm" translation key |


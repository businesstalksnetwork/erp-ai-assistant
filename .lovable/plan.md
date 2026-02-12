

# Phase 3c: Tax Rate Seeding + Accounts Payable/Receivable + Financial Reports

This phase adds critical accounting functionality: automatic tax rate provisioning, payment tracking, and basic financial reporting.

---

## What gets built

### 1. Auto-seed Serbian Tax Rates for Tenants

Currently the `tax_rates` table is empty -- invoicing won't work without rates. We'll:
- Create a database function `seed_tenant_tax_rates(tenant_id)` that inserts the 3 standard Serbian PDV rates: 20% (Opsta stopa), 10% (Posebna stopa), 0% (Oslobodjeno od PDV-a)
- Create a trigger on `tenants` table that calls this function on INSERT (so new tenants get rates automatically)
- Run a one-time migration to seed rates for all existing tenants

### 2. Tax Rates Management Page (`/settings/tax-rates`)

- Table listing tenant's tax rates (name, rate %, default flag, active)
- Add/Edit dialog for custom rates
- Toggle default rate
- Added to Settings navigation

### 3. General Ledger View (`/accounting/ledger`)

- Shows all posted journal entries grouped by account
- Filter by account, date range
- Running balance per account
- Debit/Credit totals

### 4. Trial Balance Report (`/accounting/reports/trial-balance`)

- Summary of all accounts with total debits, total credits, and balances
- Filter by fiscal period / date range
- Shows only accounts with activity
- Print-friendly layout

### 5. Income Statement (Bilans Uspeha) (`/accounting/reports/income-statement`)

- Revenue accounts minus Expense accounts for a date range
- Grouped by account type
- Net income/loss calculation

### 6. Balance Sheet (Bilans Stanja) (`/accounting/reports/balance-sheet`)

- Assets, Liabilities, Equity sections
- As-of-date snapshot
- Assets = Liabilities + Equity validation

---

## Routes

| Route | Page |
|-------|------|
| `/settings/tax-rates` | Tax Rates CRUD |
| `/accounting/ledger` | General Ledger |
| `/accounting/reports` | Reports overview |
| `/accounting/reports/trial-balance` | Trial Balance |
| `/accounting/reports/income-statement` | Income Statement |
| `/accounting/reports/balance-sheet` | Balance Sheet |

---

## Files

| Action | File |
|--------|------|
| Migration | Seed tax rates function + trigger + backfill existing tenants |
| Create | `src/pages/tenant/TaxRates.tsx` |
| Create | `src/pages/tenant/GeneralLedger.tsx` |
| Create | `src/pages/tenant/Reports.tsx` (overview) |
| Create | `src/pages/tenant/TrialBalance.tsx` |
| Create | `src/pages/tenant/IncomeStatement.tsx` |
| Create | `src/pages/tenant/BalanceSheet.tsx` |
| Modify | `src/App.tsx` -- add 6 routes |
| Modify | `src/layouts/TenantLayout.tsx` -- add nav items for Ledger, Reports, Tax Rates |
| Modify | `src/i18n/translations.ts` -- add report and tax rate keys |

---

## Technical notes

- Reports query `journal_lines` joined with `journal_entries` (status = 'posted') and `chart_of_accounts`
- All data is tenant-scoped via existing RLS policies
- Reports are read-only views with date filters
- Tax rate seeding uses a `SECURITY DEFINER` function so it runs with elevated privileges during tenant creation
- The trigger fires `AFTER INSERT ON tenants` to auto-provision rates


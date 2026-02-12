

# Phase 9: Advanced Accounting & Compliance Tables (PRD Supplement)

Add the remaining edge-case tables and features needed for production-grade Serbian regulatory compliance and advanced financial operations. This phase fills the gaps between the current module set and a fully compliant ERP.

---

## What Gets Built

### Group A: Fixed Assets & Depreciation
Track company assets with automated depreciation schedules per Serbian accounting standards.

| Table | Purpose |
|-------|---------|
| `fixed_assets` | Asset register: name, acquisition_date, acquisition_cost, useful_life_months, depreciation_method (straight_line/declining), salvage_value, status (active/disposed/fully_depreciated), tenant_id |
| `fixed_asset_depreciation` | Monthly depreciation entries: asset_id, period, amount, accumulated_total, journal_entry_id (auto-posted) |

### Group B: Accounts Receivable & Payable Aging
Structured aging snapshots for AR/AP analysis and bad debt provisioning.

| Table | Purpose |
|-------|---------|
| `ar_aging_snapshots` | Periodic AR aging: snapshot_date, partner_id, current/30/60/90/over90 buckets, total_outstanding |
| `ap_aging_snapshots` | Periodic AP aging: same structure for supplier payables |
| `bad_debt_provisions` | Bad debt reserves: partner_id, provision_date, amount, reason, journal_entry_id, status |

### Group C: Deferrals & Accruals
Prepaid expenses and deferred revenue with automated monthly recognition.

| Table | Purpose |
|-------|---------|
| `deferrals` | Deferred revenue/expense: type (revenue/expense), total_amount, recognized_amount, start_date, end_date, frequency (monthly), source_invoice_id, account_id |
| `deferral_schedules` | Individual recognition entries: deferral_id, period_date, amount, journal_entry_id, status (pending/posted) |

### Group D: Loan & Installment Tracking
Track company loans (given/received) with amortization schedules.

| Table | Purpose |
|-------|---------|
| `loans` | Loan header: partner_id, type (receivable/payable), principal, interest_rate, start_date, term_months, status |
| `loan_schedules` | Amortization lines: loan_id, due_date, principal_payment, interest_payment, balance, status (pending/paid), journal_entry_id |

### Group E: Separation of Duties (SOD) & Approval Workflows
Enforce multi-step approval and duty segregation for financial transactions.

| Table | Purpose |
|-------|---------|
| `approval_workflows` | Workflow definitions: entity_type (invoice/journal_entry/purchase_order), min_approvers, required_roles, threshold_amount |
| `approval_requests` | Individual approval instances: workflow_id, entity_type, entity_id, status (pending/approved/rejected), requested_by |
| `approval_steps` | Approval actions: request_id, approver_user_id, action (approve/reject), comment, acted_at |

### Group F: Currency & Exchange Rates
Multi-currency support with NBS exchange rate tracking.

| Table | Purpose |
|-------|---------|
| `currencies` | Currency master: code (RSD, EUR, USD), name, symbol, is_base |
| `exchange_rates` | Daily rates: from_currency, to_currency, rate, rate_date, source (manual/NBS) |

---

## Frontend Updates

### New Pages

| Page | Route | Description |
|------|-------|-------------|
| `FixedAssets.tsx` | `/accounting/fixed-assets` | Asset register with depreciation schedules |
| `AgingReports.tsx` | `/accounting/reports/aging` | AR/AP aging analysis with bucket visualization |
| `Deferrals.tsx` | `/accounting/deferrals` | Manage deferred revenue/expenses and recognition schedules |
| `Loans.tsx` | `/accounting/loans` | Loan tracking with amortization tables |
| `ApprovalWorkflows.tsx` | `/settings/approvals` | Configure and manage approval rules |
| `Currencies.tsx` | `/settings/currencies` | Currency master and exchange rate management |

### Navigation Changes
- Add Fixed Assets, Deferrals, Loans under Accounting sidebar group
- Add Aging Reports under Reports sub-navigation
- Add Approval Workflows and Currencies under Settings

---

## Event Bus Integration
- `fixed_asset.depreciated` -- auto-post depreciation journal entries monthly
- `deferral.recognized` -- auto-post recognition journal entries
- `loan_payment.due` -- notification/reminder for upcoming installments
- `approval.completed` -- update entity status when all approvals are met

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/..._advanced_accounting.sql` | ~14 tables, RLS, triggers, event subscriptions |
| `src/pages/tenant/FixedAssets.tsx` | Asset register and depreciation |
| `src/pages/tenant/AgingReports.tsx` | AR/AP aging visualization |
| `src/pages/tenant/Deferrals.tsx` | Deferred revenue/expense management |
| `src/pages/tenant/Loans.tsx` | Loan amortization tracking |
| `src/pages/tenant/ApprovalWorkflows.tsx` | SOD and approval configuration |
| `src/pages/tenant/Currencies.tsx` | Multi-currency and exchange rates |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add 6 new routes |
| `src/layouts/TenantLayout.tsx` | Add new sidebar items under Accounting and Settings |
| `src/i18n/translations.ts` | Add EN/SR keys for all new entities |
| `src/pages/tenant/Reports.tsx` | Add Aging Reports card |
| `supabase/functions/process-module-event/index.ts` | Add handlers for depreciation, deferral recognition, approval completion |

---

## Technical Notes

- Fixed asset depreciation uses Serbian straight-line method by default; declining balance as option
- AR/AP aging snapshots are point-in-time records, not live views -- a scheduled job or manual action creates them
- Deferrals auto-generate recognition schedules on creation (monthly entries between start and end date)
- Loan amortization schedules are pre-calculated on loan creation using standard annuity formula
- Approval workflows use a threshold-based system: transactions above a certain amount require additional approvers
- Exchange rates table supports both manual entry and future NBS API integration
- All tables include tenant_id with RLS policies for multi-tenant isolation
- Base currency defaults to RSD per Serbian market focus


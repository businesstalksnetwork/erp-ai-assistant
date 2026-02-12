

# Phase 14: Complete CRUD for Remaining Read-Only Modules

## Current State

After reviewing all ~40+ tenant pages, the vast majority already have full Supabase CRUD (create, read, update, delete). However, **4 modules** only display data with disabled "Add" buttons and no create/edit functionality:

1. **Loans** -- read-only list, no add/edit
2. **Fixed Assets** -- read-only list, no add/edit, no depreciation run trigger
3. **Deferrals** -- read-only list, no add/edit, no recognition trigger
4. **Approval Workflows** -- read-only list, no add/edit, no step management

This phase activates all 4 modules with full CRUD dialogs following the same proven patterns used across the rest of the app.

---

## What Gets Built

### 1. Loans -- Full CRUD
- **Add/Edit dialog** with fields: type (receivable/payable), partner, description, principal, interest rate, term months, start date, currency, status
- **Payment schedule view**: when expanding a loan, show calculated monthly payments (principal + interest amortization)
- **Delete** with confirmation

### 2. Fixed Assets -- Full CRUD + Depreciation
- **Add/Edit dialog** with fields: name, category, acquisition date, acquisition cost, depreciation method (straight line / declining balance), useful life months, salvage value, status
- **Run Depreciation** button: calculates and inserts a depreciation record for the current period into `fixed_asset_depreciation`
- **Delete** with confirmation

### 3. Deferrals -- Full CRUD + Recognition
- **Add/Edit dialog** with fields: type (revenue/expense), description, total amount, start date, end date, periods count, account ID, currency, status
- **Recognize Period** button: increments `recognized_amount` by the per-period amount and inserts a deferral schedule entry
- **Delete** with confirmation

### 4. Approval Workflows -- Full CRUD + Steps
- **Add/Edit dialog** with fields: name, entity type, min approvers, threshold amount, is active
- **Workflow Steps management**: inline table to add/remove approval steps (step order, role required, is mandatory)
- **Delete** with confirmation

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/Loans.tsx` | Full rewrite: add/edit dialog, delete, payment schedule expansion |
| `src/pages/tenant/FixedAssets.tsx` | Full rewrite: add/edit dialog, delete, depreciation action |
| `src/pages/tenant/Deferrals.tsx` | Full rewrite: add/edit dialog, delete, recognition action |
| `src/pages/tenant/ApprovalWorkflows.tsx` | Full rewrite: add/edit dialog with steps, delete |
| `src/i18n/translations.ts` | Add missing keys for loan/asset/deferral/workflow form fields |

## No New Files Required

All changes are modifications to existing page components, following established patterns.

---

## Technical Details

### Loans Payment Schedule
- Client-side calculation using standard amortization formula
- Displayed in an expandable accordion per loan (same pattern as Payroll runs)
- Fields per row: period number, payment date, principal portion, interest portion, total payment, remaining balance

### Fixed Assets Depreciation
- **Straight line**: monthly amount = (acquisition_cost - salvage_value) / useful_life_months
- **Declining balance**: monthly amount = (book_value * annual_rate) / 12
- Inserts into `fixed_asset_depreciation` table with period, amount, and cumulative values
- Updates `accumulated_depreciation` and `book_value` on the asset record

### Deferrals Recognition
- Per-period amount = total_amount / number of periods (months between start and end date)
- Each recognition inserts a schedule entry and increments `recognized_amount`
- When fully recognized, status auto-updates to "completed"

### Approval Workflows Steps
- Uses `approval_workflow_steps` table (already exists)
- Inline editable table within the workflow dialog
- Each step: order number, role, is_mandatory flag
- Steps are deleted and re-inserted on save (same pattern as PO lines)

---

## i18n Keys to Add

**Loans**: loanType, receivable, payable, principal, interestRate, termMonths, monthlyPayment, paymentSchedule, remainingBalance, addLoan, editLoan

**Fixed Assets**: acquisitionDate, acquisitionCost, depreciationMethod, straightLine, decliningBalance, usefulLife, salvageValue, bookValue, accumulatedDepreciation, runDepreciation, addAsset, editAsset

**Deferrals**: revenueType, expenseType, totalAmount, recognizedAmount, periodsCount, recognizePeriod, addDeferral, editDeferral

**Approval Workflows**: entityType, minApprovers, thresholdAmount, stepOrder, roleRequired, isMandatory, addWorkflow, editWorkflow, addStep


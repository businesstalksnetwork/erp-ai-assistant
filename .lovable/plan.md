
# Add "Rashodi" (Expenses) Module and Connect Salaries to Expenses

## Problem

Currently there is no dedicated "Rashodi" (Expenses) section anywhere in the application. Salaries/payroll, supplier costs, depreciation, and other operating expenses are scattered across different modules but never consolidated. More critically, **payroll runs in the seed data don't generate journal entries**, so salaries never appear as expenses (rashodi) in the financial reports, dashboard KPIs, or Income Statement.

## What Changes

### 1. Create a dedicated "Rashodi" (Expenses) page

A new page at `/accounting/expenses` that provides a consolidated view of all expenses:

- **Summary cards** at top: Total Expenses, Salary Expenses, Supplier Expenses, Operating Expenses (all from journal entries against expense-type accounts)
- **Monthly expense breakdown chart** (bar chart by expense category)
- **Expense table** listing all journal entries posted to expense accounts, showing: date, description, account name, amount, cost center
- **Category filter**: All / Salaries / Suppliers / Depreciation / Operating
- **Date range filter**
- Links to drill into specific modules (Payroll, Supplier Invoices, Fixed Assets)

### 2. Add payroll journal entries to seed data

In `seed-demo-data/index.ts`, after creating payroll runs (section 48), add journal entries for each "paid" payroll run:

- **Debit**: ACC_EXPENSES (Gross salary expense) for total_gross
- **Debit**: ACC_EXPENSES (Employer contributions) for employer PIO + health
- **Credit**: ACC_AP (Net salary payable) for total_net  
- **Credit**: ACC_AP (Tax + contributions payable) for total_taxes + total_contributions + employer contributions

This ensures salaries flow into the expense account and appear in:
- Dashboard KPI "Rashodi" card
- Revenue vs Expenses chart
- Income Statement
- The new Rashodi page

### 3. Add sidebar navigation link

Add "Rashodi" to the `accountingNav` array in `TenantLayout.tsx` under the "Invoicing & Payments" section, after supplier-related links.

### 4. Add route and translations

- Route: `/accounting/expenses` in `App.tsx`
- Translation keys: `expensesOverview`, `salaryExpenses`, `supplierExpenses`, `operatingExpenses`, `expenseCategory`, `allExpenses`

## Technical Details

### Expenses Page Query Logic

The page queries `journal_lines` joined with `chart_of_accounts` (where `account_type = 'expense'`) and `journal_entries` (where `status = 'posted'`). It groups results by account code prefix to categorize:

- **Salaries**: Journal entries with description containing "Plate" / "Bruto" / "Payroll"
- **Suppliers**: Entries referencing supplier invoices (UF-*)  
- **Depreciation**: Entries referencing fixed assets
- **Operating**: Everything else

### Payroll Journal Entries in Seed

For each payroll run with status "paid" or "approved":

```typescript
// After payroll runs are created (section 48)
for (const pr of payrollRuns) {
  if (pr.status !== "paid" && pr.status !== "approved") continue;
  const jeId = uuid();
  const entryDate = `${pr.period_year}-${String(pr.period_month).padStart(2,"0")}-28`;
  const monthIdx = (pr.period_year - 2025) * 12 + (pr.period_month - 1);
  
  journalEntries.push({
    id: jeId, tenant_id: t,
    entry_number: `JE-PL-${pr.period_year}-${String(pr.period_month).padStart(2,"0")}`,
    entry_date: entryDate,
    description: `Plate ${String(pr.period_month).padStart(2,"0")}/${pr.period_year}`,
    reference: `PAYROLL-${pr.period_year}-${pr.period_month}`,
    status: "posted",
    fiscal_period_id: fpIds[Math.min(monthIdx, fpIds.length - 1)],
    posted_at: entryDate + "T12:00:00Z",
    legal_entity_id: le, source: "payroll",
  });
  
  // Employer contributions (PIO 10% + Health 5.15%)
  const employerContrib = Math.round(pr.total_gross * 0.1515);
  
  journalLines.push(
    // Debit: Gross salary expense
    { id: uuid(), journal_entry_id: jeId, account_id: ACC_EXPENSES,
      debit: pr.total_gross, credit: 0, description: "Bruto plate", sort_order: 1 },
    // Debit: Employer contributions expense
    { id: uuid(), journal_entry_id: jeId, account_id: ACC_EXPENSES,
      debit: employerContrib, credit: 0, description: "Doprinosi na teret poslodavca", sort_order: 2 },
    // Credit: Net salary payable
    { id: uuid(), journal_entry_id: jeId, account_id: ACC_AP,
      debit: 0, credit: pr.total_net, description: "Neto plate za isplatu", sort_order: 3 },
    // Credit: Tax + employee contributions payable
    { id: uuid(), journal_entry_id: jeId, account_id: ACC_AP,
      debit: 0, credit: pr.total_taxes + pr.total_contributions, description: "Porez i doprinosi", sort_order: 4 },
    // Credit: Employer contributions payable
    { id: uuid(), journal_entry_id: jeId, account_id: ACC_AP,
      debit: 0, credit: employerContrib, description: "Doprinosi poslodavac", sort_order: 5 },
  );
}
```

### Sidebar Entry

```typescript
// In accountingNav, after openItems:
{ key: "expensesOverview", url: "/accounting/expenses", icon: TrendingDown, section: "invoicingPayments" },
```

### Files Modified

| File | Change |
|---|---|
| `src/pages/tenant/Expenses.tsx` | **NEW** -- Consolidated expenses (rashodi) page with charts, filters, and drill-down |
| `src/layouts/TenantLayout.tsx` | Add "Rashodi" nav item to accounting section |
| `src/App.tsx` | Add route `/accounting/expenses` |
| `src/i18n/translations.ts` | Add translation keys for expenses page |
| `supabase/functions/seed-demo-data/index.ts` | Add payroll journal entries so salaries appear as expenses |
| `supabase/functions/daily-data-seed/index.ts` | Include payroll expense entries in daily seed |

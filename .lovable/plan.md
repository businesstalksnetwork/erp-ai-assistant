

# UX/UI Review & Next Upgrades Plan

## Current UX/UI Issues Found

### 1. Inconsistent Page Layout Patterns (HIGH)
Several recently-added pages use different layout patterns than the established standard:

- **`RecurringInvoices.tsx`**, **`CashRegister.tsx`**: Use `<div className="space-y-6 p-4 md:p-6">` with their own padding, while the `TenantLayout` already provides `p-4 lg:p-6` on `<main>`. This causes **double padding** on these pages.
- **`Payroll.tsx`**: Uses raw `<h1 className="text-2xl font-bold">` instead of the `PageHeader` component, breaking the visual hierarchy established across other pages like `Invoices.tsx` which correctly uses `<PageHeader>`.
- **`NonEmploymentIncome.tsx`**: Correctly uses `PageHeader` but doesn't use `BiPageLayout` — which is fine for data pages, but the pattern is inconsistent with hub pages.

**Fix**: Remove extra `p-4 md:p-6` from `RecurringInvoices`, `RecurringJournals`, `CashRegister`, and any other Phase A-D pages. Replace raw `<h1>` in `Payroll.tsx` with `PageHeader`.

### 2. New Accounting Routes Missing from Sidebar Nav (HIGH)
All Phase A-D pages (16+ routes) are accessible via `AccountingHub` card links but are **not in the sidebar `accountingNav`** array in `TenantLayout.tsx`. Users navigating to these pages lose sidebar context — the sidebar shows no active item, making it confusing which section they're in.

Missing from sidebar:
- Recurring Invoices/Journals
- Cash Register (Blagajna)
- IOS Balance Confirmation
- CIT Tax Return, Withholding Tax
- Intercompany, Transfer Pricing
- Consolidation, Multi-Period Reports
- Statistički Aneks, KPO Book, Report Snapshots
- Cost Center P&L
- PPP-PD Review

**Fix**: Add the most important routes to `accountingNav` and `hrNav` arrays with appropriate `section` labels. Hub pages serve as discovery; sidebar serves as quick access.

### 3. Hardcoded Serbian Strings (MEDIUM)
Many Phase A-D pages have hardcoded Serbian strings instead of using the `t()` translation system:
- `RecurringInvoices.tsx`: "Novi šablon", "Šabloni", "Učitavanje...", "Otkaži", "Čuvanje..."
- `CashRegister.tsx`: "Blagajna", "Nova stavka", "Primanja", "Izdavanja", "Saldo", "Uplata", "Isplata"
- `IntercompanyTransactions.tsx`, `ConsolidatedStatements.tsx`, `CitTaxReturn.tsx`, `WithholdingTax.tsx`, `StatistickiAneks.tsx`, `KpoBook.tsx`, `MultiPeriodReports.tsx`, `TransferPricing.tsx`, `ReportSnapshots.tsx`: All use hardcoded strings

**Fix**: Extract all user-facing strings to `translations.ts` and wrap with `t()`.

### 4. Payroll Table Not Responsive (MEDIUM)
`Payroll.tsx` uses a raw `<Table>` with 13 columns inside an accordion. On mobile, this overflows without any horizontal scroll wrapper or card mode. Compare with `Invoices.tsx` which uses the `ResponsiveTable` component correctly.

**Fix**: Either wrap the payroll items table in `overflow-x-auto` or refactor to use `ResponsiveTable` with `mobileMode="card"`.

### 5. Missing `overflow-x-auto` on Several Tables (MEDIUM)
Pages with wide tables that don't use `ResponsiveTable`:
- `RecurringInvoices.tsx` — 7 columns, no scroll wrapper
- `CashRegister.tsx` — 7 columns, no scroll wrapper
- `NonEmploymentIncome.tsx` — has `overflow-x-auto` (good)

**Fix**: Add `overflow-x-auto` wrapper to all raw table usages.

### 6. No Loading Skeletons on Some Pages (LOW)
- `RecurringInvoices.tsx`: Shows plain text "Učitavanje..." instead of `<Skeleton>`
- `CashRegister.tsx`: Same plain text loading
- Compare with `NonEmploymentIncome.tsx` which correctly uses `<Skeleton className="h-80" />`

**Fix**: Replace text loading indicators with `Skeleton` components.

### 7. Delete Without Confirmation (LOW)
- `RecurringInvoices.tsx`: Delete button has no confirmation dialog
- `NonEmploymentIncome.tsx`: Uses `confirm()` (browser native) instead of a proper dialog

**Fix**: Use `AlertDialog` component for destructive actions.

### 8. SalesHub Has No Sections (LOW)
`SalesHub.tsx` uses a flat grid (no sections) unlike `HrHub`, `AccountingHub`, and `InventoryHub` which all group links into titled sections. This makes Sales feel less organized.

**Fix**: Group Sales links into sections (e.g., "Documents", "Team & Performance", "Web Sales").

---

## Proposed Implementation

### Step 1: Fix Double Padding
Remove `p-4 md:p-6` from `RecurringInvoices`, `RecurringJournals`, `CashRegister`, and other Phase A-D pages that added their own padding.

### Step 2: Add Missing Routes to Sidebar
Add key Phase A-D routes to `accountingNav` and `hrNav` in `TenantLayout.tsx`:
- Accounting sidebar: IOS, Cash Register, Recurring Invoices, CIT Return, Withholding Tax, Intercompany, Consolidated Reports, Cost Center P&L
- HR sidebar: PPP-PD Review, Non-Employment Income

### Step 3: Fix Payroll Page Header
Replace raw `<h1>` with `PageHeader` component in `Payroll.tsx` for consistency.

### Step 4: Add Table Responsiveness
Wrap raw `<Table>` usages in `overflow-x-auto` divs in `RecurringInvoices`, `CashRegister`, and `Payroll` (accordion items table).

### Step 5: Add Loading Skeletons
Replace text loading states with `<Skeleton>` components in `RecurringInvoices` and `CashRegister`.

### Step 6: Organize SalesHub into Sections
Group `SalesHub` links into titled sections matching the pattern of other hub pages.

### Step 7: Add Delete Confirmations
Add `AlertDialog` to `RecurringInvoices` delete action and replace `confirm()` in `NonEmploymentIncome`.

---

## Technical Details

**Files to modify:**
- `src/layouts/TenantLayout.tsx` — Add ~12 new items to `accountingNav` and ~2 to `hrNav`
- `src/pages/tenant/RecurringInvoices.tsx` — Remove padding, add overflow-x-auto, skeleton, delete confirmation
- `src/pages/tenant/RecurringJournals.tsx` — Same padding fix
- `src/pages/tenant/CashRegister.tsx` — Same padding fix, overflow-x-auto, skeleton
- `src/pages/tenant/Payroll.tsx` — Replace h1 with PageHeader, add overflow-x-auto to items table
- `src/pages/tenant/SalesHub.tsx` — Restructure into sections
- `src/pages/tenant/NonEmploymentIncome.tsx` — Replace `confirm()` with AlertDialog

**No new dependencies required. Estimated: ~7 files modified.**


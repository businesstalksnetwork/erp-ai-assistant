

# Phase 2: Dashboard, High-Traffic Pages, and Responsive Upgrades

This continues the full redesign. Phase 1 established the color system, layouts, auth pages, and shared responsive components (`ResponsiveTable`, `MobileFilterBar`, `MobileActionMenu`). Phase 2 applies them across all major pages.

## Batch 1: Dashboard Redesign

### `src/components/dashboard/WelcomeHeader.tsx`
- Reduce title to `text-xl`, add subtle gradient text effect on the name
- Wrap in a responsive flex that stacks on mobile

### `src/pages/tenant/Dashboard.tsx`
- KPI cards: add colored top border (`border-t-2 border-primary`, `border-accent`, `border-destructive`), reduce title to `text-2xl` on desktop / `text-lg` on mobile
- KPI grid: change from `md:grid-cols-4` to `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`
- Use `fmtNumCompact` for KPI values on mobile
- Chart grids: `grid-cols-1 lg:grid-cols-2` instead of `md:grid-cols-2`
- Pending actions + Quick actions: stack on mobile (`grid-cols-1 md:grid-cols-2`)
- Quick actions: horizontal scroll on mobile
- Export button: move into a "..." overflow on mobile

### Chart Components (all 4)
- `RevenueExpensesChart.tsx`, `InvoiceStatusChart.tsx`, `CashFlowChart.tsx`, `TopCustomersChart.tsx`
- Update bar/pie fill colors to use new palette variables (`hsl(var(--primary))`, `hsl(var(--chart-1))` through `--chart-5`)
- Add `className="stroke-border"` to CartesianGrid
- Tooltip: add dark background styling
- Reduce chart height on mobile from 280 to 220

## Batch 2: Simple List Pages (Card mode on mobile)

These pages have simple rows with name/email/phone/status -- perfect for card layout on mobile.

### Pages to update (all follow same pattern):
1. **Products.tsx** -- Use `ResponsiveTable` with card mode, `MobileFilterBar` for search+actions
2. **Employees.tsx** -- Use `ResponsiveTable` with card mode, primary=full_name
3. **Companies.tsx** -- Use `ResponsiveTable` with card mode, primary=legal_name
4. **Contacts.tsx** -- Use `ResponsiveTable` with card mode, primary=name
5. **Leads.tsx** -- Use `ResponsiveTable` with card mode, primary=name
6. **ChartOfAccounts.tsx** -- Use `ResponsiveTable` with card mode, primary=code+name
7. **SalesOrders.tsx** -- Use `ResponsiveTable` with card mode, primary=order_number
8. **PurchaseOrders.tsx** -- Use `ResponsiveTable` with card mode, primary=order_number

### Pattern for each page:
- Replace raw `<Table>` with `<ResponsiveTable>` defining columns with `ResponsiveColumn<T>` interface
- Replace header toolbar with `<MobileFilterBar>` wrapping search, filters, and action buttons
- Replace inline row action buttons with `<MobileActionMenu>` on mobile
- Page title: reduce from `text-3xl` to `text-2xl`
- Wrap table in a `<Card>` if not already

## Batch 3: Dense Data Pages (Scroll mode on mobile)

These pages have many numeric columns that need horizontal scroll.

### Pages to update:
1. **Invoices.tsx** -- `ResponsiveTable` with `mobileMode="scroll"`, all row actions in `MobileActionMenu`
2. **JournalEntries.tsx** -- `ResponsiveTable` with `mobileMode="scroll"`
3. **InventoryStock.tsx** -- `ResponsiveTable` with `mobileMode="scroll"` (10 columns with numbers)
4. **InventoryMovements.tsx** -- `ResponsiveTable` with `mobileMode="scroll"`
5. **Payroll.tsx** -- Already uses accordion, keep but make the inner items table scroll horizontally; wrap summary grid in responsive `grid-cols-2 sm:grid-cols-4`
6. **GeneralLedger.tsx** -- `ResponsiveTable` with `mobileMode="scroll"`
7. **TrialBalance.tsx** -- `ResponsiveTable` with `mobileMode="scroll"`

### Pattern for each page:
- Use `mobileMode="scroll"` for `ResponsiveTable`
- Numeric columns: use `fmtNumCompact` on mobile (via `useIsMobile` hook)
- Hide less important columns on mobile via `hideOnMobile: true` (e.g., notes, reference)
- Row actions: collapse into `MobileActionMenu`

## Batch 4: Special Pages

### Opportunities.tsx (Kanban board)
- Already uses card layout -- just make the kanban grid responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`
- On mobile: stack stages vertically with collapsible sections
- Adjust card padding and typography

### BalanceSheet.tsx, IncomeStatement.tsx
- These are report pages -- wrap tables in responsive scroll containers
- Reduce font sizes on mobile

## Batch 5: Form Dialogs Consistency

For ALL dialog forms across all pages:
- `max-w-lg` dialogs: add `sm:max-w-lg` (full-width on mobile)
- `max-w-2xl` dialogs: add `sm:max-w-2xl`
- `grid-cols-2` form layouts: change to `grid-cols-1 sm:grid-cols-2`
- `grid-cols-3` form layouts: change to `grid-cols-1 sm:grid-cols-3`
- Number inputs: add `text-right` class

## Technical Details

### Files Modified (in order):

**Dashboard (5 files):**
1. `src/components/dashboard/WelcomeHeader.tsx`
2. `src/pages/tenant/Dashboard.tsx`
3. `src/components/dashboard/RevenueExpensesChart.tsx`
4. `src/components/dashboard/InvoiceStatusChart.tsx`
5. `src/components/dashboard/CashFlowChart.tsx`
6. `src/components/dashboard/TopCustomersChart.tsx`

**Simple list pages (8 files):**
7. `src/pages/tenant/Products.tsx`
8. `src/pages/tenant/Employees.tsx`
9. `src/pages/tenant/Companies.tsx`
10. `src/pages/tenant/Contacts.tsx`
11. `src/pages/tenant/Leads.tsx`
12. `src/pages/tenant/ChartOfAccounts.tsx`
13. `src/pages/tenant/SalesOrders.tsx`
14. `src/pages/tenant/PurchaseOrders.tsx`

**Dense data pages (7 files):**
15. `src/pages/tenant/Invoices.tsx`
16. `src/pages/tenant/JournalEntries.tsx`
17. `src/pages/tenant/InventoryStock.tsx`
18. `src/pages/tenant/InventoryMovements.tsx`
19. `src/pages/tenant/Payroll.tsx`
20. `src/pages/tenant/GeneralLedger.tsx`
21. `src/pages/tenant/TrialBalance.tsx`

**Special pages (3 files):**
22. `src/pages/tenant/Opportunities.tsx`
23. `src/pages/tenant/BalanceSheet.tsx`
24. `src/pages/tenant/IncomeStatement.tsx`

### Key Implementation Patterns:

**ResponsiveTable integration** (Products example):
```tsx
const columns: ResponsiveColumn<typeof products[0]>[] = [
  { key: "name", label: t("name"), primary: true, render: (p) => <Link to={`/inventory/products/${p.id}`}>{p.name}</Link> },
  { key: "sku", label: "SKU", render: (p) => p.sku || "---" },
  { key: "price", label: t("salePrice"), align: "right", render: (p) => fmtNum(Number(p.default_sale_price)) },
  { key: "status", label: t("status"), render: (p) => <Badge>...</Badge> },
  { key: "actions", label: t("actions"), showInCard: false, render: (p) => <MobileActionMenu actions={[...]} /> },
];
```

**MobileFilterBar integration** (replacing raw search/filter rows):
```tsx
<MobileFilterBar
  search={<SearchInput ... />}
  filters={<><Select ... /><Checkbox ... /></>}
  actions={<><ExportButton ... /><Button ... /></>}
/>
```

Due to the large number of files (~24), implementation will be done in parallel batches where possible.


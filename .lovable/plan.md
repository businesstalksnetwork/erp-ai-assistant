

# Phase 3-4: Migrate Remaining Pages and Upgrade Dashboards/Settings

## Pages to Migrate (using PageHeader + ResponsiveTable pattern)

### Sales Module (2 pages)

**Quotes.tsx** - Replace raw `<h1>` + `<Table>` with:
- `PageHeader` with `FileText` icon, description "Create and manage sales quotes", actions slot for Add button
- `ResponsiveTable` with columns: quoteNumber (primary), partner, salesperson (hideOnMobile), opportunity (hideOnMobile), quoteDate, total (right-aligned), status (Badge), actions (showInCard: false)

**SalesOrders.tsx** - Same pattern:
- `PageHeader` with `ShoppingCart` icon, description "Manage customer sales orders"
- `ResponsiveTable` with columns: orderNumber (primary), partner, salesperson (hideOnMobile), quote (hideOnMobile), orderDate, total, status, actions

### Purchasing Module (3 pages)

**PurchaseOrders.tsx** - Replace raw header + table:
- `PageHeader` with `ClipboardList` icon, description "Manage supplier purchase orders"
- `ResponsiveTable` for order list (dialog form with line items stays as-is since it uses inner Table for editing)

**GoodsReceipts.tsx** - Same pattern:
- `PageHeader` with `PackageCheck` icon, description "Receive and verify incoming goods"
- `ResponsiveTable` with columns: receiptNumber, purchaseOrder, warehouse, date, status, actions

**SupplierInvoices.tsx** - Same pattern:
- `PageHeader` with `FileInput` icon, description "Track and manage supplier invoices"
- `ResponsiveTable` with columns: invoiceNumber, supplier, purchaseOrder, invoiceDate (hideOnMobile), dueDate (hideOnMobile), total, match, status, actions

### Inventory Module (2 pages)

**Products.tsx** - Replace raw header + search + table:
- `PageHeader` with `Package` icon, actions slot with ExportButton + Add button
- `MobileFilterBar` with search input
- `ResponsiveTable` with columns: name (primary, linked), sku, unitOfMeasure, costingMethod, purchasePrice, salePrice, status, actions

**InventoryStock.tsx** - Replace raw header + filters:
- `PageHeader` with `Warehouse` icon, actions slot with ExportButton
- `MobileFilterBar` with search input and warehouse Select + lowStockOnly checkbox as filters
- `ResponsiveTable` with columns (dense financial data stays as horizontal-scroll table since it has 10 columns)

### HR Module (1 page)

**Employees.tsx** - Replace raw header + table:
- `PageHeader` with `Users` icon, description "Manage your workforce"
- `MobileFilterBar` with archived checkbox + ExportButton + Add button as actions
- `ResponsiveTable` with columns: fullName (primary, clickable), position, department, location (hideOnMobile), employmentType (hideOnMobile), hireDate, status, actions

### Accounting (1 remaining)

**Expenses.tsx** - Already has PageHeader + StatsBar but uses raw Table and raw filter divs:
- Wrap filters in `MobileFilterBar`
- Replace raw `<Table>` with `ResponsiveTable`

## Dashboard Upgrades (3 pages)

**CrmDashboard.tsx** - Wrap in `BiPageLayout`:
- Move existing `PageHeader` and `StatsBar` props into `BiPageLayout` props
- Children stay the same (charts + widgets)

**AnalyticsDashboard.tsx** - Same BiPageLayout wrap:
- Pass stats array to BiPageLayout
- Add `BarChart3` icon

**WmsDashboard.tsx** - Already uses PageHeader but wrap in BiPageLayout for consistency

## Settings Page Enhancement

**Settings.tsx** - Add PageHeader + group settings:
- `PageHeader` with `Settings` icon, description "Configure your company settings"
- Group settings into sections: "Organization" (legal entities, locations, warehouses, cost centers), "Finance" (bank accounts, tax rates, posting rules, accounting architecture), "Operations" (users, integrations, business rules, sales channels, web)
- Each section gets a small heading label
- Keep NotificationPreferences at the bottom

## Execution

All changes follow the exact same mechanical pattern:
1. Import `PageHeader`, `ResponsiveTable`, `MobileFilterBar` from shared components
2. Replace `<h1>` with `<PageHeader>` (add icon + description + actions)
3. Replace `<Table>` with `<ResponsiveTable>` (define columns array with render functions)
4. Wrap loose filter elements in `<MobileFilterBar>`
5. Remove unused Table/TableBody/etc imports

Total files: 12 (Quotes, SalesOrders, PurchaseOrders, GoodsReceipts, SupplierInvoices, Products, InventoryStock, Employees, Expenses, CrmDashboard, AnalyticsDashboard, Settings)



# Phase 1: Navigation & Quick Fixes

This phase fixes all orphaned routes, dead links, wrong module tags, and missing breadcrumb labels. No database changes needed — purely frontend navigation fixes.

## Changes

### 1. Fix GlobalSearch dead link and wrong module tags
**File: `src/components/layout/GlobalSearch.tsx`**
- Line 57: Change path `/sales/retail-prices` → `/inventory/retail-prices`
- Lines 104-110: Change `module: "accounting"` → `module: "analytics"` for all 7 analytics items

### 2. Fix CRM sidebar partners link
**File: `src/layouts/TenantLayout.tsx`**
- Line 148 (`crmNav`): Change `url: "/crm/companies"` → `url: "/crm/partners"`

### 3. Add orphaned accounting pages to sidebar
**File: `src/layouts/TenantLayout.tsx`** — add to `accountingNav`:
- `{ key: "bankAccounts", url: "/accounting/bank-accounts", icon: Landmark, section: "bookkeeping" }` (after ledger)
- `{ key: "documentImport", url: "/accounting/document-import", icon: FileInput }` (after bank-statements)
- `{ key: "invoiceRegister", url: "/accounting/invoice-register", icon: FileText }` (after pdvPeriods in taxClosing)

### 4. Add 6 orphaned production pages to sidebar
**File: `src/layouts/TenantLayout.tsx`** — add to `productionNav`:
- `{ key: "productionKanban", url: "/production/kanban", icon: LayoutDashboard, section: "shopFloor" }`
- `{ key: "productionGantt", url: "/production/gantt", icon: CalendarDays }`
- `{ key: "qualityControl", url: "/production/quality", icon: ClipboardCheck }`
- `{ key: "productionMaintenance", url: "/production/maintenance", icon: Settings }`
- `{ key: "mrpEngine", url: "/production/mrp", icon: Calculator, section: "planning" }`
- `{ key: "costVarianceAnalysis", url: "/production/cost-variance", icon: TrendingDown, section: "reporting" }`

### 5. Add WMS labor + returns to sidebar
**File: `src/layouts/TenantLayout.tsx`** — add to `inventoryNav` after wmsSlotting:
- `{ key: "wmsLabor", url: "/inventory/wms/labor", icon: UserCheck }`
- `{ key: "wmsReturns", url: "/inventory/wms/returns", icon: RotateCcw }`

### 6. Add HR work-logs/bulk and calendar to sidebar
**File: `src/layouts/TenantLayout.tsx`** — add to `hrNav` after workLogs:
- `{ key: "workLogsBulk", url: "/hr/work-logs/bulk", icon: ClipboardCheck }`
- `{ key: "workLogsCalendar", url: "/hr/work-logs/calendar", icon: Calendar }`

### 7. Add documents/settings to sidebar
**File: `src/layouts/TenantLayout.tsx`** — add to `documentsNav`:
- `{ key: "dmsSettings", url: "/documents/settings", icon: Settings, section: "dmsConfiguration" }`

### 8. Add ~25 missing breadcrumb labels
**File: `src/components/layout/Breadcrumbs.tsx`** — add to `routeLabels`:
- Accounting: `compliance`, `"cash-flow-statement"`, `"statisticki-aneks"`, `"kpo-book"`, `"report-snapshots"`, `intercompany`, `"transfer-pricing"`, `ios`, `"credit-debit-notes"`, `"proforma-invoices"`, `"recurring-invoices"`, `"recurring-journals"`, `"invoice-register"`, `"document-import"`
- Analytics: `"early-warning"`, `"vat-trap"`, `"supplier-risk"`, `"customer-risk"`, `"margin-bridge"`, `"inventory-health"`, `"payroll-benchmark"`, `"working-capital"`, `"break-even"`, `planning`
- HR: `"non-employment-income"`, `pppd`
- Production: `kanban`, `gantt`, `quality`, `"cost-variance"`, `mrp`, `maintenance`
- WMS: `labor`

### 9. Remove dead settings permission check
**File: `src/layouts/TenantLayout.tsx`** — line 451: `business-rules` is checked in the filter but not in `settingsNav` array. Add it to `settingsNav`:
- `{ key: "businessRules", url: "/settings/business-rules", icon: FileText, section: "system" }`

### Summary
- **Files modified:** 3 (`TenantLayout.tsx`, `GlobalSearch.tsx`, `Breadcrumbs.tsx`)
- **No database changes**
- **No new components**

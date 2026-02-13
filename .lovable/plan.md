

# Fix Broken Links, Reorder Sidebar, and Polish UX

## Overview

The main issue is a broken link on the Settings hub page pointing to `/settings/sales-channels` (which has no route -- the actual route is `/sales/sales-channels`). Beyond that, the sidebar group ordering can be improved for a more logical workflow, and several breadcrumb labels are missing for newer pages.

---

## 1. Fix Broken Sales Channels Link

**File**: `src/pages/tenant/Settings.tsx`

The Settings hub page links to `/settings/sales-channels` but there is no such route in `App.tsx`. The actual Sales Channels page lives at `/sales/sales-channels`. Fix the link to point to the correct route.

Change line 16:
- From: `{ label: t("salesChannels"), icon: ShoppingBag, to: "/settings/sales-channels" }`
- To: `{ label: t("salesChannels"), icon: ShoppingBag, to: "/sales/sales-channels" }`

---

## 2. Reorder Sidebar Groups for Logical Flow

**File**: `src/layouts/TenantLayout.tsx`

Current order: Dashboard, CRM, Sales, Web, Purchasing, Returns, HR, Inventory, Accounting, Production, Documents, POS

Proposed order (groups related modules together):

1. **Dashboard** -- entry point
2. **CRM** -- customer-facing start of workflow
3. **Sales** -- quotes, orders, channels (flows from CRM)
4. **Purchasing** -- procurement (counterpart to sales)
5. **Inventory** -- stock management (receives from purchasing, ships from sales)
6. **Production** -- manufacturing (consumes inventory)
7. **Accounting** -- financial backbone
8. **HR** -- workforce management
9. **POS** -- retail operations
10. **Web Sales** -- e-commerce (specialized sales channel)
11. **Documents** -- document management (cross-cutting)
12. **Returns** -- exception handling (last)
13. **Settings** (footer, unchanged)

This follows the natural business flow: acquire customers -> sell -> buy materials -> manage stock -> produce -> account -> manage people.

---

## 3. Add Missing Breadcrumb Labels

**File**: `src/components/layout/Breadcrumbs.tsx`

Add labels for routes that are missing from the `routeLabels` map:

- `"posting-rules"`: `"postingRules"`
- `"fx-revaluation"`: `"fxRevaluation"`
- `"kompenzacija"`: `"kompenzacija"`
- `"cost-layers"`: `"costLayers"`
- `"internal-orders"`: `"internalOrders"`
- `"internal-transfers"`: `"internalTransfers"`
- `"internal-receipts"`: `"internalReceipts"`
- `"kalkulacija"`: `"kalkulacija"`
- `"nivelacija"`: `"nivelacija"`
- `"dispatch-notes"`: `"dispatchNotes"`
- `"wms"`: `"inventory"` (parent segment)
- `"zones"`: `"wmsZones"`
- `"tasks"`: `"wmsTasks"`
- `"receiving"`: `"wmsReceiving"`
- `"picking"`: `"wmsPicking"`
- `"cycle-counts"`: `"wmsCycleCounts"`
- `"slotting"`: `"wmsSlotting"`
- `"work-logs"`: `"workLogs"`
- `"overtime"`: `"overtimeHours"`
- `"night-work"`: `"nightWork"`
- `"annual-leave"`: `"annualLeaveBalance"`
- `"holidays"`: `"holidays"`
- `"deductions"`: `"deductionsModule"`
- `"allowances"`: `"allowance"`
- `"salaries"`: `"salaryHistory"`
- `"external-workers"`: `"externalWorkers"`
- `"insurance"`: `"insuranceRecords"`
- `"position-templates"`: `"positionTemplates"`
- `"ebolovanje"`: `"eBolovanje"`
- `"salespeople"`: `"salespeople"`
- `"sales-performance"`: `"salesPerformance"`
- `"retail-prices"`: `"retailPrices"`
- `"fiscal-devices"`: `"fiscalDevices"`
- `"daily-report"`: `"dailyReport"`
- `"pending-approvals"`: `"pendingApprovalsPage"`
- `"sales"`: `"salesModule"`
- `"web"`: `"webSales"`
- `"bulk"`: `"bulkEntry"`
- `"calendar"`: `"calendar"`
- `"bins"`: `"wmsBins"`

---

## 4. Improve Sidebar Accent Colors

**File**: `src/layouts/TenantLayout.tsx`

Assign more distinct, visually harmonious accent colors that better differentiate groups:

| Group | Current | Proposed |
|-------|---------|----------|
| CRM | blue-400 | blue-500 |
| Sales | orange-400 | amber-500 |
| Purchasing | orange-400 (duplicate!) | violet-500 |
| Returns | red-400 | rose-400 |
| HR | violet-400 | purple-500 |
| Inventory | amber-400 | yellow-500 |
| Accounting | emerald-400 | emerald-500 |
| Production | cyan-400 | cyan-500 |
| Documents | pink-400 | pink-500 |
| POS | teal-400 | teal-500 |
| Web | indigo-400 | indigo-500 |
| Settings | gray-400 | slate-400 |

Key fix: Purchasing and Sales currently share `orange-400`. They will get distinct colors.

---

## Technical Details

### Files Modified

1. **`src/pages/tenant/Settings.tsx`** -- Fix broken `/settings/sales-channels` link to `/sales/sales-channels`
2. **`src/layouts/TenantLayout.tsx`** -- Reorder sidebar groups; update accent colors
3. **`src/components/layout/Breadcrumbs.tsx`** -- Add ~30 missing breadcrumb labels

### No Files Deleted

The `SalesChannels` page at `src/pages/tenant/SalesChannels.tsx` is actively used by the `/sales/sales-channels` route. No pages need deletion -- the issue was a stale link, not an orphaned page.

### No Database Changes Required



# Codebase Review: Issues Found and Next Steps

## Issues Found

### 1. Bug: Wrong Navigation Path on Dashboard
**File**: `src/pages/tenant/Dashboard.tsx`, line 243

The "Pending Approvals" action button navigates to `/accounting/approval-workflows` -- this route does not exist. The correct route is `/settings/pending-approvals`.

**Fix**: Change `navigate("/accounting/approval-workflows")` to `navigate("/settings/pending-approvals")`.

---

### 2. Missing Sidebar Item: Attendance
**File**: `src/layouts/TenantLayout.tsx`

The route `/hr/attendance` exists in `App.tsx` (line 222) and the `Attendance` page component exists, but there is no entry in the `hrNav` array in the sidebar. Users can only reach it by typing the URL directly.

**Fix**: Add `{ key: "attendance", url: "/hr/attendance", icon: Clock }` to the `hrNav` array (after `leaveRequests` or near `workLogs`).

---

### 3. Stale Global Search Paths
**File**: `src/components/layout/GlobalSearch.tsx`, lines 44-45

Two search items point to wrong paths under `/crm/`:
- `Quotes` points to `/crm/quotes` -- actual route is `/sales/quotes`
- `Sales Orders` points to `/crm/sales-orders` -- actual route is `/sales/sales-orders`

Additionally, the Global Search is missing most pages. It only indexes ~20 items out of 100+ routes. Key missing entries include:
- All WMS pages, Inventory sub-pages (kalkulacija, nivelacija, cost-layers, etc.)
- All Accounting sub-pages (bank-statements, open-items, PDV, fixed-assets, deferrals, loans, etc.)
- All HR sub-pages (work-logs, overtime, night-work, annual-leave, deductions, allowances, etc.)
- All POS sub-pages (sessions, fiscal-devices, daily-report)
- All Sales sub-pages (salespeople, sales-performance, retail-prices, sales-channels)
- Web Sales pages
- Documents sub-pages

**Fix**: Expand the `items` array to cover all routable pages, grouped by module.

---

### 4. Missing Translation Key: "bulkEntry"
**File**: `src/i18n/translations.ts`

The breadcrumb label for the "bulk" route segment maps to `"bulkEntry"`, but this key likely needs verification that it exists in the translations file.

**Fix**: Verify and add `bulkEntry` and `calendar` translation keys if missing.

---

## Summary of Fixes

| # | Issue | File | Severity |
|---|-------|------|----------|
| 1 | Pending approvals navigates to non-existent route | Dashboard.tsx | Bug |
| 2 | Attendance page not in sidebar | TenantLayout.tsx | Missing feature |
| 3 | Quotes/Sales Orders search paths wrong + most pages missing from search | GlobalSearch.tsx | Bug + Gap |
| 4 | Possibly missing translation keys | translations.ts | Minor |

---

## Proposed Next Steps (Priority Order)

1. **Fix the 4 issues above** -- bugs and missing items
2. **Dark mode toggle** -- the app imports `next-themes` but doesn't appear to use it; add a theme toggle to the user dropdown
3. **Mobile responsiveness audit** -- sidebar behavior on small screens
4. **Loading states** -- add skeleton loaders to dashboard KPI cards and charts while data loads
5. **Error boundaries** -- wrap module sections with error boundaries so one failing module doesn't crash the whole app

---

## Technical Details

### File Changes Required

**`src/pages/tenant/Dashboard.tsx`** (1 line):
- Line 243: Change `"/accounting/approval-workflows"` to `"/settings/pending-approvals"`

**`src/layouts/TenantLayout.tsx`** (1 addition):
- Add to `hrNav` array: `{ key: "attendance", url: "/hr/attendance", icon: Clock }`

**`src/components/layout/GlobalSearch.tsx`** (major expansion):
- Fix 2 wrong paths (quotes, sales-orders)
- Add ~60 missing search entries covering all modules: Sales (6 items), Purchasing (3), Inventory (16 including WMS), Accounting (12), HR (17), POS (4), Web (2), Documents (7), Settings (8)

**`src/i18n/translations.ts`** (verify/add):
- Ensure `bulkEntry` and `calendar` keys exist in both `en` and `sr` objects

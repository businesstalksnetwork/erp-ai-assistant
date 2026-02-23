

## Make KPI Cards Clickable + AI Insights Navigate with Filters

### 1. Clickable KPI Cards on Dashboard

**File:** `src/pages/tenant/Dashboard.tsx`

Add an `onClick` + `cursor-pointer` to each KPI card so they navigate to the relevant module page:

| KPI Card | Navigates To |
|----------|-------------|
| PRIHODI (Revenue) | `/analytics` |
| RASHODI (Expenses) | `/analytics` |
| PROFIT | `/analytics` |
| STANJE GOTOVINE (Cash Balance) | `/accounting/invoices?filter=paid` |

Each card gets a `route` property in the `kpis` array and an `onClick={() => navigate(route)}` on the Card.

### 2. AI Insights Navigate with Filter Query Params

Both `AiInsightsWidget` and `AiModuleInsights` currently navigate to plain routes (e.g., `/accounting/invoices`). Update the route maps to include query parameters that pre-set the relevant filter on the target page.

**Updated route maps (both components):**

| Insight Type | Current Route | New Route |
|-------------|--------------|-----------|
| `overdue_invoices` | `/accounting/invoices` | `/accounting/invoices?filter=overdue` |
| `large_invoices` | `/accounting/invoices` | `/accounting/invoices?filter=sent` |
| `zero_stock` | `/inventory/stock` | `/inventory/stock?filter=zero_stock` |
| `low_stock` | `/inventory/stock` | `/inventory/stock?filter=low_stock` |
| `draft_journals` | `/accounting/journal` | `/accounting/journal?filter=draft` |
| `stale_leads` | `/crm/leads` | `/crm/leads?filter=novi` |
| `high_value_at_risk` | `/crm/opportunities` | `/crm/opportunities?filter=at_risk` |
| `expense_spike` | `/analytics/expenses` | `/analytics/expenses` (no change) |
| `duplicate_invoices` | `/purchasing/invoices` | `/purchasing/invoices` (no change) |
| `weekend_postings` | `/accounting/journal` | `/accounting/journal` (no change) |
| `dormant_accounts` | `/crm/companies` | `/crm/companies` (no change) |
| `at_risk_accounts` | `/crm/companies` | `/crm/companies` (no change) |

### 3. Target Pages Read URL Filter Param

Update pages to initialize their filter state from URL search params using `useSearchParams`:

#### `src/pages/tenant/Invoices.tsx`
- Import `useSearchParams` from `react-router-dom`
- Initialize `statusFilter` from `searchParams.get("filter") || "all"`
- When "overdue" filter is set, add special handling: filter for invoices where `status` is "draft" or "sent" AND `due_date < today`

#### `src/pages/tenant/InventoryStock.tsx`
- Import `useSearchParams`
- Read `filter` param: if `"low_stock"` set `lowStockOnly = true`; if `"zero_stock"` add a `zeroStockOnly` state and filter for `quantity_on_hand <= 0`

#### `src/pages/tenant/JournalEntries.tsx`
- Import `useSearchParams`
- Read `filter` param and add a `statusFilter` state initialized from it (currently has no status filter)
- Filter entries by `status === "draft"` when `filter=draft`

#### `src/pages/tenant/Leads.tsx`
- Import `useSearchParams`
- Initialize `statusFilter` from `searchParams.get("filter") || "all"`
- The "novi" value maps directly to the existing status filter

#### `src/pages/tenant/Opportunities.tsx`
- Import `useSearchParams`
- Add a stage/risk filter: when `filter=at_risk`, filter to show only opportunities with high value and low probability (or specific at-risk stages)

### Files Changed

| File | Change |
|------|--------|
| `src/pages/tenant/Dashboard.tsx` | Make KPI cards clickable with navigation |
| `src/components/ai/AiInsightsWidget.tsx` | Add query params to route map |
| `src/components/shared/AiModuleInsights.tsx` | Add query params to route map |
| `src/pages/tenant/Invoices.tsx` | Read `?filter=` from URL, initialize statusFilter, handle "overdue" |
| `src/pages/tenant/InventoryStock.tsx` | Read `?filter=` from URL, handle low_stock/zero_stock |
| `src/pages/tenant/JournalEntries.tsx` | Read `?filter=` from URL, add status filter for "draft" |
| `src/pages/tenant/Leads.tsx` | Read `?filter=` from URL, initialize statusFilter |
| `src/pages/tenant/Opportunities.tsx` | Read `?filter=` from URL, filter at-risk opportunities |

### Technical Pattern

Each target page will add this pattern at the top:

```typescript
import { useSearchParams } from "react-router-dom";

// Inside component:
const [searchParams] = useSearchParams();
const initialFilter = searchParams.get("filter") || "all";
const [statusFilter, setStatusFilter] = useState(initialFilter);
```

This keeps the URL-driven filter as a one-time initialization -- users can then change the filter freely without URL updates, maintaining the existing UX.

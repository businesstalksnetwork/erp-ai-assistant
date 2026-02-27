# PRD: OLAP Pivot Analytics Engine

**Version:** 1.0
**Date:** 2026-02-27
**Status:** Draft
**Estimated Effort:** 25–32h
**Priority:** High — closes last major competitive gap vs SAOP iCenter

---

## 1. Problem Statement

Our ERP currently offers ~15 static reports (Aging, Trial Balance, POPDV, Sales Performance, IFRS statements, etc.) built with hardcoded layouts and fixed dimensions. Users who need ad-hoc analysis must export CSV and pivot in Excel.

SAOP iCenter's OLAP module gives users drag-and-drop multidimensional analysis over all business data. This is their single biggest differentiator vs our system.

**Pain points:**
- Accountants waste 30–60 min/day exporting data to Excel for pivot analysis
- Managers can't self-serve "show me revenue by product category by month by region" without developer involvement
- No drill-down from summary → detail records
- No saved/shared report views across team
- Client-side aggregation in JS hits performance limits beyond ~10k rows

---

## 2. Goals

| Goal | Metric |
|------|--------|
| Enable ad-hoc multidimensional analysis without Excel | Users can create pivot views in < 60 seconds |
| Support all major ERP data domains | ≥ 6 data cubes (GL, Invoices, Purchases, Inventory, Payroll, POS) |
| Handle production-scale data efficiently | < 2s response for 100k-row aggregations |
| Allow saved & shared views | Users can save, load, and share pivot configurations |
| Match existing UX patterns | Consistent with shadcn/ui + Tailwind + ResponsiveTable conventions |

---

## 3. Non-Goals

- Real-time streaming analytics (Supabase Realtime is out of scope for heavy aggregations)
- ML/predictive analytics (future phase)
- Replacing existing static reports (they stay, pivot is additive)
- External BI tool integration (Metabase, Power BI connectors — future)

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PivotBuilder │  │  PivotTable  │  │  PivotChart  │  │
│  │  (config UI)  │  │  (data grid) │  │  (Recharts)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│  ┌──────▼─────────────────▼─────────────────▼────────┐  │
│  │              usePivotQuery hook                    │  │
│  │  - builds SQL dimensions/measures from config     │  │
│  │  - calls RPC with dynamic params                  │  │
│  │  - caches via React Query                         │  │
│  └──────────────────────┬────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   Supabase Layer                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  pivot_query(p_cube, p_dimensions[], p_measures[], │  │
│  │             p_filters jsonb, p_tenant_id,          │  │
│  │             p_limit, p_offset)                     │  │
│  │                                                    │  │
│  │  → Dynamically builds GROUP BY query               │  │
│  │  → Returns { rows: jsonb[], total_count: int }     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  pivot_saved_views table                           │  │
│  │  (user_id, tenant_id, name, cube, config_json)     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Cube definitions (SQL views or materialized)      │  │
│  │  • v_cube_gl_entries                               │  │
│  │  • v_cube_invoices                                 │  │
│  │  • v_cube_purchases                                │  │
│  │  • v_cube_inventory_movements                      │  │
│  │  • v_cube_payroll                                  │  │
│  │  • v_cube_pos_transactions                         │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Data Cubes

Each cube is a denormalized SQL view that joins fact + dimension tables and exposes clean column names for the pivot engine.

### 5.1 GL Entries Cube (`v_cube_gl_entries`)

**Source:** `journal_lines` JOIN `journal_entries` JOIN `chart_of_accounts` JOIN `fiscal_periods`

| Column | Type | Role | Description |
|--------|------|------|-------------|
| `entry_date` | date | dimension | Journal entry date |
| `year` | int | dimension | Extracted year |
| `month` | int | dimension | Extracted month (1-12) |
| `quarter` | text | dimension | Q1/Q2/Q3/Q4 |
| `account_code` | text | dimension | Account code (e.g., 5410) |
| `account_name` | text | dimension | Account name |
| `account_class` | text | dimension | Class 0-9 |
| `account_group` | text | dimension | First 2 digits |
| `cost_center` | text | dimension | Cost center if tracked |
| `description` | text | dimension | Line description |
| `debit` | numeric | measure | Debit amount |
| `credit` | numeric | measure | Credit amount |
| `balance` | numeric | measure | debit - credit |

**Sample questions this cube answers:**
- Expenses by account class by month
- Revenue by cost center by quarter
- Trial balance drill-down by account group → individual accounts
- Year-over-year comparison by account

### 5.2 Invoices Cube (`v_cube_invoices`)

**Source:** `invoice_lines` JOIN `invoices` JOIN `partners` JOIN `products` JOIN `employees` (salesperson)

| Column | Type | Role |
|--------|------|------|
| `invoice_date` | date | dimension |
| `year`, `month`, `quarter` | int/text | dimension |
| `invoice_type` | text | dimension (sales/purchase) |
| `status` | text | dimension (draft/sent/paid/overdue) |
| `partner_name` | text | dimension |
| `partner_city` | text | dimension |
| `partner_type` | text | dimension (customer/supplier) |
| `product_name` | text | dimension |
| `product_category` | text | dimension |
| `salesperson` | text | dimension |
| `currency` | text | dimension |
| `quantity` | numeric | measure |
| `unit_price` | numeric | measure |
| `line_total` | numeric | measure |
| `tax_amount` | numeric | measure |
| `discount_amount` | numeric | measure |

**Sample questions:**
- Revenue by customer by product category by month
- Average invoice value by salesperson by quarter
- Discount analysis by product category
- Top 20 customers by revenue with monthly trend

### 5.3 Purchases Cube (`v_cube_purchases`)

**Source:** `supplier_invoice_lines` JOIN `supplier_invoices` JOIN `partners` JOIN `products`

| Column | Type | Role |
|--------|------|------|
| `invoice_date` | date | dimension |
| `year`, `month`, `quarter` | int/text | dimension |
| `supplier_name` | text | dimension |
| `supplier_city` | text | dimension |
| `product_name` | text | dimension |
| `product_category` | text | dimension |
| `warehouse` | text | dimension |
| `quantity` | numeric | measure |
| `unit_cost` | numeric | measure |
| `line_total` | numeric | measure |
| `tax_amount` | numeric | measure |

### 5.4 Inventory Movements Cube (`v_cube_inventory_movements`)

**Source:** `inventory_movements` JOIN `products` JOIN `warehouses`

| Column | Type | Role |
|--------|------|------|
| `movement_date` | date | dimension |
| `year`, `month` | int | dimension |
| `movement_type` | text | dimension (receipt/issue/transfer/adjustment) |
| `product_name` | text | dimension |
| `product_category` | text | dimension |
| `warehouse_name` | text | dimension |
| `quantity` | numeric | measure |
| `unit_cost` | numeric | measure |
| `total_value` | numeric | measure |

### 5.5 Payroll Cube (`v_cube_payroll`)

**Source:** `payroll_items` JOIN `payroll_runs` JOIN `employees` JOIN `departments`

| Column | Type | Role |
|--------|------|------|
| `pay_period` | date | dimension |
| `year`, `month` | int | dimension |
| `employee_name` | text | dimension |
| `department` | text | dimension |
| `position` | text | dimension |
| `item_type` | text | dimension (gross/tax/contribution/net/bonus/deduction) |
| `amount` | numeric | measure |
| `hours` | numeric | measure |

### 5.6 POS Transactions Cube (`v_cube_pos_transactions`)

**Source:** `pos_transaction_items` JOIN `pos_transactions` JOIN `pos_sessions` JOIN `products` JOIN `employees` (cashier)

| Column | Type | Role |
|--------|------|------|
| `transaction_date` | date | dimension |
| `year`, `month`, `day_of_week` | int/text | dimension |
| `hour_of_day` | int | dimension |
| `cashier_name` | text | dimension |
| `store_location` | text | dimension |
| `product_name` | text | dimension |
| `product_category` | text | dimension |
| `payment_method` | text | dimension (cash/card/mixed) |
| `receipt_type` | text | dimension (sale/refund) |
| `quantity` | numeric | measure |
| `unit_price` | numeric | measure |
| `line_total` | numeric | measure |
| `discount` | numeric | measure |
| `tax_amount` | numeric | measure |

---

## 6. Server-Side Pivot RPC

### 6.1 `pivot_query` — Dynamic aggregation function

```sql
CREATE OR REPLACE FUNCTION public.pivot_query(
  p_tenant_id   UUID,
  p_cube        TEXT,            -- 'gl_entries' | 'invoices' | 'purchases' | 'inventory' | 'payroll' | 'pos'
  p_rows        TEXT[],          -- dimension columns for GROUP BY rows
  p_columns     TEXT[] DEFAULT '{}',  -- dimension column for pivot columns (max 1)
  p_measures    JSONB,           -- [{"col":"line_total","agg":"sum","alias":"total"}, ...]
  p_filters     JSONB DEFAULT '{}',   -- {"status": ["paid","sent"], "year": [2026]}
  p_sort_by     TEXT DEFAULT NULL,
  p_sort_dir    TEXT DEFAULT 'desc',
  p_limit       INT DEFAULT 1000,
  p_offset      INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_view TEXT;
  v_allowed_views TEXT[] := ARRAY[
    'v_cube_gl_entries','v_cube_invoices','v_cube_purchases',
    'v_cube_inventory_movements','v_cube_payroll','v_cube_pos_transactions'
  ];
  v_select   TEXT := '';
  v_group    TEXT := '';
  v_where    TEXT := format('WHERE tenant_id = %L', p_tenant_id);
  v_order    TEXT := '';
  v_sql      TEXT;
  v_result   JSONB;
  v_count    BIGINT;
  v_measure  JSONB;
  v_col      TEXT;
  v_agg      TEXT;
  v_alias    TEXT;
  v_key      TEXT;
  v_vals     JSONB;
BEGIN
  -- Validate cube name (prevent injection)
  v_view := 'v_cube_' || p_cube;
  IF NOT v_view = ANY(v_allowed_views) THEN
    RAISE EXCEPTION 'Invalid cube: %', p_cube;
  END IF;

  -- Build SELECT: row dimensions
  FOR i IN 1..array_length(p_rows, 1) LOOP
    IF i > 1 THEN v_select := v_select || ', '; v_group := v_group || ', '; END IF;
    v_select := v_select || quote_ident(p_rows[i]);
    v_group := v_group || quote_ident(p_rows[i]);
  END LOOP;

  -- Build SELECT: measures with aggregations
  FOR v_measure IN SELECT * FROM jsonb_array_elements(p_measures) LOOP
    v_col   := v_measure->>'col';
    v_agg   := COALESCE(v_measure->>'agg', 'sum');
    v_alias := COALESCE(v_measure->>'alias', v_col || '_' || v_agg);

    -- Validate aggregation function
    IF v_agg NOT IN ('sum','avg','count','min','max','count_distinct') THEN
      RAISE EXCEPTION 'Invalid aggregation: %', v_agg;
    END IF;

    IF v_agg = 'count_distinct' THEN
      v_select := v_select || format(', COUNT(DISTINCT %I) AS %I', v_col, v_alias);
    ELSE
      v_select := v_select || format(', %s(%I) AS %I', v_agg, v_col, v_alias);
    END IF;
  END LOOP;

  -- Build WHERE: filters
  FOR v_key IN SELECT * FROM jsonb_object_keys(p_filters) LOOP
    v_vals := p_filters -> v_key;
    IF jsonb_typeof(v_vals) = 'array' AND jsonb_array_length(v_vals) > 0 THEN
      v_where := v_where || format(' AND %I = ANY(ARRAY(SELECT jsonb_array_elements_text(%L::jsonb)))', v_key, v_vals::text);
    END IF;
  END LOOP;

  -- Build ORDER BY
  IF p_sort_by IS NOT NULL THEN
    v_order := format('ORDER BY %I %s NULLS LAST', p_sort_by,
      CASE WHEN p_sort_dir = 'asc' THEN 'ASC' ELSE 'DESC' END);
  ELSE
    v_order := 'ORDER BY 1';
  END IF;

  -- Execute count query
  v_sql := format('SELECT COUNT(*) FROM (SELECT %s FROM %I %s GROUP BY %s) sub',
    v_select, v_view, v_where, v_group);
  EXECUTE v_sql INTO v_count;

  -- Execute data query
  v_sql := format('SELECT jsonb_agg(row_to_json(sub)) FROM (SELECT %s FROM %I %s GROUP BY %s %s LIMIT %s OFFSET %s) sub',
    v_select, v_view, v_where, v_group, v_order, p_limit, p_offset);
  EXECUTE v_sql INTO v_result;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_result, '[]'::jsonb),
    'total_count', v_count,
    'cube', p_cube,
    'dimensions', to_jsonb(p_rows),
    'offset', p_offset,
    'limit', p_limit
  );
END;
$$;
```

### 6.2 `get_cube_metadata` — Returns available dimensions & measures per cube

```sql
CREATE OR REPLACE FUNCTION public.get_cube_metadata(p_cube TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN CASE p_cube
    WHEN 'gl_entries' THEN '{
      "dimensions": ["entry_date","year","month","quarter","account_code","account_name","account_class","account_group","cost_center"],
      "measures": [
        {"col":"debit","label":"Duguje","aggs":["sum","avg","count"]},
        {"col":"credit","label":"Potražuje","aggs":["sum","avg","count"]},
        {"col":"balance","label":"Saldo","aggs":["sum","avg"]}
      ],
      "default_rows": ["account_class","account_group"],
      "default_measure": {"col":"balance","agg":"sum","alias":"saldo"}
    }'::jsonb
    WHEN 'invoices' THEN '{
      "dimensions": ["invoice_date","year","month","quarter","invoice_type","status","partner_name","partner_city","product_name","product_category","salesperson","currency"],
      "measures": [
        {"col":"line_total","label":"Iznos","aggs":["sum","avg","min","max","count"]},
        {"col":"quantity","label":"Količina","aggs":["sum","avg"]},
        {"col":"tax_amount","label":"PDV","aggs":["sum"]},
        {"col":"discount_amount","label":"Popust","aggs":["sum","avg"]}
      ],
      "default_rows": ["partner_name"],
      "default_measure": {"col":"line_total","agg":"sum","alias":"ukupno"}
    }'::jsonb
    WHEN 'purchases' THEN '{
      "dimensions": ["invoice_date","year","month","quarter","supplier_name","supplier_city","product_name","product_category","warehouse"],
      "measures": [
        {"col":"line_total","label":"Iznos","aggs":["sum","avg","count"]},
        {"col":"quantity","label":"Količina","aggs":["sum","avg"]},
        {"col":"tax_amount","label":"PDV","aggs":["sum"]}
      ],
      "default_rows": ["supplier_name"],
      "default_measure": {"col":"line_total","agg":"sum","alias":"ukupno"}
    }'::jsonb
    WHEN 'inventory' THEN '{
      "dimensions": ["movement_date","year","month","movement_type","product_name","product_category","warehouse_name"],
      "measures": [
        {"col":"quantity","label":"Količina","aggs":["sum","avg","count"]},
        {"col":"total_value","label":"Vrednost","aggs":["sum","avg"]}
      ],
      "default_rows": ["product_name","warehouse_name"],
      "default_measure": {"col":"quantity","agg":"sum","alias":"kolicina"}
    }'::jsonb
    WHEN 'payroll' THEN '{
      "dimensions": ["pay_period","year","month","employee_name","department","position","item_type"],
      "measures": [
        {"col":"amount","label":"Iznos","aggs":["sum","avg","min","max"]},
        {"col":"hours","label":"Sati","aggs":["sum","avg"]}
      ],
      "default_rows": ["department","employee_name"],
      "default_measure": {"col":"amount","agg":"sum","alias":"iznos"}
    }'::jsonb
    WHEN 'pos' THEN '{
      "dimensions": ["transaction_date","year","month","day_of_week","hour_of_day","cashier_name","store_location","product_name","product_category","payment_method","receipt_type"],
      "measures": [
        {"col":"line_total","label":"Iznos","aggs":["sum","avg","count"]},
        {"col":"quantity","label":"Količina","aggs":["sum","avg"]},
        {"col":"discount","label":"Popust","aggs":["sum","avg"]},
        {"col":"tax_amount","label":"PDV","aggs":["sum"]}
      ],
      "default_rows": ["product_category"],
      "default_measure": {"col":"line_total","agg":"sum","alias":"promet"}
    }'::jsonb
    ELSE '{}'::jsonb
  END;
END;
$$;
```

---

## 7. Database Schema

### 7.1 Saved Views Table

```sql
CREATE TABLE public.pivot_saved_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  cube          TEXT NOT NULL,
  config_json   JSONB NOT NULL DEFAULT '{}',
  -- config_json shape:
  -- {
  --   "rows": ["partner_name","month"],
  --   "columns": [],
  --   "measures": [{"col":"line_total","agg":"sum","alias":"total"}],
  --   "filters": {"year":[2026],"status":["paid"]},
  --   "sort_by": "total",
  --   "sort_dir": "desc",
  --   "chart_type": "bar" | "line" | "pie" | null,
  --   "limit": 100
  -- }
  is_shared     BOOLEAN NOT NULL DEFAULT false,
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_pivot_view_name UNIQUE (tenant_id, user_id, name)
);

-- RLS
ALTER TABLE public.pivot_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own + shared views"
  ON public.pivot_saved_views FOR SELECT
  USING (
    user_id = auth.uid()
    OR (is_shared = true AND tenant_id = (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1
    ))
  );

CREATE POLICY "Users manage own views"
  ON public.pivot_saved_views FOR ALL
  USING (user_id = auth.uid());
```

### 7.2 Index Strategy

```sql
-- Cube view indexes (on source tables, not views)
CREATE INDEX IF NOT EXISTS idx_journal_lines_tenant_date
  ON journal_lines(tenant_id, entry_date) INCLUDE (debit, credit);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_tenant_date
  ON invoice_lines(tenant_id) INCLUDE (quantity, unit_price, line_total);

CREATE INDEX IF NOT EXISTS idx_pos_txn_items_tenant_date
  ON pos_transaction_items(tenant_id, created_at) INCLUDE (quantity, line_total);
```

---

## 8. Frontend Components

### 8.1 Component Tree

```
src/pages/tenant/PivotAnalytics.tsx          ← Main page
├── src/components/analytics/
│   ├── PivotBuilder.tsx                      ← Configuration panel
│   │   ├── CubeSelector.tsx                  ← Dropdown to pick data cube
│   │   ├── DimensionPicker.tsx               ← Drag rows/columns from available dims
│   │   ├── MeasurePicker.tsx                 ← Pick measures + aggregation type
│   │   ├── FilterPanel.tsx                   ← Dynamic filters per dimension
│   │   └── SavedViewManager.tsx              ← Save/load/share views
│   ├── PivotTable.tsx                        ← The results grid
│   │   ├── PivotHeader.tsx                   ← Sortable column headers
│   │   ├── PivotRow.tsx                      ← Data row with drill-down expand
│   │   └── PivotTotals.tsx                   ← Grand total / subtotal rows
│   ├── PivotChart.tsx                        ← Recharts visualization toggle
│   └── PivotExport.tsx                       ← XLSX + CSV export buttons
├── src/hooks/
│   ├── usePivotQuery.ts                      ← RPC caller + React Query cache
│   ├── usePivotConfig.ts                     ← Local state for pivot config
│   └── usePivotSavedViews.ts                 ← CRUD for saved views
```

### 8.2 PivotBuilder — Configuration Panel

**Layout:** Left sidebar (collapsible on mobile) with:

1. **Cube Selector** — Select dropdown: Finansije (GL) | Fakture (Invoices) | Nabavke (Purchases) | Zalihe (Inventory) | Zarade (Payroll) | Maloprodaja (POS)
2. **Row Dimensions** — Drag-and-drop list from available dimensions. User drags "partner_name" + "month" to rows area. Creates hierarchical grouping.
3. **Column Dimension** — Optional single dimension for column pivot (e.g., month as column headers). Limited to 1 dimension to keep table readable.
4. **Measures** — Checkboxes with aggregation type dropdown:
   - ☑ Iznos → SUM / AVG / MIN / MAX / COUNT
   - ☑ Količina → SUM
5. **Filters** — Dynamic filter chips per dimension:
   - Year: `[2025] [2026]` (multi-select chips)
   - Status: `[paid] [sent]` (multi-select)
   - Partner: search + select
6. **Apply Button** — Triggers RPC call

**Mobile:** Builder collapses to a bottom sheet or full-screen modal triggered by a "Konfiguriši" button.

### 8.3 PivotTable — Results Grid

**Features:**
- Sortable columns (click header → toggle asc/desc)
- Expandable row groups for drill-down (click "+" to expand account_class → see account_group → account_code)
- Subtotal rows at each group level
- Grand total row at bottom
- Number formatting: `fmtNumAuto` for amounts, `fmtNumCompact` on mobile
- Sticky first column + header
- Horizontal scroll for many columns
- Zebra striping + hover highlight
- Color coding: negative values in red, positive in green (optional toggle)

**Pagination:**
- Server-side via `p_limit` / `p_offset` on the RPC
- "Load more" button or page controls
- Default 100 rows, expandable to 500 / 1000 / All

### 8.4 PivotChart — Visualization

**Toggle between table and chart view (or split view).**

Chart types based on dimensions:
- **1 dimension + 1 measure** → Bar chart (horizontal or vertical)
- **1 dimension + time as column** → Line chart (trend)
- **1 dimension + 1 measure (few values)** → Pie / Donut chart
- **2 dimensions + 1 measure** → Grouped bar chart or heatmap

Uses existing Recharts library. Matches dashboard widget styling.

### 8.5 PivotExport

**Export buttons in toolbar:**
- **CSV** — Via existing `exportCsv.ts` utility (already has UTF-8 BOM support)
- **XLSX** — Via installed `xlsx` package (^0.18.5, currently unused). Multi-sheet export: data sheet + summary sheet. Auto-column-width. Number formatting preserved.
- **PDF** — Future phase (not in v1)

---

## 9. Hook Specifications

### 9.1 `usePivotQuery`

```typescript
interface PivotQueryParams {
  cube: string;
  rows: string[];
  columns?: string[];
  measures: { col: string; agg: string; alias: string }[];
  filters: Record<string, string[]>;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

interface PivotQueryResult {
  rows: Record<string, any>[];
  totalCount: number;
  cube: string;
  dimensions: string[];
}

function usePivotQuery(params: PivotQueryParams | null) {
  // Returns useQuery result with:
  // - queryKey: ["pivot-query", cube, ...rows, ...measures, filters, sort, limit, offset]
  // - queryFn: calls supabase.rpc("pivot_query", ...)
  // - staleTime: 60s (data changes less frequently in analytics)
  // - enabled: params !== null && !!tenantId
}
```

### 9.2 `usePivotConfig`

```typescript
interface PivotConfig {
  cube: string;
  rows: string[];
  columns: string[];
  measures: { col: string; agg: string; alias: string }[];
  filters: Record<string, string[]>;
  sortBy: string | null;
  sortDir: "asc" | "desc";
  chartType: "bar" | "line" | "pie" | null;
  limit: number;
}

function usePivotConfig() {
  // Local state manager for pivot configuration
  // Returns: { config, setCube, addRow, removeRow, addMeasure, removeMeasure,
  //            setFilter, clearFilters, setSort, setChartType, reset,
  //            loadFromSaved, toQueryParams }
}
```

### 9.3 `usePivotSavedViews`

```typescript
function usePivotSavedViews() {
  // CRUD for pivot_saved_views table
  // Returns: { views, saveView, loadView, deleteView, toggleShare, togglePin }
}
```

---

## 10. UI Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  Analitika — Pivot tabele                        [Sačuvaj ▾] │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│  KOCKA         │  ┌─ Filter chips ─────────────────────────┐ │
│  [Fakture  ▾]  │  │ Godina: [2026] [x]  Status: [paid] [x]│ │
│                │  └────────────────────────────────────────-┘ │
│  REDOVI        │                                             │
│  ┌───────────┐ │  ┌─────────────────────────────────────────┐│
│  │partner_nam│ │  │ Partner    │ Jan    │ Feb    │ Mar   │...││
│  │month      │ │  ├───────────┼────────┼────────┼───────┤   ││
│  └───────────┘ │  │ Firma A   │ 45,200 │ 52,100 │ 48,300│   ││
│                │  │   ├ Jan   │ 45,200 │   —    │   —   │   ││
│  KOLONE        │  │   ├ Feb   │   —    │ 52,100 │   —   │   ││
│  ┌───────────┐ │  │ Firma B   │ 31,000 │ 28,500 │ 35,200│   ││
│  │quarter    │ │  │ ...       │        │        │       │   ││
│  └───────────┘ │  ├───────────┼────────┼────────┼───────┤   ││
│                │  │ UKUPNO    │189,400 │ 212,00 │198,500│   ││
│  MERE          │  └─────────────────────────────────────────┘│
│  ☑ Iznos [SUM] │                                             │
│  ☐ Količina    │  ┌─ Chart toggle ──────────────────────────┐│
│  ☐ PDV         │  │  [Tabela] [Bar] [Linija] [Pita]        ││
│                │  │  ┌──────────────────────────────────┐   ││
│  FILTERI       │  │  │     ████                         │   ││
│  Godina: 2026  │  │  │  ████████  ████                  │   ││
│  Status: paid  │  │  │  ████████  ████████  ████        │   ││
│  [+ Filter]    │  │  │  A         B         C           │   ││
│                │  │  └──────────────────────────────────┘   ││
│ [Primeni]      │  └─────────────────────────────────────────┘│
│                │                                             │
│  SAČUVANI      │  ┌─ Export ────────────────────────────────┐│
│  • Mesečni pr  │  │  [CSV]  [Excel]      Redova: 42 od 128 ││
│  • Top kupci   │  │                      [Učitaj još]       ││
│  • Troškovi Q1 │  └─────────────────────────────────────────┘│
└────────────────┴─────────────────────────────────────────────┘
```

Mobile layout: Builder as collapsible accordion at top, table fills screen width with horizontal scroll.

---

## 11. RBAC Integration

| Role | Access |
|------|--------|
| `admin`, `finance_director` | All 6 cubes |
| `accountant` | GL, Invoices, Purchases cubes |
| `sales`, `sales_manager`, `sales_rep` | Invoices cube (sales only), POS cube |
| `hr`, `hr_manager`, `hr_staff` | Payroll cube |
| `store`, `store_manager`, `cashier` | POS cube |
| `warehouse_manager`, `warehouse_worker` | Inventory cube |
| `production_manager`, `production_worker` | Inventory cube (production movements only) |
| `manager` | All cubes (read-only, no config changes) |
| `viewer` | No pivot access |
| `user` | No pivot access |

**Implementation:** Pivot page checks `canAccess("analytics")`. Cube selector filters available cubes based on role → module mapping in `rolePermissions.ts`.

---

## 12. Implementation Phases

### Phase 1: Database Foundation (5-6h)
- [ ] Create 6 cube views (`v_cube_gl_entries`, etc.)
- [ ] Create `pivot_query` RPC function
- [ ] Create `get_cube_metadata` RPC function
- [ ] Create `pivot_saved_views` table + RLS policies
- [ ] Add indexes on source tables for aggregation performance
- [ ] Test with sample data — verify < 2s response for 50k rows

### Phase 2: Core Frontend — Builder + Table (8-10h)
- [ ] Create `PivotAnalytics.tsx` page + route
- [ ] Build `PivotBuilder` sidebar (CubeSelector, DimensionPicker, MeasurePicker, FilterPanel)
- [ ] Build `usePivotConfig` hook (local state management)
- [ ] Build `usePivotQuery` hook (RPC integration + React Query)
- [ ] Build `PivotTable` component (sortable headers, subtotals, grand total)
- [ ] Pagination (server-side limit/offset)
- [ ] Add to sidebar navigation under "Analitika"

### Phase 3: Drill-Down + Charts (5-6h)
- [ ] Expandable row groups (click to drill into sub-dimensions)
- [ ] Chart toggle (bar, line, pie) using Recharts
- [ ] Chart auto-selects best type based on dimension count
- [ ] Mobile responsive layout (accordion builder, scroll table)

### Phase 4: Saved Views + Export (4-5h)
- [ ] `usePivotSavedViews` hook (CRUD)
- [ ] `SavedViewManager` component (save, load, rename, delete, share, pin)
- [ ] CSV export via existing `exportCsv.ts`
- [ ] XLSX export via `xlsx` package (multi-sheet, formatted)
- [ ] Pinned views shown on Analytics dashboard as quick-access cards

### Phase 5: Polish + RBAC (3-5h)
- [ ] RBAC cube filtering (role → allowed cubes)
- [ ] Translations (add all keys to translations.ts)
- [ ] Empty states, error handling, loading skeletons
- [ ] Performance testing with real-scale data
- [ ] Keyboard shortcuts (Enter to apply, Ctrl+S to save view)

---

## 13. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Large dataset aggregation | Server-side GROUP BY in PostgreSQL (not JS). Views push computation to DB engine. |
| Many concurrent pivot queries | `staleTime: 60s` in React Query. Same config = cache hit. |
| Complex multi-dimension groups | `p_limit` / `p_offset` pagination. Default 100 rows. |
| View creation overhead | SQL views (not materialized) — zero storage cost, always fresh. If perf degrades, convert to materialized views with periodic refresh. |
| Index bloat | Only 3 targeted composite indexes on high-traffic fact tables. |

**Benchmark target:** < 2 seconds for `pivot_query` on 100,000 source rows with 2 dimensions + 1 measure + 1 filter.

---

## 14. Future Enhancements (Post v1)

- **Materialized views** with scheduled refresh for very large datasets (>1M rows)
- **Calculated measures** — user-defined formulas (e.g., `gross_margin = revenue - cogs`)
- **Cross-cube joins** — combine invoices + inventory in one pivot
- **Dashboard widget** — embed a saved pivot view as a dashboard widget
- **Scheduled email reports** — auto-send pivot export as XLSX attachment on schedule
- **PDF export** with company header/branding
- **Conditional formatting** — heatmap coloring for cells based on value ranges
- **Comparison mode** — this year vs last year side-by-side
- **Power BI / Metabase connector** — expose cube views via API for external BI tools

---

## 15. Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `xlsx` ^0.18.5 | ✅ Already installed | Not yet used — will be activated for XLSX export |
| `recharts` ^2.15.4 | ✅ Already installed | Used across dashboard |
| `@dnd-kit/core` + `@dnd-kit/sortable` | ✅ Already installed | For dimension drag-and-drop in PivotBuilder |
| `@tanstack/react-query` ^5.83.0 | ✅ Already installed | Query caching for pivot results |
| shadcn/ui components | ✅ Already installed | Select, Popover, Dialog, Badge, etc. |

**No new npm packages required.**

---

## 16. Success Criteria

1. User can select a cube, drag 2 dimensions to rows, pick a measure, and see aggregated results in < 5 clicks
2. Pivot query returns results in < 2 seconds for standard workloads
3. User can save a view, close the browser, come back, and load it
4. XLSX export produces a properly formatted spreadsheet with number columns
5. Mobile users can access pivot functionality via responsive layout
6. Role-based cube access prevents unauthorized data visibility
7. At least 3 different chart visualizations available per pivot result

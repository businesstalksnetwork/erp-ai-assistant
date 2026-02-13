
# Fiscal Receipt Widget Enhancement

## Overview

Three changes: (1) reposition the widget on the dashboard, (2) add trend indicators comparing today vs. last 7 days, and (3) add a click-to-open detail dialog showing recent receipts filtered by status.

---

## 1. Move Widget Higher on Dashboard

**File**: `src/pages/tenant/Dashboard.tsx`

Move the `FiscalReceiptStatusWidget` render from line 202 (after Module Health) to right after the KPI cards grid (after line 177), before AI Insights. The widget will render conditionally as before (`tenantId && canAccess("pos")`).

New order:
1. Welcome header
2. KPI cards
3. **Fiscal Receipt Status** (moved here)
4. AI Insights
5. Charts Row 1 & 2
6. Module Health
7. Pending Actions + Quick Actions

---

## 2. Add Trend Indicators

**File**: `src/components/dashboard/FiscalReceiptStatusWidget.tsx`

Add two new queries to get counts from the last 24 hours and previous 7 days:
- `fiscal-trend-today-signed`: count of signed receipts created today
- `fiscal-trend-week-signed`: count of signed receipts created in the last 7 days
- Same for offline and failed

Calculate a simple trend: compare today's count to the daily average over the past 7 days. Display an up/down arrow with percentage next to each stat count using `TrendingUp`/`TrendingDown` icons.

The trend query filters use `created_at` with `gte` for date ranges (today = `new Date().toISOString().split("T")[0]`, week = 7 days ago).

---

## 3. Add Click-to-Open Detail Dialog

**File**: `src/components/dashboard/FiscalReceiptStatusWidget.tsx`

- Make each stat card clickable (`cursor-pointer`, `hover:bg-muted` transition)
- Clicking opens a `Dialog` showing the 20 most recent `fiscal_receipts` matching the clicked filter:
  - **Signed**: `receipt_number NOT LIKE 'OFFLINE-%'`
  - **Offline**: `receipt_number LIKE 'OFFLINE-%'`
  - **Failed**: `verification_status = 'failed'`
- The dialog contains a `Table` with columns: Receipt Number, Total Amount, Payment Method, Created At, Verification Status
- Each row shows formatted date and amount
- Dialog title shows the filter name (e.g., "Signed Receipts")

---

## Technical Details

### Files Modified

1. **`src/pages/tenant/Dashboard.tsx`** -- Move the `FiscalReceiptStatusWidget` render from after Module Health to after KPI cards
2. **`src/components/dashboard/FiscalReceiptStatusWidget.tsx`** -- Add trend queries, clickable stats, and detail dialog
3. **`src/i18n/translations.ts`** -- Add translation keys: `receiptLog`, `receiptDetails`, `noReceipts`, `todayTrend`, `totalAmount`, `paymentMethod`, `verificationStatus`

### New Dependencies Used (already installed)
- `Dialog` from `@radix-ui/react-dialog` (via `src/components/ui/dialog.tsx`)
- `Table` components (via `src/components/ui/table.tsx`)
- `TrendingUp`, `TrendingDown` from `lucide-react`
- `format` from `date-fns`

### Query Structure for Trends

```typescript
// Today's signed count
const todaySigned = await supabase
  .from("fiscal_receipts")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenantId)
  .not("receipt_number", "like", "OFFLINE-%")
  .gte("created_at", todayStr);

// Last 7 days signed count (for daily average)
const weekSigned = await supabase
  .from("fiscal_receipts")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenantId)
  .not("receipt_number", "like", "OFFLINE-%")
  .gte("created_at", weekAgoStr);

// Trend = ((todayCount - weekAvg) / weekAvg) * 100
```

### Detail Dialog Query

```typescript
const { data: receipts } = await supabase
  .from("fiscal_receipts")
  .select("id, receipt_number, total_amount, payment_method, created_at, verification_status")
  .eq("tenant_id", tenantId)
  // + filter based on clicked category
  .order("created_at", { ascending: false })
  .limit(20);
```

### No Database Changes Required
All data comes from the existing `fiscal_receipts` table using `created_at`, `receipt_number`, and `verification_status` columns.

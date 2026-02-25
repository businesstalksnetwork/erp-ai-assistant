

# Plan: Add `sales_performance` AI Context + KPI Cards on Hub Pages

## Part 1: Add `sales_performance` AI Narrative Context

### 1A. Edge function — add system prompt
**File**: `supabase/functions/ai-analytics-narrative/index.ts` (line 30, after `purchasing`)

Add new entry to `systemPrompts`:
```
sales_performance: `You are a sales performance analyst AI. Given sales data including quotes, sales orders, invoices, and dispatch notes, analyze conversion rates (quote→order→invoice), average deal size, revenue trends, top customers by volume, salesperson performance, and channel effectiveness. Provide a 2-3 sentence analysis.`
```

### 1B. Update `AiAnalyticsNarrative` type union
**File**: `src/components/ai/AiAnalyticsNarrative.tsx` (line 10)

Add `"sales_performance"` to the `contextType` union type.

### 1C. Wire sidebar context map
**File**: `src/components/ai/AiContextSidebar.tsx` (line 109)

Change `"/sales": "dashboard"` → `"/sales": "sales_performance"`.

---

## Part 2: AI-Powered KPI Summary Cards on Hub Pages

Each of the 4 hub pages (SalesHub, PosHub, InventoryHub, PurchasingHub) will be enhanced with:
1. `useTenant()` hook to get `tenantId`
2. A `useQuery` call fetching 3-4 lightweight KPI counts/sums from existing tables
3. `StatsBar` component (already exists) to render the KPI cards
4. `AiAnalyticsNarrative` component with the appropriate context type and fetched data

### 2A. SalesHub KPI Cards
**File**: `src/pages/tenant/SalesHub.tsx`

Queries:
- `quotes` table: count where `status='draft'` → "Aktivne ponude"
- `sales_orders` table: count where `status='confirmed'` → "Potvrđeni nalozi"
- `invoices` table: sum of `total_amount` for current month → "Prihod (mesec)"
- `invoices` table: count where `status='sent'` → "Poslate fakture"

Stats passed to `StatsBar`. Data object passed to `AiAnalyticsNarrative` with `contextType="sales_performance"`.

### 2B. PosHub KPI Cards
**File**: `src/pages/tenant/PosHub.tsx`

Queries:
- `pos_sessions` table: count where `status='open'` → "Otvorene sesije"
- `pos_transactions` table: count for today → "Danas transakcija"
- `pos_transactions` table: sum `total_amount` for today → "Danas promet"
- `pos_transactions` table: count for current month → "Mesec transakcija"

`AiAnalyticsNarrative` with `contextType="pos_performance"`.

### 2C. InventoryHub KPI Cards
**File**: `src/pages/tenant/InventoryHub.tsx`

Queries:
- `products` table: total count → "Ukupno proizvoda"
- `inventory_stock` table: count where `quantity <= min_quantity` (or `quantity <= 0`) → "Niske zalihe"
- `inventory_stock` table: sum of `quantity * unit_cost` (if available) or just total stock rows → "Stavki na stanju"
- `products` table: count where `is_active = true` → "Aktivni artikli"

`AiAnalyticsNarrative` with `contextType="inventory_health"`.

### 2D. PurchasingHub KPI Cards
**File**: `src/pages/tenant/PurchasingHub.tsx`

Queries:
- `purchase_orders` table: count where `status='draft'` → "Nacrt narudžbina"
- `purchase_orders` table: count where `status='sent'` → "Poslate narudžbine"
- `goods_receipts` table: count for current month → "Prijemnice (mesec)"
- `purchase_orders` table: sum of `total_amount` for current month → "Nabavka (mesec)"

`AiAnalyticsNarrative` with `contextType="purchasing"`.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `supabase/functions/ai-analytics-narrative/index.ts` | Add `sales_performance` system prompt |
| `src/components/ai/AiAnalyticsNarrative.tsx` | Add `"sales_performance"` to contextType union |
| `src/components/ai/AiContextSidebar.tsx` | Change `/sales` mapping to `sales_performance` |
| `src/pages/tenant/SalesHub.tsx` | Add KPI queries, StatsBar, AiAnalyticsNarrative |
| `src/pages/tenant/PosHub.tsx` | Add KPI queries, StatsBar, AiAnalyticsNarrative |
| `src/pages/tenant/InventoryHub.tsx` | Add KPI queries, StatsBar, AiAnalyticsNarrative |
| `src/pages/tenant/PurchasingHub.tsx` | Add KPI queries, StatsBar, AiAnalyticsNarrative |

Each hub page will import `useTenant`, `useQuery`, `supabase`, `StatsBar`, and `AiAnalyticsNarrative`. The hub pages keep their existing navigation grid but gain a stats row at the top (via `BiPageLayout`'s `stats` prop) and an AI narrative card below the header.


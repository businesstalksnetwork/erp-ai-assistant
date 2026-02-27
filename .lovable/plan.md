

## Fix Widget Labels: Missing Translations + Snake-to-Camel Key Mismatch

### Root Causes
1. **KpiWidget** receives snake_case `metricKey` (e.g. `new_customers`, `retail_revenue`) but translations use camelCase (`newCustomers`, `retailRevenue`). The label lookup `t(metricKey)` fails, showing raw snake_case or uppercased text.
2. **Missing translation**: `newCustomers` key doesn't exist in `translations.ts` at all.

### Fix

**1. `KpiWidget.tsx`** — Use widget registry `titleKey` for label instead of raw `metricKey`:
- Import `widgetRegistry` from `@/config/widgetRegistry`
- Look up `widgetRegistry["kpi_" + metricKey]?.titleKey` to get the camelCase translation key
- Fall back to `metricKey` if not found (for edge cases like `today_sales` rendered outside the kpi_ prefix)

Change:
```ts
const baseLabel = t(metricKey as any) || metricKey;
```
To:
```ts
const registryKey = widgetRegistry[`kpi_${metricKey}`]?.titleKey || metricKey;
const baseLabel = t(registryKey as any) || metricKey;
```

**2. `translations.ts`** — Add missing `newCustomers` key:
- EN: `newCustomers: "New Customers"`
- SR: `newCustomers: "Novi kupci"`

### Files Modified
1. `src/components/dashboard/widgets/KpiWidget.tsx` — registry-based label lookup
2. `src/i18n/translations.ts` — add `newCustomers` key (EN + SR)


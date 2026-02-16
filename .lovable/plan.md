
# Fix Profitability Analysis -- Wrong Column Name

## Problem

The `ProfitabilityAnalysis.tsx` query selects a column called `total` from `invoice_lines`, but the actual column name is `line_total`. This causes all revenue values to be `0`, resulting in the empty charts and tables you see.

The Analytics Dashboard (second screenshot) works fine because it queries `journal_lines` directly, not `invoice_lines`.

## Fix

A single change in `src/pages/tenant/ProfitabilityAnalysis.tsx`:

1. In the `.select()` call (line ~46), change `total` to `line_total`
2. In the processing loop (line ~55), change `line.total` to `line.line_total`

### Before
```typescript
.select("description, quantity, unit_price, total, product_id, ...")
// ...
const revenue = Number(line.total) || 0;
```

### After
```typescript
.select("description, quantity, unit_price, line_total, product_id, ...")
// ...
const revenue = Number(line.line_total) || 0;
```

| File | Change |
|---|---|
| `src/pages/tenant/ProfitabilityAnalysis.tsx` | Replace `total` with `line_total` in select and usage |

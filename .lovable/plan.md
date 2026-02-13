

# Fix: AiPlanningDashboard Stock Field Mismatch

## Problem

In `src/pages/tenant/AiPlanningDashboard.tsx`, the material readiness query (line 84) uses the wrong column name:

```
.select("on_hand")   // WRONG -- column does not exist
st.on_hand            // WRONG -- will always be undefined
```

The actual column in the `inventory_stock` table is `quantity_on_hand`. This causes the material readiness check to silently fail -- every BOM line reports zero stock, so all orders show as "red" (missing material) even when stock is available.

## Fix

Two changes on lines 84-85 of `src/pages/tenant/AiPlanningDashboard.tsx`:

| Line | Before | After |
|------|--------|-------|
| 84 | `.select("on_hand")` | `.select("quantity_on_hand")` |
| 85 | `s + st.on_hand` | `s + st.quantity_on_hand` |

No other files are affected. No database migration needed.

## Technical Detail

```typescript
// Line 84: fix select column
const { data: stock } = await supabase
  .from("inventory_stock")
  .select("quantity_on_hand")  // was "on_hand"
  .eq("product_id", bl.material_product_id)
  .eq("tenant_id", tenantId!);

// Line 85: fix property access
const total = stock?.reduce(
  (s: number, st: any) => s + st.quantity_on_hand, 0  // was st.on_hand
) || 0;
```


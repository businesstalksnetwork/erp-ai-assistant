

## Phase 9: WMS AI Improvements

### Current State
- `wms_product_stats` table + `refresh_wms_product_stats()` RPC exist but are **not used** by slotting
- `wms_affinity_pairs` table does **not exist** — affinity is recomputed every slotting run
- Edge function recalculates velocity + affinity from raw pick history on every call
- No pick route optimization (tasks generated in priority order, no TSP)
- No scheduled stats refresh
- Slotting uses `google/gemini-3-flash-preview` but logs `gemini-3-flash-preview` — minor

### Plan (5 items)

#### 1. Create `wms_affinity_pairs` table + refresh RPC
- Migration: `wms_affinity_pairs (id, tenant_id, warehouse_id, product_a_id, product_b_id, co_pick_count, updated_at)` with RLS + unique constraint on `(tenant_id, warehouse_id, product_a_id, product_b_id)`
- `refresh_wms_affinity_pairs(p_tenant_id, p_warehouse_id)` RPC that computes co-pick counts from 90-day `wms_tasks` and upserts

#### 2. Wire precomputed stats into `wms-slotting` edge function
- Before building AI prompt, call `refresh_wms_product_stats` and `refresh_wms_affinity_pairs` RPCs
- Read from `wms_product_stats` and `wms_affinity_pairs` instead of recomputing velocity/affinity from raw history
- Reduces edge function execution time and data volume

#### 3. Add pick route optimization to wave picking
- When a pick wave is released, sort pick tasks by bin `sort_order` within each zone (nearest-neighbor approximation)
- Add `pick_sequence` column to `wms_tasks` (nullable integer)
- Update `WmsPicking.tsx` to display and sort by `pick_sequence`
- Update wave creation to assign sequences based on bin sort order

#### 4. Add "Refresh Stats" button to slotting UI
- Add button in `WmsSlotting.tsx` analysis dialog to manually trigger `refresh_wms_product_stats` + `refresh_wms_affinity_pairs` before running analysis
- Show last refresh timestamp from `wms_product_stats.updated_at`

#### 5. Update AI model + logging consistency
- Update `wms-slotting` edge function model to explicitly set `model: "google/gemini-3-flash-preview"` in the API call
- Fix audit log `model_version` to match

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | `wms_affinity_pairs` table, `refresh_wms_affinity_pairs` RPC, `pick_sequence` column on `wms_tasks` |
| `supabase/functions/wms-slotting/index.ts` | Use precomputed stats, set model explicitly, fix logging |
| `src/pages/tenant/WmsSlotting.tsx` | Refresh stats button + timestamp display |
| `src/pages/tenant/WmsPicking.tsx` | Sort/display by `pick_sequence`, assign sequences on wave creation |
| `src/i18n/translations.ts` | ~8 new keys (refreshStats, lastRefresh, pickSequence, etc.) |

### Execution Order
1. DB migration (affinity table + pick_sequence column)
2. Translation keys
3. Edge function improvements
4. Slotting UI refresh button
5. Pick route optimization


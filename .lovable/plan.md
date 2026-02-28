

## Phase 6: AI Cycle Counting Module Enhancement + New AI WMS Pages

Phase 6 focuses on upgrading the existing basic cycle counting page into an AI-driven system and adding the remaining AI WMS pages per the PRD.

### 6.1: Enhance WmsCycleCounts with AI Features
Upgrade `WmsCycleCounts.tsx` from a basic manual count page to an AI-powered system:

- **ABC Classification**: Add product ABC classification (A=high-value/high-velocity, B=medium, C=low) using pick velocity data from `wms_product_velocity`
- **AI Count Scheduling**: Auto-suggest which bins/products to count next based on: ABC class (A items counted more frequently), days since last count, variance history, and stock value
- **Variance Prediction**: Show predicted variance ranges based on historical count data
- **Smart Reconciliation**: Auto-approve variances within configurable thresholds; flag outliers for manual review

**Schema changes** (migration):
- Add columns to `wms_cycle_count_lines`: `abc_class TEXT`, `ai_priority_score NUMERIC`, `auto_approved BOOLEAN DEFAULT false`
- Add columns to `wms_cycle_counts`: `ai_generated BOOLEAN DEFAULT false`, `accuracy_rate NUMERIC`
- Create `wms_count_schedule_config` table: `(tenant_id, warehouse_id, abc_a_frequency_days, abc_b_frequency_days, abc_c_frequency_days, auto_approve_threshold_pct, created_at)`

### 6.2: AI Wave Planning Page (new)
Create `src/pages/tenant/WmsWavePlanning.tsx` at `/inventory/wms/wave-planning`:
- Group pick tasks into optimized waves based on order priority, zone proximity, and picker capacity
- Wave creation wizard: select orders → AI groups into waves → assign pickers
- KPI cards: waves today, picks/hour, on-time rate

### 6.3: AI Route Optimization Page (new)
Create `src/pages/tenant/WmsRouteOptimization.tsx` at `/inventory/wms/route-optimization`:
- Visualize optimal pick routes through warehouse zones
- Show distance saved vs naive ordering
- Per-picker route assignment and efficiency metrics

### 6.4: AI Demand Putaway Page (new)
Create `src/pages/tenant/WmsDemandPutaway.tsx` at `/inventory/wms/demand-putaway`:
- AI-suggested putaway locations based on demand forecast, product velocity, and bin capacity
- Incoming receipts list with recommended bin assignments
- One-click accept/override putaway suggestions

### 6.5: AI Warehouse Analytics Page (new)
Create `src/pages/tenant/WmsAnalytics.tsx` at `/inventory/wms/analytics`:
- Dashboard with warehouse KPIs: space utilization, pick accuracy, throughput trends
- ABC distribution chart, velocity heatmap by zone
- Count accuracy over time, variance trend charts

### 6.6: Sidebar + Routes Wiring
- Add 4 new nav items to `inventoryNav` in `TenantLayout.tsx` under the `aiWarehouse` section with `aiModule: "ai-wms"`
- Add 4 new routes to `inventoryRoutes.tsx`
- Add translation keys for all new pages

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | 6.1 — schema additions to cycle count tables + `wms_count_schedule_config` |
| `src/pages/tenant/WmsCycleCounts.tsx` | 6.1 — AI scheduling, ABC classification, auto-approve |
| `src/pages/tenant/WmsWavePlanning.tsx` | 6.2 — new page |
| `src/pages/tenant/WmsRouteOptimization.tsx` | 6.3 — new page |
| `src/pages/tenant/WmsDemandPutaway.tsx` | 6.4 — new page |
| `src/pages/tenant/WmsAnalytics.tsx` | 6.5 — new page |
| `src/layouts/TenantLayout.tsx` | 6.6 — 4 new nav items |
| `src/routes/inventoryRoutes.tsx` | 6.6 — 4 new routes |
| `src/i18n/translations.ts` | 6.6 — new translation keys |

### Execution Order
1. Migration: schema changes (6.1)
2. Enhance `WmsCycleCounts.tsx` with AI features (6.1)
3. Create 4 new AI WMS pages (6.2–6.5) in parallel
4. Wire sidebar + routes + translations (6.6)


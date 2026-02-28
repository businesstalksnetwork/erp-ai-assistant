

## Phase 10: Production AI Improvements

### Current State
- Edge function handles 6 actions: dashboard-insights, generate-schedule, predict-bottlenecks, simulate-scenario, save-scenario, list-scenarios + local-fallback-schedule
- Bottleneck page **hardcodes language to "sr"** (bug on line 122 of AiBottleneckPrediction.tsx)
- Dashboard material readiness uses **N+1 queries** (loops per BOM line checking stock individually)
- Production waste data exists (`production_waste` table) but **no AI analysis** on waste patterns
- No production **cost analysis** AI despite cost data being tracked on orders
- Schedule page has no **"Accept All / Reject All"** buttons
- AI context doesn't include waste or cost data — limits insight quality

### Plan (6 items)

#### 1. Fix hardcoded language bug in bottleneck prediction
- `AiBottleneckPrediction.tsx` line 122: change `language: "sr"` to `language: locale`

#### 2. Add "Accept All / Reject All" to schedule page
- Add two buttons in `AiPlanningSchedule.tsx` toolbar when suggestions exist
- "Accept All" sets all suggestion order_ids into accepted set
- "Reject All" sets all into rejected set

#### 3. Add AI waste analysis action to edge function
- New action `"analyze-waste"` in `production-ai-planning/index.ts`
- Fetches `production_waste` data with product names and order references
- AI tool: `provide_waste_analysis` returning `{ waste_rate_pct, top_reasons, recommendations, waste_by_product[] }`
- Includes waste data in context for better bottleneck/dashboard insights too

#### 4. Add waste analysis tab to AI Planning Dashboard
- New tab "Waste Analysis" in `AiPlanningDashboard.tsx`
- Shows waste rate KPI, top waste reasons, per-product waste breakdown
- "Analyze Waste" button triggers the new edge function action

#### 5. Optimize material readiness N+1 queries
- Refactor `AiPlanningDashboard.tsx` material readiness query to batch-fetch all BOM lines and stock in 2 queries instead of N+1 per order/line

#### 6. Enrich AI data context with waste + cost data
- In edge function, add `production_waste` and order cost fields (`actual_material_cost`, `actual_labor_cost`, `unit_production_cost`) to the `dataContext` string sent to AI
- Improves quality of dashboard insights, bottleneck predictions, and simulations

### Files Modified

| File | Change |
|------|--------|
| `src/pages/tenant/AiBottleneckPrediction.tsx` | Fix hardcoded language |
| `src/pages/tenant/AiPlanningSchedule.tsx` | Accept All / Reject All buttons |
| `src/pages/tenant/AiPlanningDashboard.tsx` | Waste analysis tab + optimize material readiness queries |
| `supabase/functions/production-ai-planning/index.ts` | New `analyze-waste` action + enrich data context with waste/cost |
| `src/i18n/translations.ts` | ~8 new keys (wasteAnalysis, wasteRate, topWasteReasons, acceptAll, rejectAll, etc.) |

### Execution Order
1. Bug fix (language) + Accept/Reject All
2. Translation keys
3. Edge function: waste action + enriched context
4. Dashboard: waste tab + optimized queries


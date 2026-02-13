

# Production AI Planning Module -- MVP Implementation

## Overview

Add a new "AI Planning" sub-module within the existing Production module. This introduces 4 new pages and 1 new edge function that leverage Lovable AI (Gemini) to provide intelligent production scheduling, bottleneck prediction, and capacity insights based on existing production data.

## Architecture

The module will reuse the existing `ai-assistant` pattern (Lovable AI Gateway via edge function) and the existing `production_orders`, `bom_templates`, `bom_lines`, `inventory_stock`, and `products` tables. No new database tables are needed for the MVP -- AI analysis is done on-the-fly from existing data.

## New Pages (4)

### 1. `/production/ai-planning` -- AI Planning Dashboard
The main entry point showing:
- **KPI Cards**: Schedule adherence %, capacity utilization %, active orders, late orders
- **AI-generated insights panel**: Bottleneck alerts, late-order risk, material shortage warnings
- **"Generate AI Plan" button**: Triggers the AI scheduling engine
- Data sourced from `production_orders` (statuses, dates) and `inventory_stock`

### 2. `/production/ai-planning/schedule` -- AI-Optimized Schedule
- **Gantt-style timeline view** (using simple CSS bars, not a heavy library) showing production orders on a date axis
- **"Generate Schedule" button**: Sends current orders, BOM data, and capacity constraints to AI edge function
- AI returns optimized order sequencing with start/end suggestions and explanations
- **Human-in-the-loop controls**: Lock/unlock orders, override priorities, accept/reject AI suggestions
- Each suggestion shows an explanation (e.g., "Moved Order X before Y to reduce changeover time")

### 3. `/production/ai-planning/bottlenecks` -- Bottleneck Prediction
- Lists predicted bottlenecks from AI analysis:
  - Material shortages (cross-referencing BOM needs vs `inventory_stock`)
  - Overloaded date ranges (too many orders in same window)
  - Late-order probability
- Each bottleneck has severity (critical/warning/info), explanation, and suggested action
- Data gathered from production orders + inventory stock, analyzed by AI

### 4. `/production/ai-planning/scenarios` -- Capacity Simulation
- **What-if scenario builder**: User can adjust parameters:
  - Add/remove shifts (multiplier on daily capacity)
  - Change order priorities
  - Delay/advance order dates
- Click "Simulate" to get AI-generated comparison of KPIs (utilization %, on-time rate, WIP)
- Shows before/after comparison cards

## New Edge Function (1)

### `supabase/functions/production-ai-planning/index.ts`
- Accepts action types: `generate-schedule`, `predict-bottlenecks`, `simulate-scenario`, `dashboard-insights`
- Fetches relevant production data from Supabase (orders, BOMs, inventory)
- Constructs a detailed prompt with the data context
- Calls Lovable AI Gateway (google/gemini-3-flash-preview) with tool calling for structured output
- Returns structured JSON responses (schedule suggestions, bottleneck list, scenario comparison)
- JWT-authenticated, tenant-scoped

## Sidebar Navigation Update

Update `productionNav` in `TenantLayout.tsx` to add sections:

```
Production
  [Existing]
    BOM Templates
    Production Orders
  [AI Planning]
    AI Dashboard
    AI Schedule
    Bottleneck Prediction
    Capacity Simulation
```

## Translation Keys (~30 new keys)

Add to both `en` and `sr` sections:
- `aiPlanning`, `aiSchedule`, `bottleneckPrediction`, `capacitySimulation`
- `generateAiPlan`, `scheduleAdherence`, `capacityUtilization`, `lateOrders`
- `lockOrder`, `unlockOrder`, `acceptSuggestion`, `rejectSuggestion`
- `simulateScenario`, `addShift`, `removeShift`, `beforeAfter`
- `aiExplanation`, `suggestedAction`, `materialShortage`, `overloadedPeriod`
- `aiPlanningSection`, `existingSection` (section dividers)
- And additional labels for the UI

## Routing

Add 4 new routes in `App.tsx` under production:
```
/production/ai-planning         -> AiPlanningDashboard
/production/ai-planning/schedule -> AiPlanningSchedule
/production/ai-planning/bottlenecks -> AiBottleneckPrediction
/production/ai-planning/scenarios -> AiCapacitySimulation
```

All wrapped in `<ProtectedRoute requiredModule="production">`.

## Files to Create

1. `src/pages/tenant/AiPlanningDashboard.tsx` -- Dashboard with KPIs and insights
2. `src/pages/tenant/AiPlanningSchedule.tsx` -- Schedule generation and override UI
3. `src/pages/tenant/AiBottleneckPrediction.tsx` -- Bottleneck list with AI analysis
4. `src/pages/tenant/AiCapacitySimulation.tsx` -- What-if scenario builder
5. `supabase/functions/production-ai-planning/index.ts` -- Edge function for AI calls

## Files to Modify

1. `src/layouts/TenantLayout.tsx` -- Add AI Planning nav items with section divider
2. `src/App.tsx` -- Add 4 new routes
3. `src/i18n/translations.ts` -- Add ~30 translation keys (en + sr)
4. `supabase/config.toml` -- Register new edge function

## What is NOT in MVP

- No new database tables (AI works on existing data)
- No autonomous execution (always human-in-the-loop)
- No multi-site scheduling
- No reinforcement learning
- No MES integration
- No automated procurement triggers


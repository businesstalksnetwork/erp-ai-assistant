

## Implement & Upgrade Production AI Module

### Overview

The Production AI module has 4 pages (Dashboard, Schedule, Bottleneck Predictor, Capacity Simulator) and 1 edge function. Several key improvements are missing: no `priority` field on orders, no persistent scenario storage, schedule generation ignores locked orders, no date validation on AI output, no local fallback scheduler, and the edge function lacks order priority/due-date context. This plan addresses all of these.

---

### 1. Database Migration: Add `priority` to production_orders + Create `production_scenarios` table

**New column on `production_orders`:**
- `priority` INTEGER DEFAULT 3 (1=highest, 5=lowest) -- enables user-driven priority input to AI

**New table `production_scenarios`:**
- `id` UUID PK
- `tenant_id` UUID FK NOT NULL
- `name` TEXT NOT NULL
- `scenario_type` TEXT NOT NULL (schedule, simulation, bottleneck)
- `params` JSONB DEFAULT '{}'
- `result` JSONB DEFAULT '{}'
- `status` TEXT DEFAULT 'completed'
- `created_by` UUID
- `created_at` TIMESTAMPTZ DEFAULT now()

RLS: tenant-scoped read/write for active members.

---

### 2. Edge Function Upgrade: `production-ai-planning`

**Data enrichment:**
- Add `priority` and `planned_end` (as due date) to the order data sent to AI
- Add `today's date` to context so AI doesn't suggest past dates
- For `generate-schedule`: accept `locked_order_ids` and `excluded_order_ids` arrays from the request body. Filter locked orders out of suggestions and exclude excluded orders from the prompt entirely.

**Date validation (post-AI):**
- After parsing AI schedule suggestions, validate each: `suggested_start < suggested_end` and `suggested_start >= today`. Filter out invalid entries and log warnings.

**New action `local-fallback-schedule`:**
- A deterministic scheduling algorithm in the edge function itself (no AI call):
  - Sort non-completed orders by priority ASC, then planned_end ASC (earliest due date first)
  - Assign sequential start dates with estimated durations based on quantity
  - Returns same `ScheduleResult` schema as AI
- Used as fallback when AI fails, or when user explicitly selects "Local" mode

**Save scenario action:**
- New action `save-scenario`: persists params + result to `production_scenarios` table
- New action `list-scenarios`: returns recent scenarios for tenant

---

### 3. Schedule Page Upgrades (`AiPlanningSchedule.tsx`)

- **Locked orders passed to AI**: When generating, send `locked_order_ids` (from the `locked` Set) so AI skips those orders in suggestions
- **Exclude orders**: Add checkboxes or a multi-select to exclude specific orders from analysis
- **Date validation toast**: After receiving suggestions, filter out invalid dates and show a warning toast if any were removed
- **Local fallback toggle**: Add a Switch "AI / Local" mode toggle (like WMS slotting). Local mode calls `local-fallback-schedule` action
- **Gantt legend**: Add a color legend bar below the chart explaining status colors (draft, in_progress, completed, late, AI suggestion)
- **Batch apply**: Change sequential `update` loop to `Promise.all` for accepted suggestions
- **Priority column display**: Show order priority in the tooltip

---

### 4. Capacity Simulation Persistence (`AiCapacitySimulation.tsx`)

- Replace client-side `savedScenarios` state with database-backed storage using `production_scenarios` table
- On "Save Scenario": call `save-scenario` action to persist
- On page load: query `production_scenarios` where `scenario_type = 'simulation'` to show history
- Add "Load" button on saved scenarios to restore params + result
- Add "Compare" mode: select 2 saved scenarios, show side-by-side KPI diff (reuse pattern from WMS slotting comparison)

---

### 5. Bottleneck Predictor: Local Material Check (`AiBottleneckPrediction.tsx`)

- Add a local pre-check before AI call: cross-reference BOM lines with inventory stock to find real material shortages
- Merge local material shortages with AI bottlenecks, deduplicating
- This provides instant results for material shortages even before AI responds

---

### 6. Dashboard: Priority Distribution Widget (`AiPlanningDashboard.tsx`)

- Add a small bar chart showing order count by priority (1-5)
- Add priority to the material readiness check display

---

### 7. Documentation Update

Update `ARCHITECTURE_DOCUMENTATION.md` with:
- New `production_scenarios` table schema
- `priority` field on `production_orders`
- Local fallback scheduler description
- Updated edge function actions list

---

### Technical Details

**Files to create:**
- None (all changes are modifications)

**Files to modify:**
- `supabase/functions/production-ai-planning/index.ts` -- add locked/excluded order filtering, date validation, local fallback action, save/list scenario actions
- `src/pages/tenant/AiPlanningSchedule.tsx` -- locked order passthrough, exclude UI, local mode toggle, legend, batch apply
- `src/pages/tenant/AiCapacitySimulation.tsx` -- DB-backed scenario persistence, load, compare
- `src/pages/tenant/AiBottleneckPrediction.tsx` -- local material pre-check
- `src/pages/tenant/AiPlanningDashboard.tsx` -- priority distribution widget
- `src/pages/tenant/ProductionOrders.tsx` -- priority field in create/edit form
- `ARCHITECTURE_DOCUMENTATION.md` -- document new schema and features

**Database migration:**
- ALTER TABLE production_orders ADD COLUMN priority INTEGER DEFAULT 3
- CREATE TABLE production_scenarios (with RLS policies)

**Edge function deployment:** production-ai-planning


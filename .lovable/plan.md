

# WMS with AI Slotting -- MVP Implementation Plan
## Extending the Magacin (Inventory) Module

This builds on top of the existing inventory infrastructure: `warehouses`, `inventory_stock`, `inventory_movements`, `adjust_inventory_stock` RPC, internal orders/transfers/receipts. Nothing existing is changed or broken.

---

## Phase 1: Warehouse Topology (Zones, Aisles, Bins)

### Database Tables

**`wms_zones`** -- zones within a warehouse (receiving, reserve, forward-pick, packing, shipping, quarantine)
- `id`, `tenant_id`, `warehouse_id` (FK warehouses), `name`, `code`, `zone_type` (enum: receiving, reserve, forward_pick, packing, shipping, quarantine, returns)
- `pick_method` (each/case/pallet), `is_active`, `sort_order`
- RLS: tenant_id based

**`wms_aisles`** -- aisles within a zone
- `id`, `tenant_id`, `zone_id` (FK wms_zones), `name`, `code`, `sort_order`

**`wms_bins`** -- individual storage locations (bin/shelf/pallet position)
- `id`, `tenant_id`, `aisle_id` (FK wms_aisles), `zone_id` (FK wms_zones), `warehouse_id` (FK warehouses)
- `code` (e.g. A-01-03-B), `bin_type` (bin/shelf/pallet/flow_rack)
- `max_volume`, `max_weight`, `max_units` -- capacity constraints
- `level` (integer -- shelf height, 1=floor), `accessibility_score` (1-10, golden zone indicator)
- `restrictions` (JSON: hazmat, temp_controlled, security)
- `is_active`, `sort_order` (for pick path sequencing)

**`wms_bin_stock`** -- SKU inventory per bin (granular version of inventory_stock)
- `id`, `tenant_id`, `bin_id` (FK wms_bins), `product_id` (FK products), `warehouse_id`
- `quantity`, `lot_number` (nullable), `status` (available/damaged/quarantine/on_hold/allocated)
- `received_at`, `updated_at`
- Unique constraint: (bin_id, product_id, lot_number, status)

### Frontend Pages

**Warehouse Zones & Bins Manager** (`/inventory/wms/zones`)
- Select a warehouse, view/add/edit zones
- Drill into a zone to manage aisles and bins
- Visual grid showing bin utilization (color-coded: empty/partial/full/overweight)

**Bin Detail** (`/inventory/wms/bins/:id`)
- Show bin attributes, current contents (products + quantities)
- History of movements in/out of this bin

### Nav Updates (TenantLayout.tsx)
Add under the existing `inventoryNav` array:
- `wmsZones` -> `/inventory/wms/zones`
- `wmsTasks` -> `/inventory/wms/tasks`
- `wmsReceiving` -> `/inventory/wms/receiving`
- `wmsPicking` -> `/inventory/wms/picking`
- `wmsCycleCounts` -> `/inventory/wms/cycle-counts`
- `wmsSlotting` -> `/inventory/wms/slotting`

---

## Phase 2: Task Engine

### Database

**`wms_tasks`** -- central task queue for all warehouse operations
- `id`, `tenant_id`, `warehouse_id`, `task_number` (auto: TSK-YYYY-NNNN)
- `task_type` (receive/putaway/pick/replenish/move/reslot/count/pack/load)
- `status` (pending/assigned/in_progress/completed/cancelled/exception)
- `priority` (1-5, 1=urgent)
- `product_id`, `quantity`, `from_bin_id`, `to_bin_id`
- `order_reference` (nullable -- links to sales_order or internal_order)
- `assigned_to` (FK user), `assigned_at`
- `started_at`, `completed_at`
- `notes`, `exception_reason` (for when operator reports a problem)
- `created_by`, `created_at`

### Frontend

**Task Dashboard** (`/inventory/wms/tasks`)
- Filterable list: by type, status, priority, assigned user, warehouse
- Stats bar: pending count, in-progress, completed today, exceptions
- Assign/reassign tasks (supervisor flow)
- Quick status transitions: Start, Complete, Report Exception

**Task execution** -- click a task row to open an execution dialog:
- Shows from-bin, to-bin, product, expected quantity
- Operator confirms or reports mismatch/exception

---

## Phase 3: Inbound Receiving and Putaway

### Workflow
1. Goods arrive (linked to Purchase Order or blind receive)
2. Operator creates a **receiving task** -- selects warehouse, scans/enters products + quantities
3. System creates `wms_bin_stock` entries in the **receiving zone** staging bin
4. System auto-generates **putaway tasks** based on putaway rules:
   - MVP rule: nearest available bin in the correct zone with capacity
   - Later: AI-guided putaway based on slotting targets
5. Operator executes putaway tasks (move from receiving bin to target bin)
6. On completion, `wms_bin_stock` updates (deduct receiving bin, add target bin)
7. Aggregate `inventory_stock` is kept in sync (existing table remains the summary view)

### Database

**`wms_putaway_rules`** -- simple rules for automated putaway suggestions
- `id`, `tenant_id`, `warehouse_id`
- `product_category` (nullable -- match by product category or null for default)
- `target_zone_id` (FK wms_zones)
- `priority` (lower = higher priority)

### Frontend

**Receiving Page** (`/inventory/wms/receiving`)
- Select warehouse, optionally link to PO
- Add products + quantities received
- "Confirm Receipt" creates receiving bin_stock + generates putaway tasks
- Shows list of recent receivings with status

### Sync with Existing System
- When bin_stock changes, a trigger/RPC updates the aggregate `inventory_stock` table so existing stock overview, reports, and all current pages continue working unchanged

---

## Phase 4: Outbound Picking

### Workflow
1. Sales order confirmed -> system generates **pick tasks** from allocated bins
2. Pick allocation logic (MVP): FIFO by received_at, sorted by bin sort_order for path optimization
3. Operator executes pick tasks one by one (or batched)
4. On pick completion, `wms_bin_stock` decremented, `inventory_stock` decremented
5. Picked items move to packing zone

### Database

**`wms_pick_waves`** -- grouping of orders for batch picking
- `id`, `tenant_id`, `warehouse_id`, `wave_number` (auto)
- `status` (draft/released/in_progress/completed)
- `created_at`, `completed_at`

**`wms_pick_wave_orders`** -- orders in a wave
- `id`, `wave_id`, `order_id` (FK sales_orders), `status`

### Frontend

**Picking Page** (`/inventory/wms/picking`)
- Create pick wave from pending sales orders
- Release wave -> generates pick tasks
- Monitor pick progress
- Discrete order picking (MVP): one order at a time

### RPC

**`generate_pick_tasks`** -- allocates bins for order lines, creates wms_tasks
- Input: order_id or wave_id, warehouse_id
- Logic: for each order line, find bins with available stock (FIFO), create pick task per bin
- Updates bin_stock status to "allocated"
- Returns created task IDs

---

## Phase 5: Cycle Counting

### Database

**`wms_cycle_counts`** -- count sessions
- `id`, `tenant_id`, `warehouse_id`, `count_number` (auto)
- `count_type` (scheduled/trigger/abc)
- `status` (planned/in_progress/completed/reconciled)
- `zone_id` (nullable -- scope to zone), `created_at`, `completed_at`

**`wms_cycle_count_lines`** -- individual bin counts
- `id`, `count_id`, `bin_id`, `product_id`
- `expected_quantity`, `counted_quantity`, `variance`
- `status` (pending/counted/recounted/approved)
- `counted_by`, `counted_at`, `approved_by`

### Frontend

**Cycle Counts Page** (`/inventory/wms/cycle-counts`)
- Create new count (select warehouse, zone, type)
- Auto-generate count lines based on bins in scope
- Count execution: enter actual quantities per bin
- Variance report with approve/recount workflow
- On reconciliation, adjusts `wms_bin_stock` and `inventory_stock` via existing `adjust_inventory_stock`

---

## Phase 6: AI Slotting and Storage Planning

### Edge Function: `wms-slotting`

Calls the AI model with structured data to produce slotting recommendations.

**Inputs collected:**
- Pick history (last 90 days): product_id, bin_id, pick count, lines/week
- Product master: dims, weight, handling class
- Bin attributes: zone, capacity, level, accessibility_score
- Current bin_stock placement
- Co-occurrence matrix (products frequently picked together)

**Processing:**
1. Calculate velocity scores per SKU (picks/week)
2. Calculate affinity scores (co-picked pairs)
3. Score each possible SKU-bin assignment against objectives:
   - Minimize pick travel (high-velocity SKUs in golden zone bins, close to packing)
   - Group co-picked items in adjacent bins
   - Respect hard constraints (capacity, zone type, restrictions)
4. Generate ranked recommendations

**Output:**
- List of `{ product_id, current_bin, recommended_bin, score, reasons[] }`
- Estimated improvement metrics (travel reduction %)
- One-click "Generate Move Plan" that creates `wms_tasks` of type `reslot`

### Database

**`wms_slotting_scenarios`** -- saved analysis runs
- `id`, `tenant_id`, `warehouse_id`, `name`
- `parameters` (JSON: date_range, weights, constraints)
- `status` (draft/analyzing/completed)
- `results` (JSON: recommendations array)
- `estimated_improvement` (JSON: metrics)
- `created_at`, `created_by`

**`wms_slotting_moves`** -- generated move plan from a scenario
- `id`, `scenario_id`, `product_id`, `from_bin_id`, `to_bin_id`
- `quantity`, `priority`, `task_id` (FK wms_tasks, nullable -- linked when executed)
- `status` (proposed/approved/executed/skipped)

### Frontend

**AI Slotting Page** (`/inventory/wms/slotting`)
- "Run Analysis" button -> calls edge function with warehouse data
- Results view: table of recommendations with reasons, scores
- What-if: adjust weights (travel vs space vs affinity) and re-run
- "Generate Move Plan" -> creates reslot tasks in wms_tasks
- Historical scenarios list with KPI comparison

---

## Technical Summary

| Change | Details |
|--------|---------|
| **Migration SQL** | 10 new tables: `wms_zones`, `wms_aisles`, `wms_bins`, `wms_bin_stock`, `wms_tasks`, `wms_putaway_rules`, `wms_pick_waves`, `wms_pick_wave_orders`, `wms_cycle_counts`, `wms_cycle_count_lines`, `wms_slotting_scenarios`, `wms_slotting_moves`. Auto-number triggers for task_number, wave_number, count_number. RLS policies for all. Sync trigger: bin_stock changes update inventory_stock. RPCs: `generate_pick_tasks`, `execute_wms_task`. |
| **Edge function** | `wms-slotting/index.ts` -- AI-powered slotting analysis |
| **New pages** | `WmsZones.tsx`, `WmsBinDetail.tsx`, `WmsTasks.tsx`, `WmsReceiving.tsx`, `WmsPicking.tsx`, `WmsCycleCounts.tsx`, `WmsSlotting.tsx` |
| **Modified files** | `TenantLayout.tsx` (add nav items under inventory), `App.tsx` (add routes), `translations.ts` (new keys) |
| **Unchanged** | All existing inventory pages (stock overview, movements, internal orders/transfers/receipts, warehouses, cost layers, kalkulacija, nivelacija) remain untouched |

## Implementation Order

1. Migration: create all WMS tables, triggers, RLS, RPCs
2. `WmsZones.tsx` -- zone/aisle/bin management
3. `WmsTasks.tsx` -- task dashboard and execution
4. `WmsReceiving.tsx` -- inbound receiving + putaway generation
5. `WmsPicking.tsx` -- pick wave management
6. `WmsCycleCounts.tsx` -- cycle count workflow
7. `wms-slotting` edge function + `WmsSlotting.tsx` -- AI slotting
8. Routes, nav, translations


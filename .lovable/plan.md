

# WMS and Production AI Planning -- Full Implementation Upgrade

## Summary

Upgrade both modules from their current MVP state to production-grade implementations with richer UIs, more interactive workflows, better data visualization, and comprehensive operational features.

---

## Part 1: WMS Module Improvements

### Current State
- **WmsZones**: Full CRUD for zones, aisles, bins with visual grid. Solid.
- **WmsTasks**: Task list with filters and status transitions. Basic KPI cards. Missing: task creation dialog, batch assignment, worker assignment dropdown, priority editing.
- **WmsReceiving**: Create receiving with auto-putaway task generation. Missing: PO linkage, barcode/reference field, edit/cancel received items.
- **WmsPicking**: Shows pick waves and active pick tasks. Very thin -- no wave creation, no order-to-wave assignment, no pick confirmation workflow.
- **WmsCycleCounts**: Count creation and line-by-line counting. Missing: reconciliation step, variance approval, auto-adjustment of stock.
- **WmsSlotting**: AI + local analysis, scenario management, move plan. Already the most complete page.
- **WmsBinDetail**: Read-only bin view. Missing: stock adjustment, movement history, transfer action.

### Planned Improvements

#### 1. WmsTasks -- Full Task Management
- **Create Task dialog**: Manual task creation with type, warehouse, product, from/to bin, quantity, priority, notes
- **Batch operations**: Multi-select tasks for bulk assign, bulk start, bulk cancel
- **Worker assignment**: Dropdown to assign tasks to specific users (from `tenant_members`)
- **Priority editing**: Inline priority change (1-5 with labels)
- **Task detail side panel**: Click a task row to see full details including timestamps, assigned user name, exception reason
- **Performance metrics**: Average completion time, tasks per hour (calculated from completed tasks)

#### 2. WmsReceiving -- Enhanced Receiving
- **Reference fields**: PO number, supplier reference, delivery note number inputs
- **Lot/serial tracking**: Lot number and expiry date fields per receiving line
- **Receiving from Purchase Orders**: Button to import lines from pending POs (fetches from `purchase_order_lines`)
- **Quality hold option**: Toggle to place received stock in "held" status instead of "available"
- **Cancel/void receiving**: Ability to reverse a receiving by removing bin stock and marking receive tasks as cancelled

#### 3. WmsPicking -- Full Pick Workflow
- **Create Pick Wave dialog**: Select warehouse, add sales orders to wave, auto-generate pick tasks from order lines
- **Wave management**: Release, start, complete waves with status transitions
- **Pick confirmation**: Per-task confirmation dialog with actual picked quantity (partial picks supported)
- **Pick list print view**: Printable list grouped by zone for paper-based picking
- **Stats cards**: Total lines, picked lines, remaining lines, pick rate

#### 4. WmsCycleCounts -- Reconciliation & Adjustment
- **Reconcile action**: Button to finalize a count -- compares counted vs expected, calculates variance
- **Variance approval dialog**: Show variances, allow manager to approve/reject adjustments
- **Auto-adjust stock**: On approval, update `wms_bin_stock` quantities to match counted values
- **Count completion**: Mark count as "completed" after all lines counted, "reconciled" after adjustments applied
- **Variance summary cards**: Total items counted, discrepancies found, adjustment value

#### 5. WmsBinDetail -- Interactive Bin Management
- **Stock adjustment dialog**: Add/remove stock directly on a bin with reason
- **Transfer dialog**: Move stock from this bin to another bin (creates a move task)
- **Movement history tab**: Show all tasks involving this bin (from/to) with timestamps
- **Bin edit**: Inline edit of bin properties (max units, weight, accessibility score)

#### 6. New Page: WMS Dashboard (`/inventory/wms/dashboard`)
- **Warehouse-wide KPIs**: Total bins, occupied bins, utilization %, tasks pending/in-progress/completed today
- **Zone heatmap**: Color-coded zone cards showing fill level (empty/partial/full/over-capacity)
- **Active task summary**: Pie chart of task statuses, bar chart of tasks by type
- **Recent activity feed**: Last 20 task completions/exceptions
- **Quick actions**: Buttons to create receiving, pick wave, cycle count

---

## Part 2: Production AI Planning Improvements

### Current State
- **AiPlanningDashboard**: KPI cards + insights list from AI. Simple generate button.
- **AiPlanningSchedule**: Gantt bars with accept/reject/lock. No drag, no real order data display.
- **AiBottleneckPrediction**: Flat list of bottleneck cards. No filtering, no linking to actual orders.
- **AiCapacitySimulation**: 3 input parameters, before/after KPI cards. Very basic.

### Planned Improvements

#### 1. AiPlanningDashboard -- Rich Production Intelligence Hub
- **Auto-load on mount**: Fetch insights automatically instead of requiring button click (keep manual refresh option)
- **Trend charts**: Schedule adherence and utilization over time (last 30 days from production_orders history)
- **Order status breakdown**: Donut chart of orders by status (draft/in_progress/completed/cancelled)
- **Material readiness panel**: Cross-reference BOM needs vs current inventory, show red/yellow/green per upcoming order
- **Quick links to orders**: Click an insight to navigate to the affected production order
- **Refresh interval**: Auto-refresh insights every 10 minutes with timestamp showing "Last updated: X ago"

#### 2. AiPlanningSchedule -- Interactive Production Schedule
- **Load real orders**: Fetch and display actual production_orders as Gantt bars (not just AI suggestions)
- **Color coding by status**: Draft (gray), In Progress (blue), Completed (green), Late (red)
- **Date range selector**: Choose planning horizon (1 week, 2 weeks, 1 month, 3 months)
- **Order detail tooltip**: Hover on Gantt bar to see product name, BOM, quantity, assigned warehouse
- **Manual date editing**: Click order bar to open date picker for manual start/end adjustment
- **Drag priority reorder**: Drag rows to change display order / priority
- **AI overlay mode**: Toggle to show AI-suggested dates as ghost bars alongside actual dates
- **Apply selected suggestions**: Batch-apply accepted AI suggestions by updating production_orders in DB
- **Export schedule**: CSV export of current schedule view

#### 3. AiBottleneckPrediction -- Actionable Bottleneck Analysis
- **Severity filter tabs**: All / Critical / Warning / Info tabs
- **Timeline view**: Show bottlenecks on a timeline relative to order due dates
- **Linked orders panel**: Click a bottleneck to see the affected orders with links to order detail
- **Material shortage detail**: For material shortages, show current stock vs required with deficit amount
- **Action tracking**: Mark bottleneck as "acknowledged" or "resolved" (local state)
- **Auto-refresh**: Re-analyze button with loading state, plus auto-suggest when new orders are added
- **Trend indicator**: Show if bottleneck count is increasing or decreasing vs last analysis

#### 4. AiCapacitySimulation -- Advanced Scenario Builder
- **Named scenarios**: Save and compare multiple scenarios with names
- **More parameters**: Add overtime hours, outsource percentage, maintenance window adjustment, demand change %
- **Visual comparison**: Side-by-side bar charts for baseline vs scenario KPIs (using recharts)
- **Scenario history**: List of past simulations with parameters and results
- **Sensitivity analysis**: Show which parameter has the most impact on each KPI
- **Recommendation panel**: AI suggests the best scenario based on optimization goals

#### 5. New Page: Production Calendar (`/production/ai-planning/calendar`)
- **Monthly calendar view**: Show production orders as colored blocks on a calendar grid
- **Capacity indicator**: Daily capacity bar at top of each day cell
- **Drag to reschedule**: Move orders between dates
- **Filter by product/BOM/status**: Sidebar filters
- **Today marker**: Highlighted current date line

---

## Technical Details

### Files to Create (2 new pages)
1. `src/pages/tenant/WmsDashboard.tsx` -- WMS operational dashboard
2. `src/pages/tenant/AiPlanningCalendar.tsx` -- Production calendar view

### Files to Modify (10 files)
1. `src/pages/tenant/WmsTasks.tsx` -- Add create dialog, batch ops, assignment, detail panel
2. `src/pages/tenant/WmsReceiving.tsx` -- Add reference fields, lot tracking, PO import, quality hold
3. `src/pages/tenant/WmsPicking.tsx` -- Add wave creation, pick confirmation, stats, print view
4. `src/pages/tenant/WmsCycleCounts.tsx` -- Add reconciliation, variance approval, auto-adjust
5. `src/pages/tenant/WmsBinDetail.tsx` -- Add stock adjustment, transfer, movement history, edit
6. `src/pages/tenant/AiPlanningDashboard.tsx` -- Add auto-load, charts, material readiness, links
7. `src/pages/tenant/AiPlanningSchedule.tsx` -- Add real orders, date range, color coding, manual editing, apply suggestions
8. `src/pages/tenant/AiBottleneckPrediction.tsx` -- Add severity tabs, linked orders, material detail, action tracking
9. `src/pages/tenant/AiCapacitySimulation.tsx` -- Add named scenarios, more params, charts, history
10. `src/layouts/TenantLayout.tsx` -- Add WMS Dashboard nav item
11. `src/App.tsx` -- Add 2 new routes
12. `src/i18n/translations.ts` -- Add ~50 new translation keys

### No Database Changes Required
All features use existing tables: `wms_tasks`, `wms_bin_stock`, `wms_bins`, `wms_zones`, `wms_pick_waves`, `wms_pick_wave_orders`, `wms_cycle_counts`, `wms_cycle_count_lines`, `wms_putaway_rules`, `wms_slotting_scenarios`, `wms_slotting_moves`, `production_orders`, `bom_templates`, `bom_lines`, `inventory_stock`, `products`, `warehouses`, `purchase_order_lines`, `sales_order_lines`.

### No Edge Function Changes Required
The existing `production-ai-planning` and `wms-slotting` edge functions already support all needed AI actions.

### Implementation Order
Due to the scope, this will be implemented in logical batches:
1. **Batch 1**: WMS Dashboard (new) + WmsTasks improvements + WmsBinDetail improvements
2. **Batch 2**: WmsReceiving + WmsPicking + WmsCycleCounts improvements
3. **Batch 3**: AiPlanningDashboard + AiPlanningSchedule improvements
4. **Batch 4**: AiBottleneckPrediction + AiCapacitySimulation + AiPlanningCalendar (new)




# Batch 2-4: Full WMS + Production AI Planning Implementation

Complete the upgrade of all remaining WMS and Production AI Planning pages from MVP to production-grade.

---

## Batch 2: WMS Receiving, Picking, Cycle Counts

### WmsReceiving.tsx -- Enhanced Receiving
- Add **reference fields**: PO number, supplier reference, delivery note number as optional inputs in the create dialog
- Add **lot/serial tracking**: Lot number and expiry date fields per receiving line in the line-add form
- Add **Import from PO** button: Opens a dialog to select a pending purchase order (`purchase_orders` where `status = 'confirmed'`), auto-imports its `purchase_order_lines` as receiving lines
- Add **quality hold toggle**: Switch in the dialog to place received stock as `"held"` instead of `"available"` in `wms_bin_stock`
- Add **cancel/void** action: Button on recent receiving tasks to reverse -- deletes the `wms_bin_stock` entry and marks receive/putaway tasks as `"cancelled"`
- Add **stats cards** above the table: Total receivings today, pending putaways, items received this week

### WmsPicking.tsx -- Full Pick Workflow
- Add **Create Pick Wave** dialog: Select warehouse, then multi-select from confirmed sales orders (`sales_orders` where `status = 'confirmed'`), creates a `wms_pick_waves` record + `wms_pick_wave_orders` links, then auto-generates `wms_tasks` (type `"pick"`) from `sales_order_lines` by matching products to `wms_bin_stock` locations
- Add **wave status transitions**: Release (draft->released), Start (released->in_progress), Complete (in_progress->completed) buttons on each wave row
- Add **pick confirmation dialog**: Click a pick task to confirm -- enter actual picked quantity (supports partial picks), updates task status to `"completed"` and adjusts `wms_bin_stock`
- Add **stats cards**: Total pick lines, picked lines, remaining lines, pick completion rate
- Add **print pick list** button: Opens a printable view grouped by zone/aisle for paper-based picking
- Restructure layout: Full-width stats bar at top, waves table with action buttons, then active tasks table below

### WmsCycleCounts.tsx -- Reconciliation and Adjustment
- Add **reconcile button** on count sessions: Appears when all lines are counted, triggers variance calculation
- Add **variance approval dialog**: Shows each line's expected vs counted with variance amount, manager can approve/reject individual adjustments
- Add **auto-adjust stock**: On approval, updates `wms_bin_stock` quantities to match counted values via upsert
- Add **count status progression**: planned -> in_progress (when first line counted) -> completed (all lines counted) -> reconciled (adjustments applied)
- Add **variance summary cards**: Total items counted, discrepancies found, net adjustment quantity
- Add **start count** button that transitions count from planned to in_progress

---

## Batch 3: AI Planning Dashboard + Schedule

### AiPlanningDashboard.tsx -- Rich Production Intelligence Hub
- **Auto-load on mount**: Remove the requirement to click "Generate" first -- query runs automatically when tenant loads (keep manual refresh button)
- Add **order status donut chart** (recharts): Fetch `production_orders` grouped by status, show draft/in_progress/completed/cancelled breakdown
- Add **material readiness panel**: Cross-reference upcoming orders' BOM needs (via `bom_lines`) vs `inventory_stock`, show green/yellow/red indicator per order
- Add **"Last updated" timestamp**: Show relative time since last AI analysis with auto-refresh every 10 minutes
- Add **quick navigation links**: Each insight card becomes clickable, navigating to the relevant production order detail page
- Add **utilization trend mini-chart**: Small sparkline showing capacity utilization over recent orders

### AiPlanningSchedule.tsx -- Interactive Production Schedule
- **Load real orders on mount**: Fetch actual `production_orders` (non-cancelled) with product names and BOM info, display as Gantt bars using their `planned_start`/`planned_end` dates
- **Color coding by status**: Draft (gray), In Progress (blue), Completed (green), Late (red -- where planned_end < today and status != completed)
- **Date range selector**: Tabs for 1 week / 2 weeks / 1 month / 3 months horizon
- **Order detail tooltip**: Hover on Gantt bar shows product name, quantity, BOM template, status
- **AI overlay mode**: Toggle button to show AI-suggested dates as semi-transparent ghost bars alongside actual dates
- **Apply accepted suggestions**: "Apply to DB" button that batch-updates `production_orders.planned_start` and `planned_end` for all accepted suggestions
- **Export schedule**: CSV download button with order number, product, planned start/end, status columns

---

## Batch 4: Bottleneck, Simulation, Calendar

### AiBottleneckPrediction.tsx -- Actionable Analysis
- Add **severity filter tabs**: All / Critical / Warning / Info using Tabs component
- Add **material shortage detail**: For material shortages, show current stock qty vs required qty with deficit amount
- Add **action tracking**: Local state to mark bottlenecks as "acknowledged" or "resolved" with visual indicator
- Add **linked orders section**: Click a bottleneck to expand and see affected order numbers as clickable links to `/production/orders/:id`
- Add **trend indicator**: Badge showing bottleneck count vs previous analysis (up/down/same)
- Add **auto-analyze on mount**: Load bottleneck analysis automatically (keep manual re-analyze button)

### AiCapacitySimulation.tsx -- Advanced Scenario Builder
- Add **named scenarios**: Text input for scenario name, save results to local state array for comparison
- Add **more parameters**: Overtime hours (0-8), outsource percentage (0-100%), maintenance window days, demand change percentage
- Add **visual comparison chart**: Side-by-side grouped bar chart (recharts) comparing baseline vs scenario KPIs
- Add **scenario history list**: Scrollable list of past simulations with name, timestamp, and key metrics summary
- Add **AI recommendation panel**: After simulation, AI suggests which parameter changes yield the best outcome
- Add **clear/reset** button to start fresh

### AiPlanningCalendar.tsx -- New Production Calendar Page
- **Monthly calendar grid**: CSS grid showing days of the month with production orders as colored blocks
- **Capacity indicator**: Small progress bar at top of each day cell showing orders-that-day vs daily capacity
- **Color coding**: Same status colors as schedule (gray/blue/green/red)
- **Filter sidebar**: Filter by product, BOM template, or status
- **Today marker**: Highlighted border on current date
- **Click to view**: Click an order block to navigate to order detail
- **Month navigation**: Previous/next month buttons with current month/year header

---

## Routing and Navigation

- Add route `/production/ai-planning/calendar` -> `AiPlanningCalendar` in `App.tsx`
- Add "Production Calendar" nav item in `TenantLayout.tsx` production AI Planning section

## Translation Keys (~40 new keys)

New keys needed for both `en` and `sr`:

| Key | English | Serbian |
|-----|---------|---------|
| importFromPo | Import from PO | Uvezi iz nabavke |
| supplierReference | Supplier Reference | Referenca dobavljaca |
| deliveryNote | Delivery Note | Otpremnica |
| lotNumber | Lot Number | Broj serije |
| expiryDate | Expiry Date | Rok trajanja |
| qualityHold | Quality Hold | Zadrzavanje kvaliteta |
| cancelReceiving | Cancel Receiving | Ponisti prijem |
| createPickWave | Create Pick Wave | Kreiraj talas |
| releaseWave | Release Wave | Pusti talas |
| startWave | Start Wave | Pokreni talas |
| completeWave | Complete Wave | Zavrsi talas |
| confirmPick | Confirm Pick | Potvrdi izbor |
| actualQuantity | Actual Quantity | Stvarna kolicina |
| printPickList | Print Pick List | Stampaj listu |
| pickCompletion | Pick Completion | Zavrsenost |
| reconcile | Reconcile | Uskladjivanje |
| approveAdjustment | Approve Adjustment | Odobri korekciju |
| varianceSummary | Variance Summary | Pregled razlika |
| discrepancies | Discrepancies | Odstupanja |
| netAdjustment | Net Adjustment | Neto korekcija |
| startCount | Start Count | Zapocni brojanje |
| materialReadiness | Material Readiness | Spremnost materijala |
| lastUpdated | Last Updated | Poslednje azuriranje |
| orderStatusBreakdown | Order Status | Status naloga |
| dateRange | Date Range | Vremenski okvir |
| oneWeek | 1 Week | 1 nedelja |
| twoWeeks | 2 Weeks | 2 nedelje |
| oneMonth | 1 Month | 1 mesec |
| threeMonths | 3 Months | 3 meseca |
| showAiOverlay | Show AI Overlay | Prikazi AI predlog |
| applyAccepted | Apply Accepted | Primeni prihvacene |
| exportCsv | Export CSV | Izvezi CSV |
| acknowledged | Acknowledged | Primljeno k znanju |
| resolved | Resolved | Reseno |
| scenarioName | Scenario Name | Naziv scenarija |
| overtimeHours | Overtime Hours | Prekovremeni sati |
| outsourcePercent | Outsource % | Procenat podugovaranja |
| maintenanceDays | Maintenance Days | Dani odrzavanja |
| demandChange | Demand Change % | Promena potraznje % |
| scenarioHistory | Scenario History | Istorija scenarija |
| productionCalendar | Production Calendar | Proizvodni kalendar |
| dailyCapacity | Daily Capacity | Dnevni kapacitet |

## Files to Create (1)
1. `src/pages/tenant/AiPlanningCalendar.tsx`

## Files to Modify (9)
1. `src/pages/tenant/WmsReceiving.tsx` -- Reference fields, PO import, lot tracking, quality hold, cancel
2. `src/pages/tenant/WmsPicking.tsx` -- Wave creation, status transitions, pick confirmation, stats, print
3. `src/pages/tenant/WmsCycleCounts.tsx` -- Reconciliation, variance approval, stock adjustment, status flow
4. `src/pages/tenant/AiPlanningDashboard.tsx` -- Auto-load, donut chart, material readiness, trend, timestamps
5. `src/pages/tenant/AiPlanningSchedule.tsx` -- Real orders, color coding, date range, AI overlay, apply, export
6. `src/pages/tenant/AiBottleneckPrediction.tsx` -- Severity tabs, material detail, action tracking, auto-load
7. `src/pages/tenant/AiCapacitySimulation.tsx` -- Named scenarios, more params, bar charts, history, recommendation
8. `src/layouts/TenantLayout.tsx` -- Add calendar nav item
9. `src/App.tsx` -- Add calendar route
10. `src/i18n/translations.ts` -- Add ~40 new keys

## No Database or Edge Function Changes Required
All features use existing tables and the existing `production-ai-planning` edge function.


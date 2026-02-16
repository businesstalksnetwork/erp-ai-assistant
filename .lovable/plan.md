
# AI-First BI Redesign -- Phased Transformation Plan

This plan transforms the entire ERP into a modern, AI-first Business Intelligence platform across 5 phases. Each phase is self-contained and delivers value immediately.

---

## Phase 1: Foundation -- Layout, AI Sidebar, and Design System (8-10 files)

### 1A. Contextual AI Insights Right Sidebar
Currently the AI assistant is a floating button that opens a Sheet overlay. The AI insights (`AiModuleInsights`, `AiAnalyticsNarrative`) are inline cards taking main content space.

**Change:** Add an optional right sidebar to `TenantLayout.tsx` that:
- Is collapsible (toggle button in header) -- defaults to open on desktop, closed on mobile
- Renders route-aware AI content: detects the current module from URL and shows relevant insights
- Contains 3 sections stacked vertically:
  - **AI Insights** (module-specific anomalies/alerts from `ai-insights` edge function)
  - **AI Narrative** (contextual summary from `ai-analytics-narrative`)
  - **Quick Ask** (inline mini-chat, reusing the streaming logic from `AiAssistantPanel`)
- On mobile: collapses to a bottom drawer or remains as the floating button

**Layout change:**
```
[Left Sidebar | Main Content Area | AI Right Sidebar (280px)]
```

The main content area gets full width when AI sidebar is collapsed.

**Files:**
- `src/layouts/TenantLayout.tsx` -- add right sidebar panel with toggle
- `src/components/ai/AiContextSidebar.tsx` -- new component: route-aware AI panel
- `src/components/ai/AiAssistantPanel.tsx` -- refactor streaming logic into reusable hook
- `src/hooks/useAiStream.ts` -- new: extracted streaming chat hook

### 1B. Enhanced StatsBar with Sparklines and Trends
The current `StatsBar` shows flat numbers. Upgrade to show:
- Mini sparkline (last 6 data points) inside each KPI card
- Trend arrow with % change vs prior period
- Subtle color-coded left border (green/red/neutral) based on trend direction
- Click-to-expand for detail (reusing the dialog pattern from FinancialRatios)

**Files:**
- `src/components/shared/StatsBar.tsx` -- enhanced with sparklines, trend data
- `src/components/shared/MiniSparkline.tsx` -- new: tiny SVG sparkline component (no library needed, ~30 lines)

### 1C. Page Layout Template
Create a standardized BI page layout component that all pages will adopt:
- `PageHeader` with icon + description + action buttons (already exists, minor enhancement)
- `StatsBar` row (KPIs)
- Main content grid (charts/tables)
- AI insights go to the right sidebar (not inline)

**Files:**
- `src/components/shared/BiPageLayout.tsx` -- new: wraps the standard layout pattern

---

## Phase 2: Dashboard and Analytics Overhaul (12-15 files)

### 2A. Main Dashboard Redesign
The current dashboard has basic KPI cards and charts stacked vertically. Redesign to:
- **Hero KPI strip** with sparklines (revenue, expenses, profit, cash) -- clickable to drill-down
- **Interactive chart grid** (2x2) with period selector (7d/30d/90d/YTD) that updates all charts
- **Pending actions** becomes a compact notification-style strip (not a full card)
- **Quick actions** become contextual action buttons in the header area
- Remove inline `AiInsightsWidget` and `FiscalReceiptStatusWidget` from main flow -- move to right sidebar

**Files:**
- `src/pages/tenant/Dashboard.tsx` -- full redesign
- `src/components/dashboard/PeriodSelector.tsx` -- new: shared date range control
- `src/components/dashboard/KpiHeroStrip.tsx` -- new: enhanced KPI row with sparklines

### 2B. Analytics Dashboard
Enhance with:
- Tabbed view: Financial / Operations / Risk / Forecast
- Each tab has its own chart grid with interactive tooltips showing AI-generated explanations
- Drill-down: clicking any chart metric navigates to the detailed page

**Files:**
- `src/pages/tenant/AnalyticsDashboard.tsx` -- tabbed redesign with navigation

### 2C. All Analytics Detail Pages (10 pages)
Apply consistent BI layout to:
- `WorkingCapitalStress` -- add gauge visualizations, scenario toggles
- `MarginBridge` -- waterfall chart (already has data, needs visual upgrade)
- `VatCashTrap` -- timeline visualization with risk zones
- `InventoryHealth` -- heatmap-style stock health matrix
- `CustomerRiskScoring` -- risk matrix scatter plot
- `SupplierDependency` -- dependency tree/network visualization
- `EarlyWarningSystem` -- traffic-light dashboard with trend arrows
- `CashFlowForecast` -- area chart with confidence bands
- `BudgetVsActuals` -- variance bars with drill-down
- `BreakEvenAnalysis` -- interactive slider for what-if scenarios

Each page: remove inline AI cards (moved to sidebar), add interactive charts, consistent StatsBar with trends.

---

## Phase 3: Operational Pages -- Tables to Smart Views (15-20 files)

### 3A. Smart Table Component
Create a reusable data table that all list pages (Invoices, Employees, Products, etc.) will use:
- Column sorting, filtering, search built-in
- Inline status badges with color coding
- Row hover shows a mini-preview popover (key fields)
- Summary footer row (totals, averages)
- Responsive: on mobile, collapses to card view
- Built on top of existing `Table` component

**Files:**
- `src/components/shared/SmartTable.tsx` -- new: enhanced table wrapper
- `src/components/shared/SmartTableMobileCard.tsx` -- new: card view for mobile

### 3B. List Pages with KPI Headers
Add KPI summary strips to all major list pages:
- **Invoices**: Total outstanding, paid this month, overdue amount, avg payment days
- **Employees**: Total headcount, by department breakdown, avg tenure, upcoming leaves
- **Products**: Total SKUs, low stock count, top seller, inventory value
- **Inventory Stock**: Total value, items below min, turnover rate, dead stock count
- **Leads/Opportunities**: Pipeline value, conversion rate, avg deal size, stale count
- **Production Orders**: Active orders, completion rate, late orders, capacity %

Each list page gets a `StatsBar` at the top with relevant computed KPIs.

**Files:** ~15 list pages (Invoices, Employees, Products, InventoryStock, Leads, Opportunities, PurchaseOrders, SalesOrders, JournalEntries, Contacts, Companies, ProductionOrders, Payroll, FixedAssets, WorkLogs)

### 3C. Responsive Optimization
- All grids use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` pattern
- Charts get responsive height (`h-[200px] sm:h-[260px] lg:h-[320px]`)
- Tables collapse to card view on mobile via SmartTable
- AI sidebar auto-hides on screens < 1280px

---

## Phase 4: CRM, Production, and HR Intelligence (10-12 files)

### 4A. CRM Dashboard
- Pipeline visualization as horizontal funnel with values at each stage
- Win/loss trend chart with AI commentary
- Lead aging heatmap
- Sales forecasting chart (AI-predicted close probability)

**Files:**
- `src/pages/tenant/CrmDashboard.tsx` -- enhanced BI view
- `src/components/crm/PipelineFunnel.tsx` -- new: visual funnel

### 4B. Production AI Dashboard
- Gantt-style schedule view with color-coded status
- Capacity utilization gauge (radial chart)
- Material availability matrix
- AI bottleneck predictions shown as timeline markers

**Files:**
- `src/pages/tenant/AiPlanningDashboard.tsx` -- enhanced
- `src/components/production/CapacityGauge.tsx` -- new: radial gauge

### 4C. HR Analytics
- Headcount trend over time
- Department distribution donut
- Leave utilization chart
- Payroll cost trend with AI benchmark insights
- Turnover/retention metrics

**Files:**
- `src/pages/tenant/HrReports.tsx` -- enhanced BI view
- `src/pages/tenant/PayrollBenchmark.tsx` -- enhanced with trends

### 4D. WMS Dashboard
- Zone utilization heatmap
- Task completion rate by type (bar chart)
- Picking efficiency metrics
- Real-time task queue visualization

**Files:**
- `src/pages/tenant/WmsDashboard.tsx` -- enhanced

---

## Phase 5: Polish, Animations, and Dark Mode Refinement (5-8 files)

### 5A. Micro-interactions
- Card hover: subtle lift + shadow
- Number animations: count-up effect on KPI values using `framer-motion` (already installed)
- Chart transitions: smooth data updates
- Page transitions: fade-in with slight upward slide (already partially implemented)

### 5B. Dark Mode Audit
- Verify all chart colors work in dark mode (use CSS variables, not hardcoded HSL)
- Ensure AI sidebar has proper dark mode contrast
- Fix any badge/status color issues in dark mode

### 5C. Print Optimization
- BI pages render clean printable layouts
- Charts render at appropriate sizes for print
- AI sidebar hidden in print

**Files:**
- `src/index.css` -- animation utilities, print rules
- `src/components/shared/AnimatedNumber.tsx` -- new: count-up component
- Various chart components -- use CSS variable colors

---

## Implementation Priority

| Phase | Scope | Impact |
|-------|-------|--------|
| Phase 1 | Layout + AI Sidebar + Foundation | Highest -- sets the stage for everything |
| Phase 2 | Dashboards + Analytics | High -- most visible pages |
| Phase 3 | Smart Tables + List Pages | Medium-High -- everyday workflow |
| Phase 4 | CRM + Production + HR | Medium -- module-specific |
| Phase 5 | Polish + Animations | Medium -- quality feel |

---

## Technical Notes

- All new components follow existing patterns: `useLanguage()` for i18n, `useTenant()` for tenant isolation, `useQuery` for data fetching
- Charts continue using `recharts` (already installed)
- Animations use `framer-motion` (already installed)
- AI sidebar reuses existing edge functions (`ai-insights`, `ai-analytics-narrative`, `ai-assistant`)
- No new dependencies required
- The right AI sidebar is a layout-level change in `TenantLayout.tsx` -- all pages benefit automatically
- Responsive breakpoints: mobile (<768), tablet (768-1279), desktop (1280+)
- AI insights removed from inline page content and centralized in the sidebar -- pages become cleaner and more focused on data

---

## Starting Point

I recommend starting with **Phase 1** as it creates the foundation (AI sidebar, enhanced StatsBar, layout template) that all subsequent phases build on. Shall I begin?

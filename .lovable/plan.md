

# Phase: Complete UX/UI Redesign + Cross-Module Logic Integration

## Overview

Redesign the entire application UX/UI for a modern, polished ERP experience. Move Settings to the bottom of the sidebar, add charts and AI-powered analytics across all module dashboards, and wire up cross-module dependencies (CRM -> Invoices, Inventory -> POS, HR -> Payroll, etc.) so data flows coherently through the system.

---

## Part 1: Sidebar & Layout Redesign

### 1.1 Move Settings to Bottom of Sidebar
- Move the Settings collapsible group out of the scrollable nav area
- Place it as a fixed-bottom section in the sidebar (above user profile area)
- Add a visual separator between main modules and settings

### 1.2 Sidebar Visual Polish
- Add module-specific color accents (small colored dot or left-border for each group)
- Add item count badges on key nav items (e.g., Leads badge showing "new" count, Opportunities showing pipeline count)
- Add a compact search/command palette trigger (Ctrl+K) at the top of the sidebar
- Better spacing between groups, smaller font for section labels
- Smooth transitions when collapsing/expanding groups

### 1.3 Header Redesign
- Add breadcrumbs showing current location (e.g., CRM > Contacts > Detail)
- Move language toggle into user dropdown menu to declutter header
- Add a global search input in the header (searches across all modules)
- Add a "recent pages" dropdown for quick navigation

### 1.4 Main Content Area
- Add subtle page transition animations (fade-in)
- Consistent page header pattern: title + description + action buttons row
- Standardize card spacing and grid layouts across all pages

---

## Part 2: Dashboard Overhaul (Main + Module Dashboards)

### 2.1 Main Dashboard Enhancements
- Add a "welcome back" greeting with user name and today's date
- Add a weekly/monthly trend indicator (arrow up/down + percentage) on each KPI card
- Add new charts:
  - Cash flow trend (line chart, 6 months)
  - Accounts receivable aging (stacked bar chart)
  - Top 5 customers by revenue (horizontal bar)
- Add role-based quick action buttons (accountant sees different actions than sales)
- Add a "Module Health" summary showing key metrics from each accessible module
- Make the AI Insights widget more prominent with a gradient card background

### 2.2 CRM Dashboard Charts
- Lead funnel visualization (funnel chart or stacked bar by status)
- Opportunity pipeline value by stage (horizontal stacked bar)
- Lead conversion trend over time (line chart, last 6 months)
- Win/loss ratio pie chart
- Top contacts by opportunity value
- Recent activity timeline

### 2.3 Module-Specific Mini-Dashboards
Each list page gets a stats bar at the top:
- **Contacts**: Total, by type distribution (small pie), recently added count
- **Companies**: Total, by category distribution, active vs archived
- **Leads**: Funnel mini-chart, conversion rate, new this week
- **Opportunities**: Pipeline value summary, win rate, avg deal size
- **Meetings**: Today's agenda cards, weekly view, channel distribution
- **Inventory**: Stock value total, low stock alerts, movement trends
- **HR**: Headcount, department distribution, upcoming leave

---

## Part 3: AI Integration Across Modules

### 3.1 AI Insights Per Module
Extend the existing `ai-insights` edge function to accept a `module` parameter and return module-specific insights:
- **CRM**: "3 leads haven't been contacted in 7+ days", "Opportunity X expected close date is past due"
- **Accounting**: "Revenue declined 12% vs last month", "5 invoices overdue > 30 days"
- **Inventory**: "Product X stock will run out in ~5 days based on movement trend"
- **HR**: "3 employee contracts expiring in 30 days"

### 3.2 AI-Powered Suggestions on Detail Pages
- **Opportunity Detail**: AI suggests next action based on stage and history
- **Contact Detail**: AI summarizes interaction history
- **Dashboard**: AI generates a daily briefing summary

### 3.3 AI Assistant Context Awareness
- Update the AI assistant panel to be context-aware (knows which page user is on)
- Pre-populate suggested questions based on current module
- Show relevant data previews in responses

---

## Part 4: Cross-Module Logic Connections

### 4.1 CRM -> Accounting
- When creating an Invoice, allow selecting a CRM Company/Contact as the customer
- "Create Invoice" button on Opportunity Detail (when stage = closed_won)
- Link company_id on invoices to CRM companies table
- Show linked invoices on Company Detail page (new Invoices tab)

### 4.2 CRM -> Inventory
- When creating a Quote/Sales Order from an Opportunity, allow picking products from inventory
- Show stock availability inline when selecting products
- Auto-create inventory movements when Sales Order is fulfilled

### 4.3 Inventory -> Purchasing
- "Reorder" button on low-stock items that pre-fills a Purchase Order
- Link purchase orders to inventory products
- When Goods Receipt is confirmed, auto-update inventory stock

### 4.4 HR -> Accounting
- Link payroll runs to journal entries (auto-generate salary expense entries)
- Department cost allocation from HR departments to cost centers

### 4.5 DMS -> All Modules
- Allow attaching documents to any entity (invoice, PO, employee, company, contact)
- "Attach Document" button pattern reusable across modules
- Show attached documents count badge on entity rows

### 4.6 Activity Log Cross-Module
- Extend the activities table to log actions across all modules
- Show a unified activity timeline on the main dashboard
- Filter activities by module, user, date range

---

## Part 5: Role-Based UI Refinements

### 5.1 Dashboard Per Role
- **Admin**: Full dashboard with all modules, system health, user activity
- **Accountant**: Accounting-focused dashboard (revenue, expenses, AR/AP, bank balance)
- **Sales**: CRM-focused dashboard (pipeline, leads, meetings today, quotes pending)
- **HR**: HR-focused dashboard (headcount, leave requests, expiring contracts)
- **User**: Simplified dashboard (assigned tasks, documents, POS shortcut)

### 5.2 Granular Permission Checks
- Add `canCreate`, `canEdit`, `canDelete` helpers to usePermissions (not just canAccess)
- Hide action buttons (Add, Edit, Delete) based on granular permissions
- Show read-only views when user has view-only access

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/layout/Breadcrumbs.tsx` | Dynamic breadcrumb component using route location |
| `src/components/layout/GlobalSearch.tsx` | Command palette (Ctrl+K) searching across all modules |
| `src/components/dashboard/CashFlowChart.tsx` | Cash flow trend line chart |
| `src/components/dashboard/TopCustomersChart.tsx` | Top 5 customers horizontal bar |
| `src/components/dashboard/ModuleHealthSummary.tsx` | Cross-module health indicators |
| `src/components/dashboard/WelcomeHeader.tsx` | Greeting + date + role-specific summary |
| `src/components/crm/LeadFunnelChart.tsx` | Lead funnel/conversion visualization |
| `src/components/crm/OpportunityPipelineChart.tsx` | Pipeline value by stage chart |
| `src/components/crm/ConversionTrendChart.tsx` | Conversion rate over time line chart |
| `src/components/crm/WinLossChart.tsx` | Won vs lost pie chart |
| `src/components/crm/RecentActivityTimeline.tsx` | Activity timeline for CRM dashboard |
| `src/components/shared/StatsBar.tsx` | Reusable stats bar pattern for list pages |
| `src/components/shared/AiModuleInsights.tsx` | Module-specific AI insights widget |
| `src/components/shared/PageHeader.tsx` | Standardized page header (title, description, actions) |
| `src/components/shared/EntityDocuments.tsx` | Reusable document attachment component |

## Files to Modify

| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Major redesign: settings at bottom, breadcrumbs, search, header polish, nav badges, language toggle moved |
| `src/pages/tenant/Dashboard.tsx` | Add welcome header, new charts, module health, role-based quick actions, trend indicators |
| `src/pages/tenant/CrmDashboard.tsx` | Add 5 new charts, activity timeline, enhanced stats cards |
| `src/pages/tenant/Contacts.tsx` | Add stats bar, type distribution mini-chart, improved filters UI |
| `src/pages/tenant/Companies.tsx` | Add stats bar, category distribution, invoices tab link |
| `src/pages/tenant/Leads.tsx` | Add conversion funnel mini-chart, stats bar, AI insights |
| `src/pages/tenant/Opportunities.tsx` | Add pipeline chart header, win rate stats, enhanced Kanban cards |
| `src/pages/tenant/Meetings.tsx` | Add channel distribution chart, today's agenda cards, weekly calendar |
| `src/pages/tenant/OpportunityDetail.tsx` | Add "Create Invoice" action for closed_won, AI next-action suggestion |
| `src/pages/tenant/CompanyDetail.tsx` | Add Invoices tab, linked accounting data |
| `src/pages/tenant/Settings.tsx` | Visual refresh with grouped sections |
| `src/index.css` | Add subtle animation utilities, improved card hover effects, gradient utilities |
| `src/config/rolePermissions.ts` | Add granular CRUD permissions per module |
| `src/hooks/usePermissions.ts` | Add canCreate, canEdit, canDelete helpers |
| `src/i18n/translations.ts` | Add ~50 new keys for UI labels, breadcrumbs, chart titles |
| `supabase/functions/ai-insights/index.ts` | Accept module parameter, return module-specific insights |

---

## Technical Details

### Sidebar Settings at Bottom

```text
Current layout:
  [Logo]
  [Dashboard]
  [CRM group]
  [Purchasing group]
  ...
  [Settings group]  <-- mixed in with other modules

New layout:
  [Logo]
  [Search trigger]
  [Dashboard]
  [CRM group]
  [Purchasing group]
  [Returns group]
  [HR group]
  [Inventory group]
  [Accounting group]
  [Production group]
  [Documents group]
  [POS group]
  ---- flex spacer ----
  [Settings group]   <-- fixed at bottom
  [User profile]     <-- fixed at bottom
```

### Role-Based Dashboard Content

```text
Role "admin"      -> Full dashboard (all charts + all modules)
Role "accountant" -> Accounting KPIs + AR aging + invoice status + bank
Role "sales"      -> CRM pipeline + lead funnel + today's meetings + quotes
Role "hr"         -> Headcount + leave requests + contracts expiring
Role "user"       -> Simple: tasks + documents + POS shortcut
```

### Cross-Module Invoice Link

```text
CompanyDetail -> new tab "Invoices"
  Query: invoices where partner.pib = company.pib OR invoices.company_id = company.id
  Show: invoice_number, date, total, status

OpportunityDetail (stage = closed_won):
  Button: "Create Invoice" ->
    Navigate to /accounting/invoices/new?opportunity_id={id}&contact_id={contact_id}
    InvoiceForm reads query params, pre-fills customer and amount
```

### AI Insights Module Parameter

```text
Edge function accepts: { tenant_id, language, module? }
  module = "crm"        -> analyze leads, opportunities, contacts
  module = "accounting"  -> analyze invoices, journal entries, cash flow
  module = "inventory"   -> analyze stock levels, movement trends
  module = "hr"          -> analyze contracts, leave, attendance
  module = undefined     -> return top insights across all modules (current behavior)
```

### Granular Permissions Extension

```text
Current: canAccess(module) -> boolean
New: canAccess(module) + canCreate(module) + canEdit(module) + canDelete(module)

rolePermissions extended:
  admin:      { crm: { view: true, create: true, edit: true, delete: true } }
  sales:      { crm: { view: true, create: true, edit: true, delete: false } }
  user:       { crm: { view: false } }
```

### Stats Bar Pattern (Reusable)

```text
StatsBar component receives:
  stats: Array<{ label: string, value: string|number, icon: LucideIcon, trend?: number }>
Renders a compact horizontal bar of mini stat cards above the main content
Used on: Contacts, Companies, Leads, Opportunities, Meetings, Products, Employees
```

### Global Search (Command Palette)

```text
Ctrl+K opens a cmdk-based command palette
Searches across:
  - Navigation items (jump to page)
  - Recent entities (contacts, companies, invoices by name/number)
  - Actions (create invoice, add lead, etc.)
Uses existing cmdk dependency (already installed)
```


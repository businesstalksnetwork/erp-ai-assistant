

# AI-Powered Insights for Inventory, HR, and CRM Modules

## Task 1: Inventory Stock Page -- AI Insights + Reorder Suggestions

### File: `src/pages/tenant/InventoryStock.tsx`

**Add AiModuleInsights widget:**
- Import `AiModuleInsights` from `@/components/shared/AiModuleInsights`
- Place it between the page header and the stock table Card, conditioned on `tenantId`
- Pass `module="inventory"` so it shows only zero_stock and low_stock insights

**Add smart reorder alert:**
- Compute `lowStockItems` from the existing `filtered` array (items where `onHand < minLevel`)
- Import `AiAnalyticsNarrative` from `@/components/ai/AiAnalyticsNarrative`
- Pass inventory summary data to the narrative component with `contextType="dashboard"`:
  - `{ lowStockCount, zeroStockCount, totalSKUs, topLowStock: [{name, sku, onHand, minLevel}] }`
- This lets the LLM generate reorder point suggestions and prioritization advice
- Only render when there are low/zero stock items

### File: `supabase/functions/ai-insights/index.ts`

**Add inventory-specific insights:**
- Add a new section gated by `if (!module || module === "inventory")` (similar to the analytics block):
  - **Slow movers**: Query `inventory_movements` for the last 90 days, find products with zero outbound movements but positive stock -- flag as "slow moving inventory"
  - **Reorder suggestion**: For items below min stock level, compute average daily consumption from movements and suggest reorder quantities
- Add `"slow_moving"` and `"reorder_suggestion"` to the inventory filter list in `moduleMap`

---

## Task 2: HR Reports Page -- AI Insights + Payroll Anomaly Alerts

### File: `src/pages/tenant/HrReports.tsx`

**Add AiModuleInsights widget:**
- Import `AiModuleInsights` from `@/components/shared/AiModuleInsights`
- Place it after the filter controls (year/month inputs), before the Tabs
- Pass `module="hr"` so it shows payroll_anomaly insights

**Add payroll anomaly detection alert (similar to Budget vs Actuals):**
- Compute anomalies from the existing `monthlyReport` data:
  - Employees with overtime > 40 hours in a month (excessive overtime)
  - Employees with 0 total hours (missing work logs)
- Import `Alert, AlertDescription` from `@/components/ui/alert` and `AlertTriangle` from `lucide-react`
- Show a destructive Alert banner listing employees with anomalies
- Import `AiAnalyticsNarrative` and pass HR summary data with `contextType="dashboard"`:
  - `{ employeeCount, totalHours, totalOvertime, excessiveOvertimeCount, missingLogsCount, avgHoursPerEmployee }`

### File: `supabase/functions/ai-insights/index.ts`

**Add HR-specific insights:**
- Add a section gated by `if (!module || module === "hr")`:
  - **Excessive overtime**: Query `overtime_hours` for current month, flag employees with > 40 hours
  - **Leave balance warnings**: Query `annual_leave_balances` for current year, flag employees with remaining days < 3 (use-it-or-lose-it warning)
- Add `"excessive_overtime"`, `"leave_balance_warning"` to the hr filter list in `moduleMap`

---

## Task 3: CRM Dashboard -- AI Sales Recommendations

### File: `src/pages/tenant/CrmDashboard.tsx`

**Enhance existing AiModuleInsights:**
- Already has `<AiModuleInsights tenantId={tenantId} module="crm" />` -- no change needed there

**Add AI sales narrative:**
- Import `AiAnalyticsNarrative` from `@/components/ai/AiAnalyticsNarrative`
- Place it after the StatsBar and AiModuleInsights, before the charts
- Pass CRM KPIs with `contextType="planning"` (which returns recommendations):
  - `{ totalLeads, convertedLeads, conversionRate, pipelineValue, openDeals: openOpps.length, winRate, wonCount: wonOpps.length, lostCount: lostOpps.length, topKomCount: topKom.length }`
- The `contextType: "planning"` prompt in the edge function already generates actionable recommendations, making it suitable for sales strategy advice

### File: `supabase/functions/ai-insights/index.ts`

**Add CRM-specific insights:**
- Add a section gated by `if (!module || module === "crm")`:
  - **Stale leads**: Query `leads` with `status = 'new'` and `created_at` older than 14 days -- flag as untouched leads
  - **High-value at risk**: Query `opportunities` with `stage = 'negotiation'` and large value but no `updated_at` in 7+ days
- Add `"stale_leads"`, `"high_value_at_risk"` to the crm filter list in `moduleMap`

---

## Summary of Files to Modify

| File | Changes |
|---|---|
| `src/pages/tenant/InventoryStock.tsx` | Add AiModuleInsights + AiAnalyticsNarrative for reorder suggestions |
| `src/pages/tenant/HrReports.tsx` | Add AiModuleInsights + Alert banner for overtime/missing logs + AiAnalyticsNarrative |
| `src/pages/tenant/CrmDashboard.tsx` | Add AiAnalyticsNarrative with CRM KPIs using "planning" context |
| `supabase/functions/ai-insights/index.ts` | Add inventory (slow movers, reorder), HR (excessive overtime, leave warnings), and CRM (stale leads, high-value at risk) insight checks; update moduleMap |

No new files needed -- all changes use existing components and the existing edge function infrastructure.

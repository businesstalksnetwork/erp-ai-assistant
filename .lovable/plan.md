

# Improve AI Insights and AI Analysis on Dashboard

## Problems Identified

1. **AI Analiza shows generic template text**: The sidebar passes `data={{}}` (empty object) to `AiAnalyticsNarrative`, so the AI model receives no actual metrics and responds with a placeholder asking the user to fill in values.

2. **AI Uvidi in sidebar shows only 2 items**: The `AiModuleInsights` component in `compact` mode slices to only 2 insights (`insights.slice(0, 2)`). The user wants ALL insights visible.

3. **AI Uvidi items are not clickable**: Each insight type (overdue invoices, low stock, stale leads, etc.) should link to the relevant page where the user can take action.

4. **AI Analiza lacks actionable fix suggestions**: The narrative should also return specific recommendations on how to fix the issues it identifies.

---

## Solution

### 1. Fix AI Analiza in Sidebar -- Pass Real Data

**File: `src/components/ai/AiContextSidebar.tsx`**

The sidebar currently passes `data={{}}` to the `AiAnalyticsNarrative` component. Instead, it needs to fetch the actual dashboard KPI data and pass it through. We'll create a small hook or inline query that fetches the same KPI metrics the Dashboard uses (revenue, expenses, gross margin, current ratio, DSO, debt-to-equity) and passes them to the narrative component.

- Add a `useQuery` call in the sidebar to fetch summarized financial metrics
- Pass those metrics as `data` to `AiAnalyticsNarrative`

### 2. Show ALL AI Uvidi in Sidebar

**File: `src/components/shared/AiModuleInsights.tsx`**

- Remove the `compact` slicing logic (`insights.slice(0, 2)`) -- show all insights regardless of compact mode
- In compact mode, just hide descriptions but still show all titles
- Add a `ScrollArea` wrapper if the list gets long

### 3. Make AI Uvidi Clickable with Navigation

**File: `src/components/shared/AiModuleInsights.tsx`** and **`src/components/ai/AiInsightsWidget.tsx`**

Add a mapping from `insight_type` to route, then wrap each insight in a clickable link:

```text
insight_type          ->  route
─────────────────────────────────────
overdue_invoices      ->  /accounting/invoices
large_invoices        ->  /accounting/invoices
zero_stock            ->  /inventory/stock
low_stock             ->  /inventory/stock
draft_journals        ->  /accounting/journal
payroll_anomaly       ->  /hr/payroll
excessive_overtime    ->  /hr/overtime
leave_balance_warning ->  /hr/annual-leave
stale_leads           ->  /crm/leads
high_value_at_risk    ->  /crm/opportunities
budget_variance       ->  /analytics/budget
revenue_declining     ->  /analytics
slow_moving           ->  /analytics/inventory-health
reorder_suggestion    ->  /purchasing/orders
```

Each insight row becomes a clickable element with hover state and a small arrow icon, navigating to the relevant page.

### 4. Add Actionable Recommendations to AI Analiza

**File: `supabase/functions/ai-analytics-narrative/index.ts`**

Update the system prompts to always request both a narrative summary AND 2-3 specific actionable recommendations. Change the response format to always return `{ narrative, recommendations }`.

Update the prompt suffix from "Provide your analysis" to "Provide your analysis as a JSON object with 'narrative' (2-3 sentences) and 'recommendations' (array of 2-3 specific action items the user should take)."

**File: `src/components/ai/AiAnalyticsNarrative.tsx`**

The component already renders recommendations -- it just needs to always show them (currently only shown for `planning` context). Remove the `isPlanning` gate so recommendations render for all context types.

---

## Files Modified

1. **`src/components/ai/AiContextSidebar.tsx`** -- Add data-fetching query for narrative context; pass real metrics to `AiAnalyticsNarrative`
2. **`src/components/shared/AiModuleInsights.tsx`** -- Remove `slice(0, 2)` limit; add `insight_type` to route mapping; make items clickable with `useNavigate`
3. **`src/components/ai/AiInsightsWidget.tsx`** -- Add clickable navigation to insight items; remove the `slice(0, 5)` limit to show all
4. **`src/components/ai/AiAnalyticsNarrative.tsx`** -- Remove `isPlanning` gate so recommendations always render; improve styling
5. **`supabase/functions/ai-analytics-narrative/index.ts`** -- Update all system prompts to request both narrative + recommendations; parse response as JSON with both fields

## Technical Notes

- The insight-type-to-route mapping will be a shared constant used by both `AiModuleInsights` and `AiInsightsWidget`
- Navigation uses `useNavigate` from react-router-dom
- The edge function prompt change ensures AI always returns actionable steps
- No new dependencies needed

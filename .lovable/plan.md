

# Sidebar Reorganization and AI Enhancement Review

## Current Status Review

All 7 analytics pages are implemented and functional:
- Analytics Dashboard (KPIs, charts, trend data)
- Financial Ratios (11 health indicators)
- Profitability Analysis (COGS, margins by customer/product/cost center)
- Cash Flow Forecast (weighted AR/AP, bank balance, 3-month projection)
- Budget vs Actuals (budget entry, variance tracking)
- Break-Even Analysis (fixed/variable cost classification, interactive chart)
- Business Planning (targets, scenario modeling)

The sidebar currently has 12 top-level groups rendered in this order:
Dashboard > CRM > Sales > Purchasing > Inventory > Production > Accounting > **Analytics** > HR > POS > Web Sales > Documents > Returns > Settings (footer)

---

## Part 1: Sidebar Reorganization

### Problem
The Analytics section currently has no sub-sections -- all 7 items are flat. Other modules like Inventory (4 sections), Accounting (4 sections), and HR (5 sections) are properly divided with labeled sub-groups.

### Changes to `analyticsNav` in `TenantLayout.tsx`

Add `section` labels to group the 7 analytics items logically:

| Section Label | Items |
|---|---|
| **Overview** | Analytics Dashboard |
| **Financial Health** | Financial Ratios, Profitability Analysis |
| **Forecasting** | Cash Flow Forecast, Budget vs Actuals |
| **Strategic Planning** | Break-Even Analysis, Business Planning |

Also reorder the sidebar groups for better business flow. Currently Analytics comes after Accounting but the ideal flow based on the original plan is:

```
CRM -> Sales -> Purchasing -> Inventory -> Production -> Accounting -> Analytics -> HR -> POS -> Web Sales -> Documents -> Returns
```

This is already correct. No reordering needed.

### Translation keys to add (in `translations.ts`)

- `analyticsOverview` / "Overview" / "Pregled"
- `financialHealth` / "Financial Health" / "Finansijsko zdravlje"
- `forecasting` / "Forecasting" / "Predvidjanje"
- `strategicPlanning` / "Strategic Planning" / "Stratesko planiranje"

---

## Part 2: AI Enhancement Opportunities

### Current AI state:
1. **AI Insights edge function** (`ai-insights`): Rule-based, checks 5 things (overdue invoices, large invoices, low stock, draft journals, payroll anomalies). Does NOT use Lovable AI / LLM -- purely database queries with hardcoded thresholds.
2. **AI Assistant** (`ai-assistant`): Uses Lovable AI Gateway for natural language chat. Fetches tenant context (invoices, stock, employees) and sends to LLM with streaming SSE.
3. **AiModuleInsights component**: Used on Analytics Dashboard. Calls same `ai-insights` function with optional `module` param, but the edge function ignores the `module` param entirely.

### Identified AI Gaps and Improvements

#### Gap 1: `ai-insights` ignores the `module` parameter
The edge function receives `module` from `AiModuleInsights` but never uses it. All insights are returned regardless of which module page is viewed. This means the Analytics Dashboard shows the same generic insights as any other page.

**Fix**: Add module-specific insight logic to `ai-insights/index.ts`:
- `module: "analytics"` -- add margin trend analysis, ratio warnings, revenue forecast accuracy
- `module: "inventory"` -- focus on stock and movement insights
- `module: "hr"` -- focus on payroll and leave insights
- `module: "accounting"` -- focus on journal and invoice insights

#### Gap 2: No AI-powered narrative on Analytics pages
The Analytics Dashboard, Financial Ratios, and Cash Flow Forecast compute numbers but don't explain them. Adding LLM-generated narrative summaries would give users plain-language explanations.

**Fix**: Create a new edge function `ai-analytics-narrative` that:
- Receives the computed KPIs/ratios from the frontend
- Sends them to Lovable AI Gateway with a prompt like "Analyze these financial ratios and provide a brief executive summary"
- Returns a 2-3 sentence narrative displayed in a card

Use this on:
- Analytics Dashboard (executive summary of financial health)
- Financial Ratios page (interpretation of ratio trends)
- Cash Flow Forecast (risk assessment narrative)

#### Gap 3: Business Planning has no AI recommendations
The page has hardcoded scenario modeling but doesn't use AI to generate recommendations based on actual data trajectory.

**Fix**: Add an "AI Recommendations" section to Business Planning that calls `ai-analytics-narrative` with current revenue/expense trajectory and targets, returning 3-5 actionable suggestions.

#### Gap 4: Budget vs Actuals has no AI anomaly detection
When a budget is significantly exceeded, there's no proactive alert.

**Fix**: Add budget variance insights to the `ai-insights` edge function when `module: "analytics"` -- check for accounts exceeding budget by more than 20%.

---

## Part 3: Implementation Plan

### Files to modify:

| File | Change |
|---|---|
| `src/layouts/TenantLayout.tsx` | Add `section` labels to `analyticsNav` items |
| `src/i18n/translations.ts` | Add 4 section translation keys |
| `supabase/functions/ai-insights/index.ts` | Add module-aware filtering and analytics-specific insights (margin trends, budget variance) |
| `supabase/functions/ai-analytics-narrative/index.ts` | **New** -- LLM-powered narrative summaries for analytics pages |
| `src/components/ai/AiAnalyticsNarrative.tsx` | **New** -- Component that sends KPIs to the narrative edge function and displays the result |
| `src/pages/tenant/AnalyticsDashboard.tsx` | Add `AiAnalyticsNarrative` with computed KPI data |
| `src/pages/tenant/FinancialRatios.tsx` | Add `AiAnalyticsNarrative` for ratio interpretation |
| `src/pages/tenant/BusinessPlanning.tsx` | Add AI-generated recommendations section |

### New edge function: `ai-analytics-narrative`

- Receives `{ tenant_id, context_type, data }` where `context_type` is "dashboard" | "ratios" | "cashflow" | "planning"
- Authenticates via JWT (same pattern as existing functions)
- Sends data to Lovable AI Gateway (`google/gemini-3-flash-preview`) with a tailored system prompt
- Returns `{ narrative: string, recommendations?: string[] }`
- Non-streaming (simple invoke), since narratives are short
- Handles 429/402 errors gracefully

### Suggested implementation order:
1. Sidebar section labels (quick win, 2 files)
2. Module-aware `ai-insights` filtering (1 file)
3. `ai-analytics-narrative` edge function + component (2 new files)
4. Integrate narrative into Analytics Dashboard, Financial Ratios, Business Planning (3 files)


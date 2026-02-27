

## v2.5 Intelligence — 33 Tasks

Organized into 7 categories across 4 implementation rounds.

---

### Round 1: Expand Insight Rules (Tasks 1-8)

Add 8 new rule-based detections to `supabase/functions/ai-insights/index.ts`:

| # | Insight | Severity Logic | Data Source |
|---|---------|---------------|-------------|
| 1 | High POS refund rate (>10% of transactions) | warning/critical | `pos_transactions` refund vs sale count |
| 2 | Non-fiscalized POS transactions (status != fiscalized, age > 1h) | critical | `pos_transactions` status check |
| 3 | Overdue production orders (planned_end < today, status != completed) | warning | `production_orders` |
| 4 | BOM material shortage forecast (production orders vs stock) | critical | `production_order_lines` + `inventory_stock` |
| 5 | Old unreconciled bank statements (>30 days) | warning | `bank_statements` unreconciled |
| 6 | PO delivery overdue (expected_date < today, status=sent) | warning | `purchase_orders` |
| 7 | Quote aging / low conversion (quotes > 14d without order) | info | `sales_quotes` |
| 8 | Open fiscal periods without closing entries | warning | `fiscal_periods` status=open, past quarter |

Also update `insightRouteMap.ts` with routes for all 8 new types, and add `filterByModule` mappings for `pos`, `production`, `purchasing`, `sales` modules.

**Files**: `supabase/functions/ai-insights/index.ts`, `src/lib/insightRouteMap.ts`

---

### Round 2: Spread AI Widgets to Missing Pages (Tasks 9-19)

**Add AiModuleInsights to 6 pages (Tasks 9-14)**:

| # | Page | Module filter |
|---|------|--------------|
| 9 | `Invoices.tsx` | accounting |
| 10 | `JournalEntries.tsx` | accounting |
| 11 | `BankStatements.tsx` | accounting |
| 12 | `PurchaseOrders.tsx` | purchasing |
| 13 | `SalesOrders.tsx` | sales |
| 14 | `ProductionOrders.tsx` | production |

Each: import `AiModuleInsights`, add `{tenantId && <AiModuleInsights tenantId={tenantId} module="..." />}` before the main table.

**Add AiAnalyticsNarrative to 5 pages + new context prompts (Tasks 15-19)**:

| # | Page | New contextType | System prompt theme |
|---|------|----------------|---------------------|
| 15 | `BankReconciliation.tsx` | `bank_reconciliation` | Reconciliation accuracy, unmatched items |
| 16 | `FleetManagement.tsx` | `fleet` | Vehicle utilization, maintenance costs |
| 17 | `Kalkulacija.tsx` | `kalkulacija` | Margin analysis, pricing competitiveness |
| 18 | `CostCenterPL.tsx` | `cost_center_pl` | Cost center profitability, allocation |
| 19 | `PayrollBankReconciliation.tsx` | `payroll_recon` | Payroll payment matching accuracy |

Each: import `AiAnalyticsNarrative`, pass relevant KPI data, add system prompt to `ai-analytics-narrative/index.ts` `systemPrompts` map.

**Files**: 11 page files + `supabase/functions/ai-analytics-narrative/index.ts` (add 5 new system prompts)

---

### Round 3: AI Copilot Enhancements (Tasks 20-24)

| # | Task | File |
|---|------|------|
| 20 | Expand `SUGGESTED_QUESTIONS` to cover `/accounting/bank-*`, `/purchasing/*`, `/sales/orders`, `/inventory/production`, `/pos/*` | `AiContextSidebar.tsx` |
| 21 | Add `getNarrativeContext` mappings for bank, fleet, kalkulacija, cost-center, payroll-recon routes | `AiContextSidebar.tsx` |
| 22 | Add period comparison tool to `ai-assistant` — user says "compare Q1 vs Q2" → SQL aggregation by date range | `supabase/functions/ai-assistant/index.ts` |
| 23 | Add what-if scenario tool to `ai-assistant` — "what if revenue drops 20%" → recalculate KPIs | `supabase/functions/ai-assistant/index.ts` |
| 24 | Render data tables inline in chat (detect markdown tables in assistant responses, render with `<Table>`) | `AiContextSidebar.tsx`, `SimpleMarkdown.tsx` |

---

### Round 4: Proactive Intelligence & Specialized Features (Tasks 25-33)

**Proactive (Tasks 25-29)**:

| # | Task | Implementation |
|---|------|---------------|
| 25 | Create `ai-daily-digest` edge function — summarizes yesterday's key changes (new invoices, stock alerts, payroll) | New edge function, non-streaming, tool-calling for DB queries |
| 26 | Wire daily digest to `create-notification` — insight severity ≥ warning triggers in-app notification | Edit `ai-insights` to call `create-notification` for critical/warning items |
| 27 | Dashboard "Morning Briefing" card — shows daily digest with refresh button | New component `AiMorningBriefing.tsx` on Dashboard |
| 28 | Weekly AI trend email — edge function that generates week-over-week comparison narrative | New `ai-weekly-email` edge function + `send-notification-emails` integration |
| 29 | Real-time insight badge on sidebar — show count of unread critical insights | Edit `TenantLayout.tsx` sidebar, query `ai_insights_cache` for critical count |

**Specialized (Tasks 30-33)**:

| # | Task | Implementation |
|---|------|---------------|
| 30 | Improve `ai-bank-categorize` — add learning from user corrections (store mapping in `bank_categorization_rules` table) | New table + edit edge function |
| 31 | Cross-module duplicate detection — detect same partner invoice in both `invoices` and `supplier_invoices` | New insight rule in `ai-insights` |
| 32 | AI smart partner matching — when creating new partner, suggest existing matches by name/PIB similarity | New `usePartnerSuggestion` hook calling AI |
| 33 | AI data quality dashboard — completeness scores per module (% of records with all required fields) | New `DataQualityDashboard.tsx` page + route |

**Database migration for Tasks 25, 28, 30, 33**:
```sql
-- Task 30: Bank categorization learning
CREATE TABLE IF NOT EXISTS bank_categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pattern TEXT NOT NULL,
  account_id UUID REFERENCES chart_of_accounts(id),
  partner_id UUID REFERENCES partners(id),
  confidence NUMERIC DEFAULT 1.0,
  usage_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS + indexes
```

---

### Summary

| Round | Tasks | Effort | Focus |
|-------|-------|--------|-------|
| Round 1 | 1-8 | 8 new insight rules | Rule engine expansion |
| Round 2 | 9-19 | 11 pages get AI widgets | Coverage spread |
| Round 3 | 20-24 | 5 copilot improvements | Chat intelligence |
| Round 4 | 25-33 | 9 proactive + specialized | Autonomous AI |

**Total: 33 tasks**. Each round is independently deployable. Recommend starting with Round 1 (most value, least risk).

